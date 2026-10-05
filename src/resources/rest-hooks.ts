import type { ResourceRequestOptions } from '../client.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type RestHookEvent =
  | 'documents.generation.success'
  | 'documents.generation.failure'
  | (string & {});

export interface RestHook {
  readonly id: string;
  readonly url: string;
  /** Comma-separated list of subscribed events, as stored by the API. */
  readonly event: string;
  readonly platform: string;
  readonly workspace_id: string;
  readonly document_template_ids: readonly string[];
  readonly custom_channel: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface RestHookCreateParams {
  url: string;
  workspace_id: string;
  events: readonly RestHookEvent[];
  /** Restrict the webhook to these templates. Defaults to every template in the workspace. */
  document_template_ids?: readonly string[];
  custom_channel?: string;
}

interface RestHookResponse {
  rest_hook: RestHook;
}

// ── Resource ───────────────────────────────────────────────────────────────

/**
 * Manage webhook endpoints (RestHooks).
 * The PDFMonkey API only supports creating and deleting webhooks.
 * Use the PDFMonkey dashboard to list or inspect existing webhooks.
 */
export class RestHooks extends APIResource {
  /** Register a new webhook endpoint. */
  async create(params: RestHookCreateParams, options?: ResourceRequestOptions): Promise<RestHook> {
    const { events, ...rest } = params;
    const response = await this._client.post<RestHookResponse>('/rest_hooks', {
      ...options,
      body: { rest_hook: { ...rest, event: events.join(','), platform: 'api' } },
    });
    return response.rest_hook;
  }

  /** Delete a webhook endpoint by ID. */
  async delete(id: string, options?: ResourceRequestOptions): Promise<void> {
    await this._client.delete(`/rest_hooks/${encodeURIComponent(id)}`, options);
  }
}
