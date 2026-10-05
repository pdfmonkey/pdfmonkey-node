import { PDFMonkeyError } from './error.js';
import type { DocumentCard } from './resources/document-cards.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WebhookHeaders {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
}

/**
 * Body of a `documents.generation.success` or `documents.generation.failure`
 * webhook: the document card, as returned by `documentCards.get()` (no
 * `payload`, `generation_logs` or `checksum`; `meta` is a JSON string). Svix
 * does not put the event type in the body, so tell them apart with
 * `document.status`.
 */
export interface DocumentWebhookPayload {
  readonly document: DocumentCard;
}

/** Body of a `quota.warning` webhook. */
export interface QuotaWarningWebhookPayload {
  readonly period_start: string;
  readonly period_end: string;
  readonly available_documents: number;
  readonly threshold: number;
}

/** Body of a verified webhook. Narrow with `'document' in payload`. */
export type WebhookPayload = DocumentWebhookPayload | QuotaWarningWebhookPayload;

export interface VerifyWebhookOptions {
  /** Tolerance in seconds for timestamp validation. Default: 300 (5 minutes). */
  tolerance?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TOLERANCE_SECONDS = 5 * 60; // 5 minutes
const WHSEC_PREFIX = 'whsec_';

// ── Verification ───────────────────────────────────────────────────────────

/**
 * Verify a webhook payload using Svix HMAC-SHA256 signatures.
 *
 * @param payload - The raw request body string
 * @param headers - The Svix webhook headers
 * @param secret - The webhook signing secret (with or without `whsec_` prefix)
 * @param options - Optional verification options (tolerance)
 * @returns The parsed webhook payload
 * @throws PDFMonkeyError if verification fails
 *
 * @example
 * ```ts
 * const payload = await verifyWebhook(
 *   rawBody,
 *   {
 *     'svix-id': req.headers['svix-id'],
 *     'svix-timestamp': req.headers['svix-timestamp'],
 *     'svix-signature': req.headers['svix-signature'],
 *   },
 *   process.env.WEBHOOK_SECRET,
 * );
 * if ('document' in payload && payload.document.status === 'success') {
 *   console.log(payload.document.download_url);
 * }
 * ```
 */
export async function verifyWebhook(
  payload: string,
  headers: WebhookHeaders,
  secret: string,
  options?: VerifyWebhookOptions,
): Promise<WebhookPayload> {
  const msgId = headers['svix-id'];
  const msgTimestamp = headers['svix-timestamp'];
  const msgSignature = headers['svix-signature'];

  if (!msgId || !msgTimestamp || !msgSignature) {
    throw new PDFMonkeyError('Missing required Svix webhook headers');
  }

  // Replay protection
  const timestampSeconds = Number(msgTimestamp);
  if (!Number.isInteger(timestampSeconds)) {
    throw new PDFMonkeyError('Invalid webhook timestamp');
  }

  const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE_SECONDS;
  if (tolerance <= 0) {
    throw new PDFMonkeyError('Webhook tolerance must be a positive number');
  }
  const now = Math.floor(Date.now() / 1000);
  if (now - timestampSeconds > tolerance) {
    throw new PDFMonkeyError('Webhook timestamp too old');
  }
  if (timestampSeconds - now > tolerance) {
    throw new PDFMonkeyError('Webhook timestamp too far in the future');
  }

  // Compute expected signature
  const rawSecret = secret.startsWith(WHSEC_PREFIX) ? secret.slice(WHSEC_PREFIX.length) : secret;
  const secretBytes = base64ToUint8Array(rawSecret);

  const key = await crypto.subtle.importKey(
    'raw',
    toBuffer(secretBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const toSign = `${msgId}.${msgTimestamp}.${payload}`;
  const encoded = new TextEncoder().encode(toSign);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, toBuffer(encoded));
  const expectedSignature = uint8ArrayToBase64(new Uint8Array(signatureBytes));

  // Check against all signatures in the header (space-separated, v1, prefixed)
  const signatures = msgSignature.split(' ');
  for (const sig of signatures) {
    const [version, value] = sig.split(',', 2);
    if (version !== 'v1' || !value) continue;

    if (await constantTimeEqual(expectedSignature, value)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        throw new PDFMonkeyError('Webhook payload is not valid JSON');
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new PDFMonkeyError('Webhook payload is not a JSON object');
      }
      return parsed as WebhookPayload;
    }
  }

  throw new PDFMonkeyError('Invalid webhook signature');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new PDFMonkeyError('Invalid webhook secret: not valid base64');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Extract an ArrayBuffer from a Uint8Array (safe for shared/offset buffers). */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Constant-time string comparison using double HMAC.
 *
 * Why this and not `crypto.timingSafeEqual`: this module targets every
 * runtime that exposes Web Crypto (Node 20+, Bun, Deno, Cloudflare
 * Workers, Vercel Edge), so we cannot import `node:crypto`. Web Crypto
 * has no constant-time comparison primitive, so we hash both inputs
 * with a per-call random key and compare the HMAC outputs byte-by-byte —
 * any timing leak is masked by the random key the attacker does not
 * know. Keep this implementation; do not "simplify" it to a string
 * compare or to `node:crypto` without re-evaluating edge support.
 */
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    'raw',
    toBuffer(randomBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const encoder = new TextEncoder();
  const encodedA = encoder.encode(a);
  const encodedB = encoder.encode(b);
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, toBuffer(encodedA)),
    crypto.subtle.sign('HMAC', key, toBuffer(encodedB)),
  ]);

  const viewA = new Uint8Array(macA);
  const viewB = new Uint8Array(macB);

  if (viewA.length !== viewB.length) return false;

  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= (viewA[i] as number) ^ (viewB[i] as number);
  }
  return result === 0;
}
