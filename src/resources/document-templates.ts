import type { QueryValue, ResourceRequestOptions } from '../client.js';
import { fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DocumentTemplate {
  readonly id: string;
  readonly app_id: string;
  readonly auth_token: string;
  readonly body: string;
  readonly body_draft: string;
  readonly checksum: string;
  readonly created_at: string;
  readonly deleted_at: string | null;
  readonly edition_mode: string;
  readonly identifier: string;
  readonly output_type: string;
  readonly pdf_engine_draft_id: string;
  readonly pdf_engine_id: string;
  readonly preview_url: string;
  readonly sample_data: string;
  readonly sample_data_draft: string;
  readonly scss_style: string;
  readonly scss_style_draft: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly settings_draft: Readonly<Record<string, unknown>>;
  readonly template_folder_id: string | null;
  readonly ttl: number;
  readonly updated_at: string;
}

export interface DocumentTemplateCard {
  readonly id: string;
  readonly app_id: string;
  readonly auth_token: string;
  readonly created_at: string;
  readonly edition_mode: string;
  readonly identifier: string;
  readonly is_draft: boolean;
  readonly output_type: string;
  readonly pdf_engine_deprecated_on: string | null;
  readonly pdf_engine_name: string;
  readonly template_folder_id: string | null;
  readonly template_folder_identifier: string | null;
  readonly updated_at: string;
}

export interface DocumentTemplateCreateParams {
  identifier: string;
  body_draft?: string;
  scss_style_draft?: string;
  sample_data_draft?: string;
  settings_draft?: Record<string, unknown>;
  /**
   * Pin the template to a specific PDF rendering engine.
   *
   * Leave undefined in almost all cases — the API auto-selects the latest
   * engine, which is the right default. Override only when the end-user
   * explicitly asks for a specific engine version. Use `client.pdfEngines.list()`
   * to discover available engine IDs.
   */
  pdf_engine_draft_id?: string;
  template_folder_id?: string | null;
  ttl?: number;
  output_type?: string;
}

export interface DocumentTemplateUpdateParams {
  identifier?: string;
  body_draft?: string;
  scss_style_draft?: string;
  sample_data_draft?: string;
  settings_draft?: Record<string, unknown>;
  /**
   * Pin the template to a specific PDF rendering engine.
   *
   * Leave undefined in almost all cases — the API auto-selects the latest
   * engine, which is the right default. Override only when the end-user
   * explicitly asks for a specific engine version. Use `client.pdfEngines.list()`
   * to discover available engine IDs.
   */
  pdf_engine_draft_id?: string;
  template_folder_id?: string | null;
  ttl?: number;
  output_type?: string;
}

export interface DocumentTemplateListParams {
  page?: number;
  workspace_id?: string;
  folders?: string;
  sort?: string;
}

interface DocumentTemplateResponse {
  document_template: DocumentTemplate;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Manage document templates (HTML/CSS templates for PDF generation). */
export class DocumentTemplates extends APIResource {
  /** List document template cards. Returns a paginated result. */
  async list(
    params?: DocumentTemplateListParams,
    options?: ResourceRequestOptions,
  ): Promise<Page<DocumentTemplateCard>> {
    const query: Record<string, QueryValue> = {};
    if (params?.page !== undefined) {
      query['page[number]'] = params.page;
    }
    if (params?.workspace_id !== undefined) {
      query['q[workspace_id]'] = params.workspace_id;
    }
    if (params?.folders !== undefined) {
      query['q[folders]'] = params.folders;
    }
    if (params?.sort !== undefined) {
      query.sort = params.sort;
    }
    return fetchPage<DocumentTemplateCard>(
      this._client,
      '/document_template_cards',
      'document_template_cards',
      { ...options, query },
    );
  }

  /** Retrieve a document template by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<DocumentTemplate> {
    const response = await this._client.get<DocumentTemplateResponse>(
      `/document_templates/${encodeURIComponent(id)}`,
      options,
    );
    return response.document_template;
  }

  /** Create a new document template. */
  async create(
    params: DocumentTemplateCreateParams,
    options?: ResourceRequestOptions,
  ): Promise<DocumentTemplate> {
    const response = await this._client.post<DocumentTemplateResponse>('/document_templates', {
      ...options,
      body: { document_template: params },
    });
    return response.document_template;
  }

  /** Update a document template by ID. Uses PUT. */
  async update(
    id: string,
    params: DocumentTemplateUpdateParams,
    options?: ResourceRequestOptions,
  ): Promise<DocumentTemplate> {
    const response = await this._client.put<DocumentTemplateResponse>(
      `/document_templates/${encodeURIComponent(id)}`,
      {
        ...options,
        body: { document_template: params },
      },
    );
    return response.document_template;
  }

  /** Delete a document template by ID. */
  async delete(id: string, options?: ResourceRequestOptions): Promise<void> {
    await this._client.delete(`/document_templates/${encodeURIComponent(id)}`, options);
  }
}
