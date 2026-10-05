import { describe, expect, it } from 'vitest';
import { verifyWebhook } from '../webhooks.js';
import { createClient } from './helpers.js';

// Raw secret bytes (32 random bytes) as base64
const SECRET_RAW = 'dGVzdC1zZWNyZXQta2V5LWZvci1obWFjLXNpZ25hdHVyZXM=';
const SECRET = `whsec_${SECRET_RAW}`;

async function sign(msgId: string, timestamp: string, payload: string): Promise<string> {
  const secretBytes = base64ToBytes(SECRET_RAW);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${msgId}.${timestamp}.${payload}`),
  );
  return `v1,${bytesToBase64(new Uint8Array(sig))}`;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

// ── RestHooks Resource ────────────────────────────────────────────────────

describe('RestHooks', () => {
  it('creates a rest hook, joining events and setting platform', async () => {
    const hook = {
      id: 'hook_1',
      url: 'https://example.com/webhook',
      event: 'documents.generation.success,documents.generation.failure',
      platform: 'api',
      workspace_id: 'ws_1',
      document_template_ids: [],
      custom_channel: null,
    };
    const { client, fetch } = createClient([{ status: 201, body: { rest_hook: hook } }]);

    const result = await client.restHooks.create({
      url: 'https://example.com/webhook',
      workspace_id: 'ws_1',
      events: ['documents.generation.success', 'documents.generation.failure'],
    });

    expect(result.id).toBe('hook_1');
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/rest_hooks');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      rest_hook: {
        url: 'https://example.com/webhook',
        workspace_id: 'ws_1',
        event: 'documents.generation.success,documents.generation.failure',
        platform: 'api',
      },
    });
  });

  it('creates a rest hook restricted to templates', async () => {
    const { client, fetch } = createClient([{ status: 201, body: { rest_hook: { id: 'h' } } }]);

    await client.restHooks.create({
      url: 'https://example.com/webhook',
      workspace_id: 'ws_1',
      events: ['documents.generation.success'],
      document_template_ids: ['tpl_1', 'tpl_2'],
      custom_channel: 'invoices',
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.rest_hook.document_template_ids).toEqual(['tpl_1', 'tpl_2']);
    expect(body.rest_hook.custom_channel).toBe('invoices');
  });

  it('deletes a rest hook', async () => {
    const { client, fetch } = createClient([{ status: 204 }]);

    await expect(client.restHooks.delete('hook_1')).resolves.toBeUndefined();
    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toContain('/rest_hooks/hook_1');
  });
});

// ── Webhook Verification ──────────────────────────────────────────────────

describe('verifyWebhook', () => {
  const payload = '{"document":{"id":"doc_1","status":"success"}}';
  const msgId = 'msg_123';

  it('verifies a valid signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(msgId, timestamp, payload);

    const event = await verifyWebhook(
      payload,
      {
        'svix-id': msgId,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      },
      SECRET,
    );

    expect(event).toEqual({ document: { id: 'doc_1', status: 'success' } });
  });

  it('accepts secret without whsec_ prefix', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(msgId, timestamp, payload);

    const event = await verifyWebhook(
      payload,
      {
        'svix-id': msgId,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      },
      SECRET_RAW,
    );

    expect('document' in event).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': 'v1,aW52YWxpZA==',
        },
        SECRET,
      ),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('rejects a stale timestamp (replay protection)', async () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60); // 6 minutes ago
    const signature = await sign(msgId, staleTimestamp, payload);

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': staleTimestamp,
          'svix-signature': signature,
        },
        SECRET,
      ),
    ).rejects.toThrow('Webhook timestamp too old');
  });

  it('rejects missing headers', async () => {
    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': '',
          'svix-timestamp': '',
          'svix-signature': '',
        },
        SECRET,
      ),
    ).rejects.toThrow('Missing required Svix webhook headers');
  });

  it('rejects non-numeric timestamp', async () => {
    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': 'not-a-number',
          'svix-signature': 'v1,aW52YWxpZA==',
        },
        SECRET,
      ),
    ).rejects.toThrow('Invalid webhook timestamp');
  });

  it('rejects timestamp in the future (> 5 min)', async () => {
    const futureTimestamp = String(Math.floor(Date.now() / 1000) + 6 * 60);
    const signature = await sign(msgId, futureTimestamp, payload);

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': futureTimestamp,
          'svix-signature': signature,
        },
        SECRET,
      ),
    ).rejects.toThrow('Webhook timestamp too far in the future');
  });

  it('accepts timestamp exactly at the 300s boundary', async () => {
    const boundaryTimestamp = String(Math.floor(Date.now() / 1000) - 300);
    const signature = await sign(msgId, boundaryTimestamp, payload);

    const event = await verifyWebhook(
      payload,
      {
        'svix-id': msgId,
        'svix-timestamp': boundaryTimestamp,
        'svix-signature': signature,
      },
      SECRET,
    );

    expect('document' in event).toBe(true);
  });

  it('rejects signature with v2 prefix (not v1)', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const validSig = await sign(msgId, timestamp, payload);
    // Replace v1, with v2,
    const v2Sig = validSig.replace('v1,', 'v2,');

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': v2Sig,
        },
        SECRET,
      ),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('rejects malformed signature (no comma)', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': 'v1aW52YWxpZA==',
        },
        SECRET,
      ),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('rejects invalid base64 secret', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': 'v1,aW52YWxpZA==',
        },
        'whsec_!!!invalid-base64!!!',
      ),
    ).rejects.toThrow('Invalid webhook secret: not valid base64');
  });

  it('rejects non-JSON payload after valid signature', async () => {
    const nonJsonPayload = 'not-json';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(msgId, timestamp, nonJsonPayload);

    await expect(
      verifyWebhook(
        nonJsonPayload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': signature,
        },
        SECRET,
      ),
    ).rejects.toThrow('Webhook payload is not valid JSON');
  });

  it('rejects a JSON payload that is not an object', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    for (const body of ['[]', '"text"', 'null']) {
      const signature = await sign(msgId, timestamp, body);
      await expect(
        verifyWebhook(
          body,
          { 'svix-id': msgId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          SECRET,
        ),
      ).rejects.toThrow('Webhook payload is not a JSON object');
    }
  });

  it('returns a quota.warning payload as-is', async () => {
    const body =
      '{"period_start":"2026-10-01T00:00:00Z","period_end":"2026-11-01T00:00:00Z","available_documents":100,"threshold":80}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(msgId, timestamp, body);

    const result = await verifyWebhook(
      body,
      { 'svix-id': msgId, 'svix-timestamp': timestamp, 'svix-signature': signature },
      SECRET,
    );

    expect('document' in result).toBe(false);
    expect(result).toMatchObject({ available_documents: 100, threshold: 80 });
  });

  it('rejects tolerance <= 0', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': 'v1,aW52YWxpZA==',
        },
        SECRET,
        { tolerance: 0 },
      ),
    ).rejects.toThrow('Webhook tolerance must be a positive number');
    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': 'v1,aW52YWxpZA==',
        },
        SECRET,
        { tolerance: -1 },
      ),
    ).rejects.toThrow('Webhook tolerance must be a positive number');
  });

  it('supports custom tolerance', async () => {
    // Timestamp 8 seconds ago would be valid with default 300s tolerance
    // but rejected with 5s custom tolerance
    const timestamp = String(Math.floor(Date.now() / 1000) - 8);
    const signature = await sign(msgId, timestamp, payload);

    await expect(
      verifyWebhook(
        payload,
        {
          'svix-id': msgId,
          'svix-timestamp': timestamp,
          'svix-signature': signature,
        },
        SECRET,
        { tolerance: 5 },
      ),
    ).rejects.toThrow('Webhook timestamp too old');
  });

  it('supports multiple signatures in header', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const validSig = await sign(msgId, timestamp, payload);
    const multiSig = `v1,aW52YWxpZA== ${validSig}`;

    const event = await verifyWebhook(
      payload,
      {
        'svix-id': msgId,
        'svix-timestamp': timestamp,
        'svix-signature': multiSig,
      },
      SECRET,
    );

    expect('document' in event).toBe(true);
  });
});
