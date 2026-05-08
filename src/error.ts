const NODE_INSPECT = Symbol.for('nodejs.util.inspect.custom');

/** Base error class for all PDFMonkey SDK errors. */
export class PDFMonkeyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PDFMonkeyError';
  }
}

Object.defineProperty(PDFMonkeyError.prototype, NODE_INSPECT, {
  value: function inspect(this: PDFMonkeyError): string {
    return `${this.name}: ${this.message}`;
  },
});

/** Error returned by the PDFMonkey API with HTTP status, headers, and body. */
export class APIError extends PDFMonkeyError {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
  readonly requestId: string | undefined;

  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.headers = headers;
    this.body = body;
    this.requestId = headers.get('x-request-id') ?? undefined;
  }

  static generate(status: number, headers: Headers, body: unknown): APIError {
    const message = extractMessage(body) ?? `Request failed with status ${status}`;

    if (status === 400) {
      return new BadRequestError(status, headers, body, message);
    }
    if (status === 401) {
      return new AuthenticationError(status, headers, body, message);
    }
    if (status === 403) {
      return new PermissionDeniedError(status, headers, body, message);
    }
    if (status === 404) {
      return new NotFoundError(status, headers, body, message);
    }
    if (status === 422) {
      return new UnprocessableEntityError(status, headers, body, message);
    }
    if (status === 429) {
      return new RateLimitError(status, headers, body, message);
    }
    if (status === 502) {
      return new BadGatewayError(status, headers, body, message);
    }
    if (status === 503) {
      return new ServiceUnavailableError(status, headers, body, message);
    }
    if (status === 504) {
      return new GatewayTimeoutError(status, headers, body, message);
    }
    if (status >= 500) {
      return new InternalServerError(status, headers, body, message);
    }
    return new APIError(status, headers, body, message);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
      body: this.body,
    };
  }
}

Object.defineProperty(APIError.prototype, NODE_INSPECT, {
  value: function inspect(this: APIError): string {
    const reqId = this.requestId ? ` requestId=${this.requestId}` : '';
    return `${this.name} [${this.status}]${reqId}: ${this.message}`;
  },
});

/** Thrown on 400 — bad request / validation error. */
export class BadRequestError extends APIError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'BadRequestError';
  }
}

/** Thrown on 401 — invalid or missing API key. */
export class AuthenticationError extends APIError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'AuthenticationError';
  }
}

/** Thrown on 403 — insufficient permissions. */
export class PermissionDeniedError extends APIError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'PermissionDeniedError';
  }
}

/** Thrown on 404 — resource not found. */
export class NotFoundError extends APIError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'NotFoundError';
  }
}

/** Thrown on 422 — validation error. */
export class UnprocessableEntityError extends APIError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'UnprocessableEntityError';
  }
}

/** Thrown on 429 — rate limit exceeded. Check `retryAfter` for seconds to wait. */
export class RateLimitError extends APIError {
  readonly retryAfter: number | undefined;

  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'RateLimitError';

    const retryAfterHeader = headers.get('retry-after');
    if (retryAfterHeader !== null) {
      const parsed = Number(retryAfterHeader);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        this.retryAfter = parsed;
      }
    }
  }
}

/** Thrown on 500+ that are not 502/503/504 — server error. */
export class InternalServerError extends APIError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'InternalServerError';
  }
}

/** Thrown on 502 — bad gateway, an upstream PDFMonkey service is unreachable. */
export class BadGatewayError extends InternalServerError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'BadGatewayError';
  }
}

/** Thrown on 503 — service unavailable, typically transient. */
export class ServiceUnavailableError extends InternalServerError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'ServiceUnavailableError';
  }
}

/** Thrown on 504 — gateway timeout from a PDFMonkey upstream. */
export class GatewayTimeoutError extends InternalServerError {
  constructor(status: number, headers: Headers, body: unknown, message: string) {
    super(status, headers, body, message);
    this.name = 'GatewayTimeoutError';
  }
}

/** Thrown on network failures (no HTTP response). Check `cause` for the original error. */
export class APIConnectionError extends PDFMonkeyError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'APIConnectionError';
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
    };
  }
}

function extractMessage(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.error === 'string') {
      return record.error;
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (typeof record.error === 'object' && record.error !== null) {
      const errorObj = record.error as Record<string, unknown>;
      if (typeof errorObj.message === 'string') {
        return errorObj.message;
      }
    }
  }
  return undefined;
}
