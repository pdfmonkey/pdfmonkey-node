import { vi } from 'vitest';
import { PDFMonkey } from '../client.js';

/** Create a client with pre-configured mock fetch responses. */
export function createClient(responses: Array<{ status: number; body?: unknown }>): {
  client: PDFMonkey;
  fetch: ReturnType<typeof vi.fn>;
} {
  const fetch = vi.fn();
  for (const res of responses) {
    fetch.mockResolvedValueOnce(
      new Response(res.body !== undefined ? JSON.stringify(res.body) : null, {
        status: res.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
  return { client: new PDFMonkey({ apiKey: 'sk_test', fetch }), fetch };
}
