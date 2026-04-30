import type { QueryValue } from '../client.js';
import { fetchPage, type Page } from '../pagination.js';
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
  async list(params?: DocumentCardListParams): Promise<Page<DocumentCard>> {
    const query: Record<string, QueryValue> = {};
    if (params?.page !== undefined) {
      query['page[number]'] = params.page;
    }
    if (params?.document_template_id !== undefined) {
      query['q[document_template_id]'] = params.document_template_id;
    }
    if (params?.status !== undefined) {
      query['q[status]'] = params.status;
    }
    if (params?.workspace_id !== undefined) {
      query['q[workspace_id]'] = params.workspace_id;
    }
    if (params?.updated_since !== undefined) {
      query['q[updated_since]'] = params.updated_since;
    }
    return fetchPage<DocumentCard>(this._client, '/document_cards', 'document_cards', { query });
  }

  /** Retrieve a document card by ID. */
  async get(id: string): Promise<DocumentCard> {
    const response = await this._client.get<DocumentCardResponse>(
      `/document_cards/${encodeURIComponent(id)}`,
    );
    return response.document_card;
  }
}
