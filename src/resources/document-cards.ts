import type { ResourceRequestOptions } from '../client.js';
import { buildListQuery, fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';
import type { DocumentStatus } from './documents.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DocumentCard {
  readonly id: string;
  readonly app_id: string;
  readonly created_at: string;
  readonly document_template_id: string;
  readonly document_template_identifier: string;
  readonly download_url: string | null;
  readonly failure_cause: string | null;
  readonly filename: string | null;
  readonly meta: string | null;
  readonly output_type: string;
  readonly preview_url: string;
  readonly public_share_link: string | null;
  readonly status: DocumentStatus;
  readonly updated_at: string;
}

export interface DocumentCardListParams {
  page?: number;
  document_template_id?: string;
  status?: DocumentStatus;
  workspace_id?: string;
  updated_since?: number;
}

interface DocumentCardResponse {
  document_card: DocumentCard;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Read-only access to document cards (lightweight document summaries). */
export class DocumentCards extends APIResource {
  /** List document cards with optional filters. Returns a paginated result. */
  async list(
    params?: DocumentCardListParams,
    options?: ResourceRequestOptions,
  ): Promise<Page<DocumentCard>> {
    const query = buildListQuery(
      {
        document_template_id: params?.document_template_id,
        status: params?.status,
        workspace_id: params?.workspace_id,
        updated_since: params?.updated_since,
      },
      { page: params?.page },
    );
    return fetchPage<DocumentCard>(this._client, '/document_cards', 'document_cards', {
      ...options,
      query,
    });
  }

  /** Retrieve a document card by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<DocumentCard> {
    const response = await this._client.get<DocumentCardResponse>(
      `/document_cards/${encodeURIComponent(id)}`,
      options,
    );
    return response.document_card;
  }
}
