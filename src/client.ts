import { APIConnectionError, APIError, PDFMonkeyError } from './error.js';
import { CurrentUserResource } from './resources/current-user.js';
import { DocumentCards } from './resources/document-cards.js';
import { DocumentTemplates } from './resources/document-templates.js';
import { Documents } from './resources/documents.js';
import { PdfEngines } from './resources/pdf-engines.js';
import { RestHooks } from './resources/rest-hooks.js';
import { Snippets } from './resources/snippets.js';
import { TemplateFolders } from './resources/template-folders.js';
import { Workspaces } from './resources/workspaces.js';
import { VERSION } from './version.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  /** Defaults to `process.env.PDFMONKEY_API_KEY` when omitted. */
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  fetch?: Fetch;
  logger?: Logger;
  defaultHeaders?: Record<string, string>;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  body?: Record<string, unknown>;
  query?: Record<string, QueryValue>;
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  /** Per-request headers, merged on top of defaults. */
  headers?: Record<string, string>;
  /** Sent as the `Idempotency-Key` header. */
  idempotencyKey?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.pdfmonkey.io/api/v1';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 5_000;
const USER_AGENT = buildUserAgent();

// ── Client ─────────────────────────────────────────────────────────────────

/** PDFMonkey API client. Instantiate with an API key or options object. */
export class PDFMonkey {
  readonly #apiKey: string;
  readonly baseURL: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly #fetch: Fetch;
  readonly #logger: Logger | undefined;
  readonly #defaultHeaders: Record<string, string>;

  readonly documents: Documents;
  readonly documentCards: DocumentCards;
  readonly documentTemplates: DocumentTemplates;
  readonly pdfEngines: PdfEngines;
  readonly restHooks: RestHooks;
  readonly templateFolders: TemplateFolders;
  readonly workspaces: Workspaces;
  readonly snippets: Snippets;
  readonly currentUser: CurrentUserResource;

