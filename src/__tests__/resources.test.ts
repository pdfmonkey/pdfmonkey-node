import { describe, expect, it, vi } from 'vitest';
import { PDFMonkey } from '../client.js';
import type { DocumentCard } from '../resources/document-cards.js';
import type { Document } from '../resources/documents.js';
import { createClient } from './helpers.js';

// ── Documents ──────────────────────────────────────────────────────────────

describe('Documents', () => {
  const docFixture: Document = {
    id: 'doc_1',
    app_id: 'app_1',
    checksum: 'abc',
    created_at: '2026-01-01T00:00:00Z',
    document_template_id: 'tpl_1',
    download_url: null,
    failure_cause: null,
    filename: null,
    generation_logs: [],
    meta: null,
    output_type: 'pdf',
    payload: '{"name":"test"}',
    preview_url: 'https://preview.url',
    public_share_link: null,
    status: 'draft',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('creates a document', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { document: docFixture } }]);

    const doc = await client.documents.create({
      document_template_id: 'tpl_1',
      payload: '{"name":"test"}',
    });

    expect(doc.id).toBe('doc_1');
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.document.document_template_id).toBe('tpl_1');
  });

  it('gets a document by ID', async () => {
    const { client, fetch } = createClient([{ status: 200, body: { document: docFixture } }]);

    const doc = await client.documents.get('doc_1');

    expect(doc.id).toBe('doc_1');
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/documents/doc_1');
  });

  it('updates a document', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document: { ...docFixture, status: 'pending' } } },
    ]);

    const doc = await client.documents.update('doc_1', { status: 'pending' });

    expect(doc.status).toBe('pending');
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/documents/doc_1');
    expect(init.method).toBe('PUT');
  });

  it('serializes payload object to JSON string', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { document: docFixture } }]);

    await client.documents.create({
      document_template_id: 'tpl_1',
      payload: { name: 'Bob', amount: 99 },
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(typeof body.document.payload).toBe('string');
    expect(JSON.parse(body.document.payload)).toEqual({ name: 'Bob', amount: 99 });
  });

  it('passes payload string through unchanged', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { document: docFixture } }]);
    const raw = '{"name":"already-a-string"}';

    await client.documents.create({
      document_template_id: 'tpl_1',
      payload: raw,
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.document.payload).toBe(raw);
  });

  it('serializes meta object with _password and _filename', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { document: docFixture } }]);

    await client.documents.create({
      document_template_id: 'tpl_1',
      meta: { _password: 'secret123', _filename: 'invoice.pdf', clientRef: 'abc' },
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const meta = JSON.parse(body.document.meta);
    expect(meta._password).toBe('secret123');
    expect(meta._filename).toBe('invoice.pdf');
    expect(meta.clientRef).toBe('abc');
  });

  it('passes meta string as-is', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { document: docFixture } }]);
    const raw = '{"_password":"pw"}';

    await client.documents.create({
      document_template_id: 'tpl_1',
      meta: raw,
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.document.meta).toBe(raw);
  });

  it('serializes meta object on update', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document: { ...docFixture, meta: '{"_password":"pw"}' } } },
    ]);

    await client.documents.update('doc_1', {
      meta: { _password: 'pw', custom: 'val' },
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const meta = JSON.parse(body.document.meta);
    expect(meta._password).toBe('pw');
    expect(meta.custom).toBe('val');
  });

  it('serializes meta object on generateSync', async () => {
    const cardFixture: DocumentCard = {
      id: 'card_1',
      app_id: 'app_1',
      created_at: '2026-01-01T00:00:00Z',
      document_template_id: 'tpl_1',
      document_template_identifier: 'invoice',
      download_url: 'https://download.url',
      failure_cause: null,
      filename: null,
      meta: '{"_filename":"report.pdf"}',
      output_type: 'pdf',
      preview_url: 'https://preview.url',
      public_share_link: null,
      status: 'success',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const { client, fetch } = createClient([{ status: 200, body: { document_card: cardFixture } }]);

    await client.documents.generateSync({
      document_template_id: 'tpl_1',
      meta: { _filename: 'report.pdf' },
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const meta = JSON.parse(body.document.meta);
    expect(meta._filename).toBe('report.pdf');
    expect(body.document.status).toBe('pending');
  });

  it('deletes a document', async () => {
    const { client } = createClient([{ status: 204 }]);

    await expect(client.documents.delete('doc_1')).resolves.toBeUndefined();
  });

  it('downloads PDF bytes from a Document', async () => {
    const completed: Document = {
      ...docFixture,
      status: 'success',
      download_url: 'https://cdn/x.pdf',
    };
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const downloadFetch = vi.fn().mockResolvedValue(new Response(pdfBytes, { status: 200 }));
    const { client } = createClient([]);

    const bytes = await client.documents.download(completed, { fetch: downloadFetch });

    expect(bytes).toEqual(pdfBytes);
    expect(downloadFetch).toHaveBeenCalledWith('https://cdn/x.pdf', expect.any(Object));
  });

  it('downloads by ID by fetching the document card first', async () => {
    const cardFixture: DocumentCard = {
      id: 'doc_1',
      app_id: 'app_1',
      created_at: '2026-01-01T00:00:00Z',
      document_template_id: 'tpl_1',
      document_template_identifier: 'invoice',
      download_url: 'https://cdn/y.pdf',
      failure_cause: null,
      filename: null,
      meta: null,
      output_type: 'pdf',
      preview_url: 'https://preview.url',
      public_share_link: null,
      status: 'success',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const { client, fetch } = createClient([
      { status: 200, body: { document_card: cardFixture } },
    ]);
    const downloadFetch = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const bytes = await client.documents.download('doc_1', { fetch: downloadFetch });
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/document_cards/doc_1');
  });

  it('throws when the document has no download_url yet', async () => {
    const { client } = createClient([]);
    const pending = { ...docFixture, status: 'pending' as const, download_url: null };

    await expect(client.documents.download(pending)).rejects.toThrow('no download_url');
  });

  it('downloadStream returns a ReadableStream', async () => {
    const completed = {
      ...docFixture,
      status: 'success' as const,
      download_url: 'https://cdn/z.pdf',
    };
    const downloadFetch = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([9, 9, 9]), { status: 200 }));
    const { client } = createClient([]);

    const stream = await client.documents.downloadStream(completed, { fetch: downloadFetch });
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  describe('waitForGeneration', () => {
    it('has a default timeout of 120s', async () => {
      const pendingDoc = {
        ...docFixture,
        status: 'pending' as const,
      };
      // Always returns pending - will timeout
      const fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ document: pendingDoc }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await expect(
        client.documents.waitForGeneration('doc_1', { interval: 50, timeout: 100 }),
      ).rejects.toThrow('timed out');
    });

    it('aborts when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const fetch = vi.fn();
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await expect(
        client.documents.waitForGeneration('doc_1', { signal: controller.signal }),
      ).rejects.toThrow('aborted');

      // fetch should not have been called since signal was already aborted
      expect(fetch).not.toHaveBeenCalled();
    });

    it('aborts during sleep when signal fires', async () => {
      const controller = new AbortController();
      const pendingDoc = { ...docFixture, status: 'pending' as const };
      const fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ document: pendingDoc }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      // Abort after 50ms — while the sleep (500ms interval) is in progress
      setTimeout(() => controller.abort(), 50);

      await expect(
        client.documents.waitForGeneration('doc_1', {
          interval: 5000,
          timeout: 60_000,
          signal: controller.signal,
        }),
      ).rejects.toThrow('aborted');

      // Should have made exactly 1 fetch call before aborting during sleep
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Document Cards ─────────────────────────────────────────────────────────

describe('DocumentCards', () => {
  it('lists document cards with pagination', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          document_cards: [{ id: 'card_1' }, { id: 'card_2' }],
          meta: { current_page: 1, total_pages: 3, next_page: 2, prev_page: null },
        },
      },
    ]);

    const page = await client.documentCards.list({ page: 1, document_template_id: 'tpl_1' });

    expect(page.data).toHaveLength(2);
    expect(page.currentPage).toBe(1);
    expect(page.totalPages).toBe(3);
    expect(page.hasNextPage()).toBe(true);
    expect(page.hasPreviousPage()).toBe(false);

    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q[document_template_id]')).toBe('tpl_1');
    expect(parsed.searchParams.get('page[number]')).toBe('1');
  });

  it('lists document cards with status, workspace_id, updated_since filters', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          document_cards: [{ id: 'card_1' }],
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        },
      },
    ]);

    await client.documentCards.list({
      status: 'success',
      workspace_id: 'ws_1',
      updated_since: 1700000000,
    });

    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q[status]')).toBe('success');
    expect(parsed.searchParams.get('q[workspace_id]')).toBe('ws_1');
    expect(parsed.searchParams.get('q[updated_since]')).toBe('1700000000');
  });

  it('lists document cards without params (empty query)', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          document_cards: [],
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        },
      },
    ]);

    const page = await client.documentCards.list();

    expect(page.data).toHaveLength(0);
    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.toString()).toBe('');
  });

  it('gets a document card by ID', async () => {
    const { client } = createClient([
      { status: 200, body: { document_card: { id: 'card_1', status: 'success' } } },
    ]);

    const card = await client.documentCards.get('card_1');
    expect(card.id).toBe('card_1');
  });
});

