import type { ResourceRequestOptions } from '../client.js';
import { buildListQuery, fetchAll, fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkspaceCard {
  readonly id: string;
  readonly identifier: string;
  readonly invite_token: string;
  readonly updated_at: string;
  /** Plan of the workspace's admin. */
  readonly current_plan: string;
}

export interface WorkspaceCardListParams {
  page?: number;
}

export interface WorkspaceCardUpdateParams {
  identifier?: string;
}

interface WorkspaceCardResponse {
  workspace_card: WorkspaceCard;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Workspace summaries, including the admin's plan. */
export class WorkspaceCards extends APIResource {
  /** List workspace cards. Returns a paginated result. */
  async list(
    params?: WorkspaceCardListParams,
    options?: ResourceRequestOptions,
  ): Promise<Page<WorkspaceCard>> {
    const query = buildListQuery({}, { page: params?.page });
    return fetchPage<WorkspaceCard>(this._client, '/workspace_cards', 'workspace_cards', {
      ...options,
      query,
    });
  }

  /** List all workspace cards in a single request. */
  async listAll(options?: ResourceRequestOptions): Promise<WorkspaceCard[]> {
    return fetchAll<WorkspaceCard>(this._client, '/workspace_cards', 'workspace_cards', options);
  }

  /** Update a workspace by ID. Uses PUT. */
  async update(
    id: string,
    params: WorkspaceCardUpdateParams,
    options?: ResourceRequestOptions,
  ): Promise<WorkspaceCard> {
    const response = await this._client.put<WorkspaceCardResponse>(
      `/workspace_cards/${encodeURIComponent(id)}`,
      { ...options, body: { workspace_card: params } },
    );
    return response.workspace_card;
  }
}
