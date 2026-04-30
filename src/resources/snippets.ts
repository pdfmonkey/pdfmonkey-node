import type { QueryValue } from '../client.js';
import { fetchPage, type Page } from '../pagination.js';
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
  page?: number;
}

interface SnippetResponse {
  snippet: Snippet;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Manage reusable HTML snippets shared across templates. */
export class Snippets extends APIResource {
  /** List snippets. Returns a paginated result. */
  async list(params?: SnippetListParams): Promise<Page<Snippet>> {
    const query: Record<string, QueryValue> = {};
    if (params?.page !== undefined) {
      query['page[number]'] = params.page;
    }
    return fetchPage<Snippet>(this._client, '/snippets', 'snippets', { query });
  }

  /** Retrieve a snippet by ID. */
  async get(id: string): Promise<Snippet> {
    const response = await this._client.get<SnippetResponse>(`/snippets/${encodeURIComponent(id)}`);
    return response.snippet;
  }

  /** Create a new snippet. */
  async create(params: SnippetCreateParams): Promise<Snippet> {
    const response = await this._client.post<SnippetResponse>('/snippets', {
      body: { snippet: params },
    });
    return response.snippet;
  }

  /** Update a snippet by ID. Uses PUT. */
  async update(id: string, params: SnippetUpdateParams): Promise<Snippet> {
    const response = await this._client.put<SnippetResponse>(
      `/snippets/${encodeURIComponent(id)}`,
      {
        body: { snippet: params },
      },
    );
    return response.snippet;
  }

  /** Delete a snippet by ID. */
  async delete(id: string): Promise<void> {
    await this._client.delete(`/snippets/${encodeURIComponent(id)}`);
  }
}
