import type { ResourceRequestOptions } from '../client.js';
import { buildListQuery, fetchAll, fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Workspace {
  readonly id: string;
  readonly identifier: string;
  readonly invite_token: string;
}

export interface WorkspaceListParams {
  page?: number;
}

// Workspaces are still called "apps" in API payloads.

// ── Resource ───────────────────────────────────────────────────────────────

/** Read-only access to workspaces. */
export class Workspaces extends APIResource {
  /** List workspaces. Returns a paginated result. */
  async list(
    params?: WorkspaceListParams,
    options?: ResourceRequestOptions,
  ): Promise<Page<Workspace>> {
    const query = buildListQuery({}, { page: params?.page });
    return fetchPage<Workspace>(this._client, '/workspaces', 'apps', { ...options, query });
  }

  /** List all workspaces in a single request. */
  async listAll(options?: ResourceRequestOptions): Promise<Workspace[]> {
    return fetchAll<Workspace>(this._client, '/workspaces', 'apps', options);
  }

  /** Retrieve a workspace by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<Workspace> {
    const response = await this._client.get<{ app: Workspace }>(
      `/workspaces/${encodeURIComponent(id)}`,
      options,
    );
    return response.app;
  }
}
