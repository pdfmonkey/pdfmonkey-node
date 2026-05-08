import type { PDFMonkey, QueryValue, RequestOptions } from './client.js';
import { PDFMonkeyError } from './error.js';

export interface PaginationMeta {
  readonly current_page: number;
  readonly total_pages: number;
  readonly next_page: number | null;
  readonly prev_page: number | null;
}

/** A page of results from a paginated list endpoint. */
export class Page<T> {
  readonly data: readonly T[];
  readonly meta: PaginationMeta;
  readonly #client: PDFMonkey;
  readonly #path: string;
  readonly #query: Record<string, QueryValue>;
  readonly #extractKey: string;

  constructor(
    client: PDFMonkey,
    path: string,
    query: Record<string, QueryValue>,
    data: T[],
    meta: PaginationMeta,
    extractKey: string,
  ) {
    this.#client = client;
    this.#path = path;
    this.#query = query;
    this.data = data;
    this.meta = meta;
    this.#extractKey = extractKey;
  }

  get currentPage(): number {
    return this.meta.current_page;
  }

  get totalPages(): number {
    return this.meta.total_pages;
  }

  /** Whether there is a next page of results. */
  hasNextPage(): boolean {
    return this.meta.next_page !== null;
  }

  /** Whether there is a previous page of results. */
  hasPreviousPage(): boolean {
    return this.meta.prev_page !== null;
  }

  /** Fetch the next page. Throws if no next page exists. */
  async getNextPage(): Promise<Page<T>> {
    if (!this.hasNextPage()) {
      throw new PDFMonkeyError('No next page available');
    }
    return fetchPage<T>(this.#client, this.#path, this.#extractKey, {
      query: { ...this.#query, 'page[number]': this.meta.next_page },
    });
  }

  /** Fetch the previous page. Throws if no previous page exists. */
  async getPreviousPage(): Promise<Page<T>> {
    if (!this.hasPreviousPage()) {
      throw new PDFMonkeyError('No previous page available');
    }
    return fetchPage<T>(this.#client, this.#path, this.#extractKey, {
      query: { ...this.#query, 'page[number]': this.meta.prev_page },
    });
  }

  /** Fetch a specific page number. Throws if `n` is outside [1, totalPages]. */
  async getPage(n: number): Promise<Page<T>> {
    if (!Number.isInteger(n) || n < 1) {
      throw new PDFMonkeyError(`Invalid page number: ${n}`);
    }
    if (n > this.meta.total_pages) {
      throw new PDFMonkeyError(`Page ${n} is out of range (total pages: ${this.meta.total_pages})`);
    }
    return fetchPage<T>(this.#client, this.#path, this.#extractKey, {
      query: { ...this.#query, 'page[number]': n },
    });
  }

  /** Iterate over each {@link Page} starting from this one. */
  async *pages(): AsyncIterableIterator<Page<T>> {
    let page: Page<T> = this;
    while (true) {
      yield page;
      if (!page.hasNextPage()) break;
      page = await page.getNextPage();
    }
  }

  /** Iterate over items in this page. */
  [Symbol.iterator](): IterableIterator<T> {
    return this.data[Symbol.iterator]();
  }

  /** Iterate over all items across all pages (auto-fetches next pages). */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    let page: Page<T> = this;
    while (true) {
      for (const item of page.data) {
        yield item;
      }
      if (!page.hasNextPage()) break;
      page = await page.getNextPage();
    }
  }
}

/**
 * Build a Record<string, QueryValue> from an `q[...]` filter map plus an
 * optional `page[number]`. Skips entries whose value is undefined so
 * callers do not have to test each one.
 */
export function buildListQuery(
  filters: Record<string, QueryValue | undefined> = {},
  options: { page?: number | undefined; sort?: string | undefined } = {},
): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      query[`q[${key}]`] = value;
    }
  }
  if (options.page !== undefined) {
    query['page[number]'] = options.page;
  }
  if (options.sort !== undefined) {
    query.sort = options.sort;
  }
  return query;
}

type PaginatedResponse = Record<string, unknown> & {
  meta: PaginationMeta;
};

/** Fetch a paginated list endpoint and return a `Page<T>`. */
export async function fetchPage<T>(
  client: PDFMonkey,
  path: string,
  extractKey: string,
  opts?: RequestOptions,
): Promise<Page<T>> {
  const response = await client.get<PaginatedResponse>(path, opts);
  const data = response[extractKey];
  if (!Array.isArray(data)) {
    throw new PDFMonkeyError(`Invalid paginated response: expected "${extractKey}" to be an array`);
  }
  if (!response.meta || typeof response.meta.current_page !== 'number') {
    throw new PDFMonkeyError('Invalid paginated response: missing or malformed "meta"');
  }
  return new Page<T>(client, path, opts?.query ?? {}, data as T[], response.meta, extractKey);
}