// ── Document Templates ─────────────────────────────────────────────────────

describe('DocumentTemplates', () => {
  it('lists template cards with all params including page', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          document_template_cards: [{ id: 'tpl_1' }],
          meta: { current_page: 2, total_pages: 3, next_page: 3, prev_page: 1 },
        },
      },
    ]);

    await client.documentTemplates.list({
      page: 2,
      workspace_id: 'ws_1',
      folders: 'fold_1',
      sort: 'identifier',
    });

    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('page[number]')).toBe('2');
    expect(parsed.searchParams.get('q[workspace_id]')).toBe('ws_1');
    expect(parsed.searchParams.get('q[folders]')).toBe('fold_1');
    expect(parsed.searchParams.get('sort')).toBe('identifier');
  });

  it('lists template cards', async () => {
    const { client } = createClient([
      {
        status: 200,
        body: {
          document_template_cards: [{ id: 'tpl_1', identifier: 'invoice' }],
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        },
      },
    ]);

    const page = await client.documentTemplates.list({ workspace_id: 'ws_1' });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.identifier).toBe('invoice');
  });

  it('gets a template by ID', async () => {
    const { client } = createClient([
      { status: 200, body: { document_template: { id: 'tpl_1', identifier: 'invoice' } } },
    ]);

    const tpl = await client.documentTemplates.get('tpl_1');
    expect(tpl.identifier).toBe('invoice');
  });

  it('creates a template', async () => {
    const { client, fetch } = createClient([
      { status: 201, body: { document_template: { id: 'tpl_new', identifier: 'receipt' } } },
    ]);

    const tpl = await client.documentTemplates.create({ identifier: 'receipt' });
    expect(tpl.id).toBe('tpl_new');
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.document_template.identifier).toBe('receipt');
  });

  it('updates a template', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document_template: { id: 'tpl_1', identifier: 'updated' } } },
    ]);

    const tpl = await client.documentTemplates.update('tpl_1', { identifier: 'updated' });
    expect(tpl.identifier).toBe('updated');
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('PUT');
  });

  it('deletes a template', async () => {
    const { client } = createClient([{ status: 204 }]);
    await expect(client.documentTemplates.delete('tpl_1')).resolves.toBeUndefined();
  });
});

