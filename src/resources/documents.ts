import type { ResourceRequestOptions } from '../client.js';
import { PDFMonkeyError } from '../error.js';
import { APIResource } from '../resource.js';
import type { DocumentCard } from './document-cards.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type DocumentStatus = 'draft' | 'pending' | 'generating' | 'success' | 'failure' | 'error';

export interface Document {
  readonly id: string;
  readonly app_id: string;
  readonly checksum: string;
  readonly created_at: string;
  readonly document_template_id: string;
  readonly download_url: string | null;
  readonly failure_cause: string | null;
  readonly filename: string | null;
  readonly generation_logs: ReadonlyArray<{
    readonly type: string;
    readonly message: string;
    readonly timestamp: string;
  }>;
  readonly meta: string | null;
  readonly output_type: string;
  readonly payload: string | null;
  readonly preview_url: string;
  readonly public_share_link: string | null;
  readonly status: DocumentStatus;
  readonly updated_at: string;
}

export interface DocumentMeta {
  /** Encrypts the generated PDF with a password (AES-256). */
  _password?: string;
  /** Sets the filename of the generated PDF. */
  _filename?: string;
  /** Additional custom metadata. */
  [key: string]: unknown;
}

export interface DocumentCreateParams {
  document_template_id: string;
  payload?: string;
  meta?: string | DocumentMeta;
  status?: 'draft' | 'pending';
}

export interface DocumentUpdateParams {
  document_template_id?: string;
  payload?: string;
  meta?: string | DocumentMeta;
  status?: 'draft' | 'pending';
}

export interface GenerateSyncParams {
  document_template_id: string;
  payload?: string;
  meta?: string | DocumentMeta;
}

export interface GenerateSyncOptions {
  /** Request timeout in milliseconds. Defaults to 120_000 (2 minutes). */
  timeout?: number;
}

export interface WaitForGenerationOptions {
  interval?: number;
  timeout?: number;
  signal?: AbortSignal;
}

interface DocumentResponse {
  document: Document;
}

interface DocumentCardResponse {
  document_card: DocumentCard;
}

// ── Resource ───────────────────────────────────────────────────────────────

/**
 * Manage PDF documents — create, read, update, delete, and generate.
 * To list documents, use `client.documentCards.list()` which returns
 * lightweight document summaries with pagination support.
 */
export class Documents extends APIResource {
  /** Create a new document. Set `status: 'pending'` to start generation immediately. */
  async create(params: DocumentCreateParams, options?: ResourceRequestOptions): Promise<Document> {
    const response = await this._client.post<DocumentResponse>('/documents', {
      ...options,
      body: { document: serializeParams(params) },
    });
    return response.document;
  }

  /** Retrieve a document by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<Document> {
    const response = await this._client.get<DocumentResponse>(
      `/documents/${encodeURIComponent(id)}`,
      options,
    );
    return response.document;
  }

  /** Update a document by ID. Uses PUT. */
  async update(
    id: string,
    params: DocumentUpdateParams,
    options?: ResourceRequestOptions,
  ): Promise<Document> {
    const response = await this._client.put<DocumentResponse>(
      `/documents/${encodeURIComponent(id)}`,
      {
        ...options,
        body: { document: serializeParams(params) },
      },
    );
    return response.document;
  }

  /** Delete a document by ID. */
  async delete(id: string, options?: ResourceRequestOptions): Promise<void> {
    await this._client.delete(`/documents/${encodeURIComponent(id)}`, options);
  }

  /** Generate a PDF synchronously. Blocks until the PDF is ready and returns a DocumentCard. */
  async generateSync(
    params: GenerateSyncParams,
    options?: GenerateSyncOptions & ResourceRequestOptions,
  ): Promise<DocumentCard> {
    const response = await this._client.post<DocumentCardResponse>('/documents/sync', {
      ...options,
      body: { document: { ...serializeParams(params), status: 'pending' } },
      timeout: options?.timeout ?? 120_000,
    });
    return response.document_card;
  }

  /** Poll a document until generation succeeds, fails, or times out. */
  async waitForGeneration(id: string, options?: WaitForGenerationOptions): Promise<Document> {
    const interval = options?.interval ?? 2000;
    const timeout = options?.timeout ?? 120_000;
    const signal = options?.signal;

    if (interval <= 0) {
      throw new PDFMonkeyError('waitForGeneration interval must be a positive number');
    }
    if (timeout <= 0) {
      throw new PDFMonkeyError('waitForGeneration timeout must be a positive number');
    }

    const start = Date.now();

    while (true) {
      if (signal?.aborted) {
        throw new PDFMonkeyError('waitForGeneration aborted');
      }

      const doc = await this.get(id, signal ? { signal } : undefined);

      if (doc.status === 'success') {
        return doc;
      }

      if (doc.status === 'failure' || doc.status === 'error') {
        throw new PDFMonkeyError(
          `Document generation failed: ${doc.failure_cause ?? 'Unknown error'}`,
        );
      }

      if (Date.now() - start + interval > timeout) {
        throw new PDFMonkeyError(
          `Document generation timed out after ${timeout}ms (status: ${doc.status})`,
        );
      }

      await abortableSleep(interval, signal);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PDFMonkeyError('waitForGeneration aborted'));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new PDFMonkeyError('waitForGeneration aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function serializeParams<T extends { meta?: string | DocumentMeta }>(
  params: T,
): Record<string, unknown> {
  const { meta, ...rest } = params;
  if (meta === undefined || typeof meta === 'string') {
    return meta === undefined ? { ...rest } : { ...rest, meta };
  }
  return { ...rest, meta: JSON.stringify(meta) };
}
