import type { QueryValue, ResourceRequestOptions } from '../client.js';
import { fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Workspace {
  readonly id: string;
  readonly created_at: string;
  readonly identifier: string;
  readonly invite_token: string;
  readonly updated_at: string;
}

export interface WorkspaceListParams {
  page?: number;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Read-only access to workspaces. */
export class Workspaces extends APIResource {
  /** List workspaces. Returns a paginated result. */
  async list(
    params?: WorkspaceListParams,
    options?: ResourceRequestOptions,
  ): Promise<Page<Workspace>> {
    const query: Record<string, QueryValue> = {};
    if (params?.page !== undefined) {
      query['page[number]'] = params.page;
    }
    return fetchPage<Workspace>(this._client, '/workspaces', 'workspaces', { ...options, query });
  }

  /** Retrieve a workspace by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<Workspace> {
    const response = await this._client.get<{ workspace: Workspace }>(
      `/workspaces/${encodeURIComponent(id)}`,
      options,
    );
    return response.workspace;
  }
}
