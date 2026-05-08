import type { ResourceRequestOptions } from '../client.js';
import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CurrentUser {
  readonly id: string;
  readonly auth_token: string;
  readonly available_documents: number;
  readonly block_resources: boolean;
  readonly created_at: string;
  readonly current_plan: string;
  readonly current_plan_interval: string;
  readonly desired_name: string;
  readonly email: string;
  readonly lang: string;
  readonly paying_customer: boolean;
  readonly share_links: boolean;
  readonly trial_ends_on: string | null;
  readonly updated_at: string;
}

// ── Resource ───────────────────────────────────────────────────────────────

/** Read-only access to the authenticated user's profile. */
export class CurrentUserResource extends APIResource {
  /** Retrieve the current user's profile. */
  async get(options?: ResourceRequestOptions): Promise<CurrentUser> {
    const response = await this._client.get<{ current_user: CurrentUser }>(
      '/current_user',
      options,
    );
    return response.current_user;
  }
}
