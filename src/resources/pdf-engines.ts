import { APIResource } from '../resource.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PdfEngine {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly deprecated_on: string | null;
}

interface PdfEnginesResponse {
  pdf_engines: PdfEngine[];
}

// ── Resource ───────────────────────────────────────────────────────────────

/**
 * Read-only access to PDF rendering engines available to the current user.
 *
 * Most callers do not need this. When creating a template, leave
 * `pdf_engine_draft_id` unset and the API auto-selects the latest engine —
 * which is almost always the right choice.
 *
 * Use this only when an end-user explicitly wants to pin a template to a
 * specific engine version (for example, to reproduce a legacy rendering).
 */
export class PdfEngines extends APIResource {
  /** List active PDF engines. Returns a flat array (not paginated). */
  async list(): Promise<readonly PdfEngine[]> {
    const response = await this._client.get<PdfEnginesResponse>('/pdf_engines');
    return response.pdf_engines;
  }
}
