import type { ResourceRequestOptions } from '../client.js';
import { buildListQuery, fetchPage, type Page } from '../pagination.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TemplateFolder {
  readonly id: string;
  readonly app_id: string;
  readonly created_at: string;
  readonly identifier: string;
  readonly updated_at: string;
}

export interface TemplateFolderCreateParams {
  identifier: string;
}

export interface TemplateFolderUpdateParams {
  identifier?: string;
}

export interface TemplateFolderListParams {
  page?: number;
}

interface TemplateFolderResponse {
  template_folder: TemplateFolder;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Manage folders for organizing document templates. */
export class TemplateFolders extends APIResource {
  /** List template folders. Returns a paginated result. */
  async list(
    params?: TemplateFolderListParams,
    options?: ResourceRequestOptions,
  ): Promise<Page<TemplateFolder>> {
    const query = buildListQuery({}, { page: params?.page });
    return fetchPage<TemplateFolder>(this._client, '/template_folders', 'template_folders', {
      ...options,
      query,
    });
  }

  /** Retrieve a template folder by ID. */
  async get(id: string, options?: ResourceRequestOptions): Promise<TemplateFolder> {
    const response = await this._client.get<TemplateFolderResponse>(
      `/template_folders/${encodeURIComponent(id)}`,
      options,
    );
    return response.template_folder;
  }

  /** Create a new template folder. */
  async create(
    params: TemplateFolderCreateParams,
    options?: ResourceRequestOptions,
  ): Promise<TemplateFolder> {
    const response = await this._client.post<TemplateFolderResponse>('/template_folders', {
      ...options,
      body: { template_folder: params },
    });
    return response.template_folder;
  }

  /** Update a template folder by ID. Uses PUT. */
  async update(
    id: string,
    params: TemplateFolderUpdateParams,
    options?: ResourceRequestOptions,
  ): Promise<TemplateFolder> {
    const response = await this._client.put<TemplateFolderResponse>(
      `/template_folders/${encodeURIComponent(id)}`,
      {
        ...options,
        body: { template_folder: params },
      },
    );
    return response.template_folder;
  }

  /** Delete a template folder by ID. */
  async delete(id: string, options?: ResourceRequestOptions): Promise<void> {
    await this._client.delete(`/template_folders/${encodeURIComponent(id)}`, options);
  }
}