// ── Template Folders ───────────────────────────────────────────────────────

describe('TemplateFolders', () => {
  it('lists folders with page param', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          template_folders: [{ id: 'fold_1' }],
          meta: { current_page: 2, total_pages: 3, next_page: 3, prev_page: 1 },
        },
      },
    ]);

    await client.templateFolders.list({ page: 2 });

    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('page[number]')).toBe('2');
  });

  it('lists folders', async () => {
    const { client } = createClient([
      {
        status: 200,
        body: {
          template_folders: [{ id: 'fold_1', identifier: 'invoices' }],
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        },
      },
    ]);

    const page = await client.templateFolders.list();
    expect(page.data).toHaveLength(1);
  });

  it('gets a folder by ID', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { template_folder: { id: 'fold_1', identifier: 'invoices' } } },
    ]);

    const folder = await client.templateFolders.get('fold_1');
    expect(folder.id).toBe('fold_1');
    expect(folder.identifier).toBe('invoices');
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/template_folders/fold_1');
  });

  it('creates a folder', async () => {
    const { client } = createClient([
      { status: 201, body: { template_folder: { id: 'fold_new', identifier: 'reports' } } },
    ]);

    const folder = await client.templateFolders.create({ identifier: 'reports' });
    expect(folder.identifier).toBe('reports');
  });

  it('updates a folder', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { template_folder: { id: 'fold_1', identifier: 'renamed' } } },
    ]);

    const folder = await client.templateFolders.update('fold_1', { identifier: 'renamed' });
    expect(folder.identifier).toBe('renamed');
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('PUT');
  });

  it('deletes a folder', async () => {
    const { client } = createClient([{ status: 204 }]);
    await expect(client.templateFolders.delete('fold_1')).resolves.toBeUndefined();
  });
});

