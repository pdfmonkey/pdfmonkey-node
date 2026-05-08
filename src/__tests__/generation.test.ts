import { describe, expect, it } from 'vitest';
import { PDFMonkeyError } from '../error.js';
import type { DocumentCard } from '../resources/document-cards.js';
import type { Document } from '../resources/documents.js';
import { createClient } from './helpers.js';

const docFixture: Document = {
  id: 'doc_1',
  app_id: 'app_1',
  checksum: 'abc',
  created_at: '2026-01-01T00:00:00Z',
  document_template_id: 'tpl_1',
  download_url: 'https://cdn.example.com/doc.pdf',
  failure_cause: null,
  filename: 'invoice.pdf',
  generation_logs: [],
  meta: null,
  output_type: 'pdf',
  payload: '{"name":"test"}',
  preview_url: 'https://preview.url',
  public_share_link: null,
  status: 'success',
  updated_at: '2026-01-01T00:00:00Z',
};

const cardFixture: DocumentCard = {
  id: 'card_1',
  app_id: 'app_1',
  created_at: '2026-01-01T00:00:00Z',
  document_template_id: 'tpl_1',
  document_template_identifier: 'invoice',
  download_url: 'https://cdn.example.com/doc.pdf',
  failure_cause: null,
  filename: 'invoice.pdf',
  meta: null,
  output_type: 'pdf',
  preview_url: 'https://preview.url',
  public_share_link: null,
  status: 'success',
  updated_at: '2026-01-01T00:00:00Z',
};

// ── generateSync ──────────────────────────────────────────────────────────

describe('generateSync', () => {
  it('posts to /documents/sync and returns a document card', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { document_card: cardFixture } }]);

    const card = await client.documents.generateSync({
      document_template_id: 'tpl_1',
      payload: '{"name":"test"}',
    });

    expect(card.id).toBe('card_1');
    expect(card.download_url).toBe('https://cdn.example.com/doc.pdf');

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/documents/sync');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.document.status).toBe('pending');
    expect(body.document.document_template_id).toBe('tpl_1');
  });
});

// ── waitForGeneration ─────────────────────────────────────────────────────

describe('waitForGeneration', () => {
  it('polls until document reaches success status', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document: { ...docFixture, status: 'generating' } } },
      { status: 200, body: { document: { ...docFixture, status: 'generating' } } },
      { status: 200, body: { document: docFixture } },
    ]);

    const doc = await client.documents.waitForGeneration('doc_1', { interval: 1 });

    expect(doc.status).toBe('success');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('throws on failure status', async () => {
    const { client } = createClient([
      {
        status: 200,
        body: {
          document: { ...docFixture, status: 'failure', failure_cause: 'Template error' },
        },
      },
    ]);

    await expect(client.documents.waitForGeneration('doc_1', { interval: 1 })).rejects.toThrow(
      PDFMonkeyError,
    );
    await expect(
      createClient([
        {
          status: 200,
          body: {
            document: { ...docFixture, status: 'failure', failure_cause: 'Template error' },
          },
        },
      ]).client.documents.waitForGeneration('doc_1', { interval: 1 }),
    ).rejects.toThrow('Template error');
  });

  it('throws on error status', async () => {
    const { client } = createClient([
      {
        status: 200,
        body: { document: { ...docFixture, status: 'error', failure_cause: null } },
      },
    ]);

    await expect(client.documents.waitForGeneration('doc_1', { interval: 1 })).rejects.toThrow(
      'Unknown error',
    );
  });

  it('throws if interval <= 0', async () => {
    const { client } = createClient([]);

    await expect(client.documents.waitForGeneration('doc_1', { interval: 0 })).rejects.toThrow(
      'interval must be a positive number',
    );
    await expect(client.documents.waitForGeneration('doc_1', { interval: -1 })).rejects.toThrow(
      'interval must be a positive number',
    );
  });

  it('throws if timeout <= 0', async () => {
    const { client } = createClient([]);

    await expect(client.documents.waitForGeneration('doc_1', { timeout: 0 })).rejects.toThrow(
      'timeout must be a positive number',
    );
    await expect(client.documents.waitForGeneration('doc_1', { timeout: -1 })).rejects.toThrow(
      'timeout must be a positive number',
    );
  });

  it('throws on timeout', async () => {
    const { client } = createClient([
      { status: 200, body: { document: { ...docFixture, status: 'generating' } } },
    ]);

    await expect(
      client.documents.waitForGeneration('doc_1', { interval: 100, timeout: 10 }),
    ).rejects.toThrow(/timed out/);
  });

  it('rejects maxInterval < interval', async () => {
    const { client } = createClient([]);

    await expect(
      client.documents.waitForGeneration('doc_1', { interval: 1000, maxInterval: 500 }),
    ).rejects.toThrow('maxInterval must be >= interval');
  });

  it('treats maxInterval === interval as disabling backoff', async () => {
    // Two pending polls then success — succeeds without timing out, which
    // confirms backoff respects the cap.
    const { client } = createClient([
      { status: 200, body: { document: { ...docFixture, status: 'generating' } } },
      { status: 200, body: { document: { ...docFixture, status: 'generating' } } },
      { status: 200, body: { document: docFixture } },
    ]);

    const doc = await client.documents.waitForGeneration('doc_1', {
      interval: 1,
      maxInterval: 1,
    });
    expect(doc.status).toBe('success');
  });
});