  constructor(options?: ClientOptions | string) {
    const opts: ClientOptions =
      typeof options === 'string' ? { apiKey: options } : (options ?? {});
    const apiKey = opts.apiKey ?? readApiKeyFromEnv();

    if (!apiKey?.trim()) {
      throw new PDFMonkeyError(
        'The PDFMonkey API key must be provided. Pass it as a string, ' +
          'as { apiKey: "..." }, or set PDFMONKEY_API_KEY in the environment.',
      );
    }

    this.#apiKey = apiKey;
    this.baseURL = (opts.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (this.timeout <= 0) {
      throw new PDFMonkeyError('timeout must be a positive number');
    }
    if (this.maxRetries < 0) {
      throw new PDFMonkeyError('maxRetries must be >= 0');
    }
    this.#fetch = opts.fetch ?? getFetch();
    this.#logger = opts.logger;
    this.#defaultHeaders = opts.defaultHeaders ?? {};

    // Validate baseURL early to avoid confusing errors on first request
    try {
      new URL(this.baseURL);
    } catch {
      throw new PDFMonkeyError(`Invalid baseURL: ${this.baseURL}`);
    }

    this.documents = new Documents(this);
    this.documentCards = new DocumentCards(this);
    this.documentTemplates = new DocumentTemplates(this);
    this.pdfEngines = new PdfEngines(this);
    this.restHooks = new RestHooks(this);
    this.templateFolders = new TemplateFolders(this);
    this.workspaces = new Workspaces(this);
    this.snippets = new Snippets(this);
    this.currentUser = new CurrentUserResource(this);
  }

  // ── HTTP Methods ───────────────────────────────────────────────────────

  /** Send a GET request. */
  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, opts);
  }

  /** Send a POST request. */
  async post<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, opts);
  }

  /** Send a PATCH request. */
  async patch<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, opts);
  }

  /** Send a PUT request. */
  async put<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, opts);
  }

  /** Send a DELETE request. Returns void for 204 responses. */
  async delete(path: string, opts?: RequestOptions): Promise<void> {
    await this.request<void>('DELETE', path, opts);
  }

  // ── Core Request Engine ────────────────────────────────────────────────

  private async request<T>(method: HttpMethod, path: string, opts?: RequestOptions): Promise<T> {
    const url = buildURL(this.baseURL, path, opts?.query);
    const maxRetries = opts?.maxRetries ?? this.maxRetries;
    const timeout = opts?.timeout ?? this.timeout;
    const callerSignal = opts?.signal;

    const headers: Record<string, string> = {
      ...this.#defaultHeaders,
      ...opts?.headers,
      Authorization: `Bearer ${this.#apiKey}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    };

    if (opts?.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }

    const body: string | null = opts?.body !== undefined ? JSON.stringify(opts.body) : null;

    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    let lastError: PDFMonkeyError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (callerSignal?.aborted) {
        throw new APIConnectionError('Request aborted', { cause: callerSignal.reason });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Compose caller-provided signal with timeout controller
      let onAbort: (() => void) | undefined;
      if (callerSignal) {
        onAbort = () => controller.abort(callerSignal.reason);
        callerSignal.addEventListener('abort', onAbort, { once: true });
      }

      this.#logger?.debug('Request', {
        method,
        url,
        attempt,
      });

      try {
        const response = await this.#fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        this.#logger?.debug('Response', {
          method,
          url,
          status: response.status,
        });

        if (response.ok) {
          clearTimeout(timeoutId);
          if (onAbort) callerSignal?.removeEventListener('abort', onAbort);
          if (response.status === 204) {
            return undefined as T;
          }
          try {
            return (await response.json()) as T;
          } catch (err) {
            throw new PDFMonkeyError('Failed to parse response body as JSON', { cause: err });
          }
        }

        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = undefined;
        }
        clearTimeout(timeoutId);
        if (onAbort) callerSignal?.removeEventListener('abort', onAbort);

        const apiError = APIError.generate(response.status, response.headers, errorBody);

        if (!isRetryableStatus(response.status) || attempt === maxRetries) {
          throw apiError;
        }

        lastError = apiError;

        const retryDelay = getRetryDelay(attempt, response.headers);
        this.#logger?.debug('Retrying', {
          attempt: attempt + 1,
          delay: retryDelay,
        });
        await abortableSleep(retryDelay, callerSignal);
      } catch (error) {
        clearTimeout(timeoutId);
        if (onAbort) callerSignal?.removeEventListener('abort', onAbort);

        if (error instanceof APIError || error instanceof PDFMonkeyError) {
          throw error;
        }

        const connectionError = new APIConnectionError(
          `Connection error: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );

        if (attempt === maxRetries) {
          throw connectionError;
        }

        lastError = connectionError;

        const retryDelay = getRetryDelay(attempt);
        this.#logger?.debug('Retrying after connection error', {
          attempt: attempt + 1,
          delay: retryDelay,
        });
        await abortableSleep(retryDelay, callerSignal);
      }
    }

    throw lastError ?? new APIConnectionError('Request failed after retries');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildURL(baseURL: string, path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseURL}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelay(attempt: number, headers?: Headers): number {
  if (headers) {
    const retryAfter = headers.get('retry-after');
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, MAX_RETRY_DELAY);
      }
    }
  }

  // Exponential backoff with full jitter
  const exponentialDelay = INITIAL_RETRY_DELAY * 2 ** attempt;
  const capped = Math.min(exponentialDelay, MAX_RETRY_DELAY);
  return Math.max(INITIAL_RETRY_DELAY / 2, Math.random() * capped);
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new APIConnectionError('Request aborted', { cause: signal.reason }));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new APIConnectionError('Request aborted', { cause: signal?.reason }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function getFetch(): Fetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new PDFMonkeyError(
      'No global fetch available. Pass a custom fetch function via the fetch option.',
    );
  }
  return globalThis.fetch.bind(globalThis) as Fetch;
}

function readApiKeyFromEnv(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.PDFMONKEY_API_KEY;
}

function buildUserAgent(): string {
  const proc = (globalThis as { process?: { version?: string; platform?: string; arch?: string } })
    .process;
  const parts = [`pdfmonkey-node/${VERSION}`];
  if (proc?.version) parts.push(`node/${proc.version.replace(/^v/, '')}`);
  if (proc?.platform) parts.push(proc.platform);
  if (proc?.arch) parts.push(proc.arch);
  return parts.join(' ');
}
