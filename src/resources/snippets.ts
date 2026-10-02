import type { ResourceRequestOptions } from '../client.js';
import { buildListQuery, fetchAll, fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Snippet {
  readonly id: string;
  readonly identifier: string;
  readonly code: string;
  readonly workspace_id: string;
  readonly created_at: string;
  readonly creator_name: string;
  readonly updated_at: string;
  readonly updater_name: string;
}

export interface SnippetCreateParams {
  identifier: string;
  code: string;
  workspace_id: string;
}

export interface SnippetUpdateParams {
  identifier?: string;
  code?: string;
}

export interface SnippetListParams {
  /** Required: the API returns no snippets without a workspace filter. */
  workspace_id: string;
  page?: number;
}

interface SnippetResponse {
  snippet: Snippet;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Manage reusable HTML snippets shared across templates. */
export class Snippets extends APIResource {
  /** List a workspace's snippets. Returns a paginated result. */
  async list(params: SnippetListParams, options?: ResourceRequestOptions): Promise<Page<Snippet>> {
    const query = buildListQuery({ workspace_id: params.workspace_id }, { page: params.page });
    return fetchPage<Snippet>(this._client, '/snippets', 'snippets', { ...options, query });
  }

  /** List all of a workspace's snippets in a single request. */
  async listAll(
    params: Omit<SnippetListParams, 'page'>,
    options?: ResourceRequestOptions,
  ): Promise<Snippet[]> {
    const query = buildListQuery({ workspace_id: params.workspace_id });
    return fetchAll<Snippet>(this._client, '/snippets', 'snippets', { ...options, query });
  }

  /** Retrieve a snippet by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<Snippet> {
    const response = await this._client.get<SnippetResponse>(
      `/snippets/${encodeURIComponent(id)}`,
      options,
    );
    return response.snippet;
  }

  /** Create a new snippet. */
  async create(params: SnippetCreateParams, options?: ResourceRequestOptions): Promise<Snippet> {
    const response = await this._client.post<SnippetResponse>('/snippets', {
      ...options,
      body: { snippet: params },
    });
    return response.snippet;
  }

  /** Update a snippet by ID. Uses PUT. */
  async update(
    id: string,
    params: SnippetUpdateParams,
    options?: ResourceRequestOptions,
  ): Promise<Snippet> {
    const response = await this._client.put<SnippetResponse>(
      `/snippets/${encodeURIComponent(id)}`,
      {
        ...options,
        body: { snippet: params },
      },
    );
    return response.snippet;
  }

  /** Delete a snippet by ID. */
  async delete(id: string, options?: ResourceRequestOptions): Promise<void> {
    await this._client.delete(`/snippets/${encodeURIComponent(id)}`, options);
  }
}