// ── Workspaces ─────────────────────────────────────────────────────────────

describe('Workspaces', () => {
  it('lists workspaces with page param', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          workspaces: [{ id: 'ws_1' }],
          meta: { current_page: 2, total_pages: 3, next_page: 3, prev_page: 1 },
        },
      },
    ]);

    await client.workspaces.list({ page: 2 });

    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('page[number]')).toBe('2');
  });

  it('lists workspaces', async () => {
    const { client } = createClient([
      {
        status: 200,
        body: {
          workspaces: [{ id: 'ws_1', identifier: 'main' }],
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        },
      },
    ]);

    const page = await client.workspaces.list();
    expect(page.data).toHaveLength(1);
  });

  it('gets a workspace by ID', async () => {
    const { client } = createClient([
      { status: 200, body: { workspace: { id: 'ws_1', identifier: 'main' } } },
    ]);

    const ws = await client.workspaces.get('ws_1');
    expect(ws.identifier).toBe('main');
  });
});

// ── Snippets ───────────────────────────────────────────────────────────────

describe('Snippets', () => {
  it('gets a snippet by ID', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: { snippet: { id: 'snp_1', identifier: 'header', code: '<h1/>' } },
      },
    ]);

    const snp = await client.snippets.get('snp_1');
    expect(snp.id).toBe('snp_1');
    expect(snp.identifier).toBe('header');
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/snippets/snp_1');
  });

  it('lists snippets', async () => {
    const { client } = createClient([
      {
        status: 200,
        body: {
          snippets: [{ id: 'snp_1', identifier: 'header' }],
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        },
      },
    ]);

    const page = await client.snippets.list();
    expect(page.data).toHaveLength(1);
  });

  it('lists snippets with page param', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          snippets: [{ id: 'snp_1' }],
          meta: { current_page: 2, total_pages: 3, next_page: 3, prev_page: 1 },
        },
      },
    ]);

    await client.snippets.list({ page: 2 });

    const [url] = fetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('page[number]')).toBe('2');
  });

  it('creates a snippet', async () => {
    const { client } = createClient([
      { status: 201, body: { snippet: { id: 'snp_new', identifier: 'footer', code: '<div/>' } } },
    ]);

    const snp = await client.snippets.create({
      identifier: 'footer',
      code: '<div/>',
      workspace_id: 'ws_1',
    });
    expect(snp.identifier).toBe('footer');
  });

  it('updates a snippet', async () => {
    const { client } = createClient([
      { status: 200, body: { snippet: { id: 'snp_1', code: '<p>updated</p>' } } },
    ]);

    const snp = await client.snippets.update('snp_1', { code: '<p>updated</p>' });
    expect(snp.code).toBe('<p>updated</p>');
  });

  it('deletes a snippet', async () => {
    const { client } = createClient([{ status: 204 }]);
    await expect(client.snippets.delete('snp_1')).resolves.toBeUndefined();
  });
});

