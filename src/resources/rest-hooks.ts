import type { ResourceRequestOptions } from '../client.js';
import { APIResource } from '../resource.js';
import type { WebhookEventType } from '../webhooks.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RestHook {
  readonly id: string;
  readonly enabled: boolean;
  readonly events: readonly WebhookEventType[];
  readonly url: string;
  readonly workspace_id: string | null;
  readonly document_template_ids: readonly string[];
}

export interface RestHookCreateParams {
  url: string;
  events: readonly WebhookEventType[];
  workspace_id?: string;
  document_template_ids?: readonly string[];
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
    const response = await this._client.post<RestHookResponse>('/rest_hooks', {
      ...options,
      body: { rest_hook: params },
    });
    return response.rest_hook;
  }

  /** Delete a webhook endpoint by ID. */
  async delete(id: string, options?: ResourceRequestOptions): Promise<void> {
    await this._client.delete(`/rest_hooks/${encodeURIComponent(id)}`, options);
  }
}
