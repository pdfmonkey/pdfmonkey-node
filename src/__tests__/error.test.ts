import { describe, expect, it } from 'vitest';
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

// ── extractMessage via APIError.generate ───────────────────────────────────

describe('APIError.generate message extraction', () => {
  const headers = new Headers();

  it('extracts { error: "..." } (string error)', () => {
    const err = APIError.generate(400, headers, { error: 'Bad request' });
    expect(err.message).toBe('Bad request');
  });

  it('extracts { message: "..." }', () => {
    const err = APIError.generate(400, headers, { message: 'Something went wrong' });
    expect(err.message).toBe('Something went wrong');
  });

  it('extracts { error: { message: "..." } } (nested)', () => {
    const err = APIError.generate(400, headers, { error: { message: 'Nested error' } });
    expect(err.message).toBe('Nested error');
  });

  it('falls back when body is null', () => {
    const err = APIError.generate(400, headers, null);
    expect(err.message).toBe('Request failed with status 400');
  });

  it('falls back when body is a non-object (string)', () => {
    const err = APIError.generate(400, headers, 'raw string');
    expect(err.message).toBe('Request failed with status 400');
  });

  it('falls back when body is a non-object (number)', () => {
    const err = APIError.generate(400, headers, 42);
    expect(err.message).toBe('Request failed with status 400');
  });

  it('falls back when body is empty object (no error/message keys)', () => {
    const err = APIError.generate(400, headers, {});
    expect(err.message).toBe('Request failed with status 400');
  });
});

// ── Error class properties ────────────────────────────────────────────────

describe('Error class names', () => {
  const headers = new Headers();

  it('PDFMonkeyError.name', () => {
    expect(new PDFMonkeyError('test').name).toBe('PDFMonkeyError');
  });

  it('APIError.name', () => {
    expect(new APIError(400, headers, null, 'test').name).toBe('APIError');
  });

  it('BadRequestError.name', () => {
    expect(new BadRequestError(400, headers, null, 'test').name).toBe('BadRequestError');
  });

  it('AuthenticationError.name', () => {
    expect(new AuthenticationError(401, headers, null, 'test').name).toBe('AuthenticationError');
  });

  it('PermissionDeniedError.name', () => {
    expect(new PermissionDeniedError(403, headers, null, 'test').name).toBe(
      'PermissionDeniedError',
    );
  });

  it('NotFoundError.name', () => {
    expect(new NotFoundError(404, headers, null, 'test').name).toBe('NotFoundError');
  });

  it('UnprocessableEntityError.name', () => {
    expect(new UnprocessableEntityError(422, headers, null, 'test').name).toBe(
      'UnprocessableEntityError',
    );
  });

  it('RateLimitError.name', () => {
    expect(new RateLimitError(429, headers, null, 'test').name).toBe('RateLimitError');
  });

  it('InternalServerError.name', () => {
    expect(new InternalServerError(500, headers, null, 'test').name).toBe('InternalServerError');
  });

  it('APIConnectionError.name', () => {
    expect(new APIConnectionError('test').name).toBe('APIConnectionError');
  });
});

describe('APIError.generate status mapping', () => {
  const headers = new Headers();

  it('returns BadRequestError on 400', () => {
    const err = APIError.generate(400, headers, { error: 'Bad request' });
    expect(err).toBeInstanceOf(BadRequestError);
  });

  it('returns PermissionDeniedError on 403', () => {
    const err = APIError.generate(403, headers, { error: 'Forbidden' });
    expect(err).toBeInstanceOf(PermissionDeniedError);
  });
});

describe('APIError.body', () => {
  it('stores the original body', () => {
    const body = { error: 'Bad request', details: ['field is required'] };
    const err = new APIError(400, new Headers(), body, 'Bad request');
    expect(err.body).toBe(body);
  });
});

describe('APIError.requestId', () => {
  it('extracts x-request-id from headers', () => {
    const headers = new Headers({ 'x-request-id': 'req_abc123' });
    const err = new APIError(500, headers, null, 'Server error');
    expect(err.requestId).toBe('req_abc123');
  });

  it('is undefined when x-request-id header is absent', () => {
    const err = new APIError(500, new Headers(), null, 'Server error');
    expect(err.requestId).toBeUndefined();
  });
});

describe('APIError.toJSON', () => {
  it('returns a serializable object', () => {
    const headers = new Headers({ 'x-request-id': 'req_123' });
    const err = new APIError(400, headers, { error: 'Bad' }, 'Bad');
    const json = err.toJSON();

    expect(json.name).toBe('APIError');
    expect(json.message).toBe('Bad');
    expect(json.status).toBe(400);
    expect(json.requestId).toBe('req_123');
    expect(json.body).toEqual({ error: 'Bad' });
  });

  it('is used by JSON.stringify', () => {
    const err = new APIError(500, new Headers(), null, 'Error');
    const parsed = JSON.parse(JSON.stringify(err));
    expect(parsed.name).toBe('APIError');
    expect(parsed.status).toBe(500);
  });
});

describe('APIConnectionError.toJSON', () => {
  it('returns a serializable object', () => {
    const err = new APIConnectionError('Connection failed');
    const json = err.toJSON();

    expect(json.name).toBe('APIConnectionError');
    expect(json.message).toBe('Connection failed');
  });
});

describe('APIConnectionError.cause', () => {
  it('stores the original cause via native Error.cause', () => {
    const cause = new TypeError('fetch failed');
    const err = new APIConnectionError('Connection error', { cause });
    expect(err.cause).toBe(cause);
  });

  it('cause is undefined when not provided', () => {
    const err = new APIConnectionError('Connection error');
    expect(err.cause).toBeUndefined();
  });
});

describe('PDFMonkeyError.cause', () => {
  it('supports ErrorOptions with cause', () => {
    const cause = new Error('underlying');
    const err = new PDFMonkeyError('wrapper', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('RateLimitError.retryAfter', () => {
  it('is undefined without retry-after header', () => {
    const err = new RateLimitError(429, new Headers(), null, 'Rate limited');
    expect(err.retryAfter).toBeUndefined();
  });

  it('is undefined with non-numeric retry-after header', () => {
    const headers = new Headers({ 'retry-after': 'not-a-number' });
    const err = new RateLimitError(429, headers, null, 'Rate limited');
    expect(err.retryAfter).toBeUndefined();
  });

  it('parses numeric retry-after header', () => {
    const headers = new Headers({ 'retry-after': '30' });
    const err = new RateLimitError(429, headers, null, 'Rate limited');
    expect(err.retryAfter).toBe(30);
  });

  it('rejects negative retry-after header', () => {
    const headers = new Headers({ 'retry-after': '-5' });
    const err = new RateLimitError(429, headers, null, 'Rate limited');
    expect(err.retryAfter).toBeUndefined();
  });

  it('accepts zero retry-after header', () => {
    const headers = new Headers({ 'retry-after': '0' });
    const err = new RateLimitError(429, headers, null, 'Rate limited');
    expect(err.retryAfter).toBe(0);
  });
});