// ── PDF Engines ────────────────────────────────────────────────────────────

describe('PdfEngines', () => {
  it('lists active pdf engines', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          pdf_engines: [
            { id: 'eng_1', name: 'chromium', version: 6, deprecated_on: null },
            { id: 'eng_2', name: 'chromium', version: 5, deprecated_on: '2026-12-31' },
          ],
        },
      },
    ]);

    const engines = await client.pdfEngines.list();
    expect(engines).toHaveLength(2);
    expect(engines[0]?.id).toBe('eng_1');
    expect(engines[1]?.deprecated_on).toBe('2026-12-31');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/pdf_engines');
  });

  it('returns empty array when no engines available', async () => {
    const { client } = createClient([{ status: 200, body: { pdf_engines: [] } }]);

    const engines = await client.pdfEngines.list();
    expect(engines).toHaveLength(0);
  });
});

// ── Current User ───────────────────────────────────────────────────────────

describe('CurrentUser', () => {
  it('gets current user', async () => {
    const { client, fetch } = createClient([
      {
        status: 200,
        body: {
          current_user: {
            id: 'usr_1',
            email: 'test@example.com',
            current_plan: 'pro',
            available_documents: 1000,
          },
        },
      },
    ]);

    const user = await client.currentUser.get();
    expect(user.email).toBe('test@example.com');
    expect(user.current_plan).toBe('pro');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/current_user');
  });
});

// ── encodeURIComponent on path params ─────────────────────────────────────

describe('Path parameter encoding', () => {
  it('encodes special characters in document IDs', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document: { id: 'a/b', status: 'draft' } } },
    ]);

    await client.documents.get('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/documents/a%2Fb');
  });

  it('encodes special characters in document card IDs', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document_card: { id: 'a/b' } } },
    ]);

    await client.documentCards.get('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/document_cards/a%2Fb');
  });

  it('encodes special characters in template IDs', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { document_template: { id: 'a/b' } } },
    ]);

    await client.documentTemplates.get('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/document_templates/a%2Fb');
  });

  it('encodes special characters in snippet IDs', async () => {
    const { client, fetch } = createClient([{ status: 200, body: { snippet: { id: 'a/b' } } }]);

    await client.snippets.get('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/snippets/a%2Fb');
  });

  it('encodes special characters in workspace IDs', async () => {
    const { client, fetch } = createClient([{ status: 200, body: { workspace: { id: 'a/b' } } }]);

    await client.workspaces.get('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/workspaces/a%2Fb');
  });

  it('encodes special characters in template folder IDs', async () => {
    const { client, fetch } = createClient([
      { status: 200, body: { template_folder: { id: 'a/b' } } },
    ]);

    await client.templateFolders.get('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/template_folders/a%2Fb');
  });

  it('encodes special characters in rest hook IDs', async () => {
    const { client, fetch } = createClient([{ status: 204 }]);

    await client.restHooks.delete('a/b');

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/rest_hooks/a%2Fb');
  });
});

// ── Pagination ─────────────────────────────────────────────────────────────

describe('Pagination', () => {
  it('navigates to next page', async () => {
    const fetch = vi.fn();
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          document_cards: [{ id: 'card_1' }],
          meta: { current_page: 1, total_pages: 2, next_page: 2, prev_page: null },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          document_cards: [{ id: 'card_2' }],
          meta: { current_page: 2, total_pages: 2, next_page: null, prev_page: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page1 = await client.documentCards.list();

    expect(page1.hasNextPage()).toBe(true);
    const page2 = await page1.getNextPage();
    expect(page2.data[0]?.id).toBe('card_2');
    expect(page2.hasNextPage()).toBe(false);
    expect(page2.hasPreviousPage()).toBe(true);
  });
});
