import { describe, expect, it, vi } from 'vitest';
import { PDFMonkey } from '../client.js';
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PDFMonkeyError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from '../error.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetch(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    }),
  );
}

function mockFetchSequence(
  ...responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>
): typeof globalThis.fetch {
  const fn = vi.fn();
  for (const res of responses) {
    fn.mockResolvedValueOnce(
      new Response(JSON.stringify(res.body ?? {}), {
        status: res.status,
        headers: { 'content-type': 'application/json', ...res.headers },
      }),
    );
  }
  return fn;
}

function mockFetchError(error: Error): typeof globalThis.fetch {
  return vi.fn().mockRejectedValue(error);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PDFMonkey Client', () => {
  describe('constructor', () => {
    it('accepts a string API key', () => {
      const client = new PDFMonkey('sk_test_123');
      expect(client).toBeInstanceOf(PDFMonkey);
    });

    it('accepts an options object', () => {
      const client = new PDFMonkey({
        apiKey: 'sk_test_123',
        timeout: 10_000,
        maxRetries: 3,
      });
      expect(client.timeout).toBe(10_000);
      expect(client.maxRetries).toBe(3);
    });

    it('throws PDFMonkeyError if no API key is provided', () => {
      expect(() => new PDFMonkey({ apiKey: '' })).toThrow(PDFMonkeyError);
      expect(() => new PDFMonkey({ apiKey: '' })).toThrow('API key must be provided');
    });

    it('throws PDFMonkeyError if API key is whitespace-only', () => {
      expect(() => new PDFMonkey({ apiKey: '   ' })).toThrow(PDFMonkeyError);
      expect(() => new PDFMonkey({ apiKey: '\t\n' })).toThrow(PDFMonkeyError);
    });

    it('falls back to PDFMONKEY_API_KEY env var', () => {
      const original = process.env.PDFMONKEY_API_KEY;
      process.env.PDFMONKEY_API_KEY = 'sk_env_123';
      try {
        const client = new PDFMonkey();
        expect(client).toBeInstanceOf(PDFMonkey);

        const explicit = new PDFMonkey({ timeout: 5_000 });
        expect(explicit.timeout).toBe(5_000);
      } finally {
        if (original === undefined) delete process.env.PDFMONKEY_API_KEY;
        else process.env.PDFMONKEY_API_KEY = original;
      }
    });

    it('explicit apiKey wins over env var', () => {
      const original = process.env.PDFMONKEY_API_KEY;
      process.env.PDFMONKEY_API_KEY = 'sk_env_lose';
      try {
        const client = new PDFMonkey({ apiKey: 'sk_explicit_win' });
        expect(client).toBeInstanceOf(PDFMonkey);
      } finally {
        if (original === undefined) delete process.env.PDFMONKEY_API_KEY;
        else process.env.PDFMONKEY_API_KEY = original;
      }
    });

    it('throws when no key is provided and env is unset', () => {
      const original = process.env.PDFMONKEY_API_KEY;
      delete process.env.PDFMONKEY_API_KEY;
      try {
        expect(() => new PDFMonkey()).toThrow(PDFMonkeyError);
        expect(() => new PDFMonkey()).toThrow('API key must be provided');
      } finally {
        if (original !== undefined) process.env.PDFMONKEY_API_KEY = original;
      }
    });

    it('throws PDFMonkeyError if timeout <= 0', () => {
      expect(() => new PDFMonkey({ apiKey: 'sk_test', timeout: 0 })).toThrow(PDFMonkeyError);
      expect(() => new PDFMonkey({ apiKey: 'sk_test', timeout: 0 })).toThrow(
        'timeout must be a positive number',
      );
      expect(() => new PDFMonkey({ apiKey: 'sk_test', timeout: -1 })).toThrow(PDFMonkeyError);
    });

    it('throws PDFMonkeyError if maxRetries < 0', () => {
      expect(() => new PDFMonkey({ apiKey: 'sk_test', maxRetries: -1 })).toThrow(PDFMonkeyError);
      expect(() => new PDFMonkey({ apiKey: 'sk_test', maxRetries: -1 })).toThrow(
        'maxRetries must be >= 0',
      );
    });

    it('accepts maxRetries: 0', () => {
      const client = new PDFMonkey({ apiKey: 'sk_test', maxRetries: 0 });
      expect(client.maxRetries).toBe(0);
    });

    it('uses default values', () => {
      const client = new PDFMonkey('sk_test_123');
      expect(client.baseURL).toBe('https://api.pdfmonkey.io/api/v1');
      expect(client.timeout).toBe(30_000);
      expect(client.maxRetries).toBe(2);
    });
  });

  describe('successful requests', () => {
    it('makes a GET request', async () => {
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      const result = await client.get<{ id: string }>('/documents/123');

      expect(result).toEqual({ id: '123' });
      expect(fetch).toHaveBeenCalledOnce();

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe('https://api.pdfmonkey.io/api/v1/documents/123');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    });

    it('makes a POST request with body', async () => {
      const fetch = mockFetch(201, { id: 'new' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      const result = await client.post<{ id: string }>('/documents', {
        body: { template_id: 'tpl_1' },
      });

      expect(result).toEqual({ id: 'new' });
      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(init.body).toBe(JSON.stringify({ template_id: 'tpl_1' }));
    });

    it('handles 204 No Content', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      const result = await client.delete('/documents/123');
      expect(result).toBeUndefined();
    });

    it('includes query parameters', async () => {
      const fetch = mockFetch(200, { data: [] });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await client.get('/documents', { query: { 'page[number]': 2, status: 'success' } });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get('page[number]')).toBe('2');
      expect(parsed.searchParams.get('status')).toBe('success');
    });
  });

  describe('error handling', () => {
    it('throws BadRequestError on 400', async () => {
      const fetch = mockFetch(400, { error: 'Bad request' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents')).rejects.toThrow(BadRequestError);
    });

    it('throws AuthenticationError on 401', async () => {
      const fetch = mockFetch(401, { error: 'Invalid API key' });
      const client = new PDFMonkey({ apiKey: 'sk_bad', fetch, maxRetries: 0 });

      await expect(client.get('/documents')).rejects.toThrow(AuthenticationError);
    });

    it('throws PermissionDeniedError on 403', async () => {
      const fetch = mockFetch(403, { error: 'Forbidden' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents')).rejects.toThrow(PermissionDeniedError);
    });

    it('throws NotFoundError on 404', async () => {
      const fetch = mockFetch(404, { error: 'Not found' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents/missing')).rejects.toThrow(NotFoundError);
    });

    it('throws UnprocessableEntityError on 422', async () => {
      const fetch = mockFetch(422, { error: 'Validation failed' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.post('/documents')).rejects.toThrow(UnprocessableEntityError);
    });

    it('throws RateLimitError on 429 with retryAfter', async () => {
      const fetch = mockFetch(429, { error: 'Rate limit exceeded' }, { 'retry-after': '5' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      try {
        await client.get('/documents');
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(5);
        expect((error as RateLimitError).status).toBe(429);
        expect((error as RateLimitError).headers).toBeInstanceOf(Headers);
      }
    });

    it('throws InternalServerError on 500', async () => {
      const fetch = mockFetch(500, { error: 'Server error' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents')).rejects.toThrow(InternalServerError);
    });

    it('throws APIError for unknown status codes', async () => {
      const fetch = mockFetch(418, { error: "I'm a teapot" });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      try {
        await client.get('/documents');
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error).not.toBeInstanceOf(AuthenticationError);
      }
    });

    it('error includes status, headers, and message', async () => {
      const fetch = mockFetch(401, { error: 'Invalid API key' });
      const client = new PDFMonkey({ apiKey: 'sk_bad', fetch, maxRetries: 0 });

      try {
        await client.get('/documents');
        expect.unreachable();
      } catch (error) {
        const apiError = error as APIError;
        expect(apiError.status).toBe(401);
        expect(apiError.headers).toBeInstanceOf(Headers);
        expect(apiError.message).toBe('Invalid API key');
      }
    });

    it('throws APIConnectionError on network failure', async () => {
      const fetch = mockFetchError(new TypeError('fetch failed'));
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents')).rejects.toThrow(APIConnectionError);
    });

    it('throws PDFMonkeyError on malformed success JSON', async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
        );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents')).rejects.toThrow(
        'Failed to parse response body as JSON',
      );
    });
  });

  describe('retry behavior', () => {
    it('retries on 429 and succeeds', async () => {
      const fetch = mockFetchSequence(
        { status: 429, body: { error: 'Rate limit' }, headers: { 'retry-after': '0' } },
        { status: 200, body: { id: '123' } },
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      const result = await client.get<{ id: string }>('/documents/123');
      expect(result).toEqual({ id: '123' });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 and succeeds', async () => {
      const fetch = mockFetchSequence(
        { status: 500, body: { error: 'Server error' } },
        { status: 200, body: { id: '123' } },
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      const result = await client.get<{ id: string }>('/documents/123');
      expect(result).toEqual({ id: '123' });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 408 Request Timeout', async () => {
      const fetch = mockFetchSequence(
        { status: 408, body: { error: 'Timeout' } },
        { status: 200, body: { id: '123' } },
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      const result = await client.get<{ id: string }>('/documents/123');
      expect(result).toEqual({ id: '123' });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on network error and succeeds', async () => {
      const fetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '123' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      const result = await client.get<{ id: string }>('/documents/123');
      expect(result).toEqual({ id: '123' });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 400', async () => {
      const fetch = mockFetch(400, { error: 'Bad request' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      await expect(client.get('/documents')).rejects.toThrow(BadRequestError);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('does not retry on 401', async () => {
      const fetch = mockFetch(401, { error: 'Invalid API key' });
      const client = new PDFMonkey({ apiKey: 'sk_bad', fetch, maxRetries: 2 });

      await expect(client.get('/documents')).rejects.toThrow(AuthenticationError);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('does not retry on 403', async () => {
      const fetch = mockFetch(403, { error: 'Forbidden' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      await expect(client.get('/documents')).rejects.toThrow(PermissionDeniedError);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('does not retry on 404', async () => {
      const fetch = mockFetch(404, { error: 'Not found' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      await expect(client.get('/documents/missing')).rejects.toThrow(NotFoundError);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('does not retry on 422', async () => {
      const fetch = mockFetch(422, { error: 'Validation failed' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      await expect(client.post('/documents')).rejects.toThrow(UnprocessableEntityError);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('exhausts retries and throws', async () => {
      const fetch = mockFetchSequence(
        { status: 500, body: { error: 'err' } },
        { status: 500, body: { error: 'err' } },
        { status: 500, body: { error: 'err' } },
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      await expect(client.get('/documents')).rejects.toThrow(InternalServerError);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('creates a new AbortController per retry attempt', async () => {
      const signals: AbortSignal[] = [];
      const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        if (init.signal) {
          signals.push(init.signal);
        }
        if (signals.length < 3) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'err' }), {
              status: 500,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ id: '123' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 2 });

      await client.get('/documents/123');

      expect(signals).toHaveLength(3);
      // Each signal should be a different instance
      expect(signals[0]).not.toBe(signals[1]);
      expect(signals[1]).not.toBe(signals[2]);
    });

    it('respects per-request maxRetries override', async () => {
      const fetch = mockFetchSequence(
        { status: 500, body: { error: 'err' } },
        { status: 500, body: { error: 'err' } },
      );
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 5 });

      await expect(client.get('/documents', { maxRetries: 1 })).rejects.toThrow(
        InternalServerError,
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('custom baseURL', () => {
    it('uses custom baseURL in request URL', async () => {
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({
        apiKey: 'sk_test',
        fetch,
        baseURL: 'https://custom.api.example.com/v2',
      });

      await client.get('/documents/123');

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toBe('https://custom.api.example.com/v2/documents/123');
    });

    it('strips trailing slash from baseURL to avoid double slashes', async () => {
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({
        apiKey: 'sk_test',
        fetch,
        baseURL: 'https://custom.api.example.com/v2/',
      });

      await client.get('/documents/123');

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toBe('https://custom.api.example.com/v2/documents/123');
    });
  });

  describe('headers', () => {
    it('includes User-Agent with pdfmonkey-node/', async () => {
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await client.get('/documents/123');

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^pdfmonkey-node\//);
    });

    it('does not include Content-Type on GET requests', async () => {
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await client.get('/documents/123');

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    });

    it('includes Content-Type on POST requests with body', async () => {
      const fetch = mockFetch(201, { id: 'new' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await client.post('/documents', { body: { foo: 'bar' } });

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('does not include Content-Type on DELETE requests without body', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await client.delete('/documents/123');

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    });

    it('includes defaultHeaders in every request', async () => {
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({
        apiKey: 'sk_test',
        fetch,
        defaultHeaders: { 'X-Trace-Id': 'trace_abc', 'X-Custom': 'value' },
      });

      await client.get('/documents/123');

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Trace-Id']).toBe('trace_abc');
      expect(headers['X-Custom']).toBe('value');
      // Built-in headers should still be present
      expect(headers.Authorization).toBe('Bearer sk_test');
    });
  });

  describe('query params', () => {
    it('omits null and undefined query params from URL', async () => {
      const fetch = mockFetch(200, { data: [] });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await client.get('/documents', {
        query: { status: 'success', page: null, filter: undefined },
      });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get('status')).toBe('success');
      expect(parsed.searchParams.has('page')).toBe(false);
      expect(parsed.searchParams.has('filter')).toBe(false);
    });
  });

  describe('HTTP methods', () => {
    it('makes a PUT request directly', async () => {
      const fetch = mockFetch(200, { updated: true });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      const result = await client.put<{ updated: boolean }>('/documents/123', {
        body: { status: 'pending' },
      });

      expect(result).toEqual({ updated: true });
      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('PUT');
      expect(init.body).toBe(JSON.stringify({ status: 'pending' }));
    });

    it('makes a PATCH request directly', async () => {
      const fetch = mockFetch(200, { patched: true });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      const result = await client.patch<{ patched: boolean }>('/documents/123', {
        body: { name: 'new' },
      });

      expect(result).toEqual({ patched: true });
      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('PATCH');
    });
  });

  describe('custom fetch', () => {
    it('uses injected fetch function', async () => {
      const customFetch = mockFetch(200, { custom: true });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch: customFetch });

      const result = await client.get<{ custom: boolean }>('/test');
      expect(result).toEqual({ custom: true });
      expect(customFetch).toHaveBeenCalledOnce();
    });
  });

  describe('AbortSignal', () => {
    it('throws APIConnectionError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const fetch = vi.fn();
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

      await expect(client.get('/documents', { signal: controller.signal })).rejects.toThrow(
        APIConnectionError,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('aborts the request when signal fires', async () => {
      const controller = new AbortController();
      const fetch = vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, maxRetries: 0 });

      await expect(client.get('/documents', { signal: controller.signal })).rejects.toThrow(
        APIConnectionError,
      );
    });
  });

  describe('logger', () => {
    it('logs request and response at debug level', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const fetch = mockFetch(200, { id: '123' });
      const client = new PDFMonkey({ apiKey: 'sk_test', fetch, logger });

      await client.get('/documents/123');

      expect(logger.debug).toHaveBeenCalledWith(
        'Request',
        expect.objectContaining({
          method: 'GET',
          attempt: 0,
        }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Response',
        expect.objectContaining({
          method: 'GET',
          status: 200,
        }),
      );
    });
  });
});
