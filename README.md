# pdfmonkey-node

[![CI](https://github.com/pdfmonkey/pdfmonkey-node/actions/workflows/ci.yml/badge.svg)](https://github.com/pdfmonkey/pdfmonkey-node/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/pdfmonkey.svg)](https://www.npmjs.com/package/pdfmonkey)
[![npm downloads](https://img.shields.io/npm/dm/pdfmonkey.svg)](https://www.npmjs.com/package/pdfmonkey)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Official Node.js SDK for the [PDFMonkey](https://www.pdfmonkey.io) API. Zero runtime dependencies, dual ESM + CommonJS, Node 20+ and edge-runtime compatible (uses Web Crypto only).

## Installation

```sh
npm install pdfmonkey
```

## Usage

```ts
import { PDFMonkey } from 'pdfmonkey';

const client = new PDFMonkey('your-api-key');
```

### Documents

> **No `client.documents.list()`** — listing returns a lightweight summary, so it lives on `client.documentCards.list()` (see [Pagination](#pagination)). All update endpoints use HTTP `PUT` (full document replacement) to match the PDFMonkey API contract; the SDK does not currently expose `PATCH`.

```ts
// Create a document (starts as draft)
const doc = await client.documents.create({
  document_template_id: 'tpl_xxx',
  payload: { name: 'Alice', amount: 42 }, // object — auto-stringified to JSON
  status: 'pending', // set to 'pending' to start generation immediately
});

// Get a document
const doc = await client.documents.get('doc_xxx');

// Update a document
const updated = await client.documents.update('doc_xxx', {
  payload: { name: 'Bob' },
});

// Delete a document
await client.documents.delete('doc_xxx');
```

### Document Meta (Password & Filename)

Use the `meta` field to password-protect or set a custom filename on generated PDFs:

```ts
const doc = await client.documents.create({
  document_template_id: 'tpl_xxx',
  payload: { name: 'Alice' },
  meta: {
    _password: 'secret123',      // encrypts the PDF (AES-256)
    _filename: 'invoice-42.pdf', // sets the download filename
    customField: 'any value',    // your own metadata
  },
  status: 'pending',
});
```

`meta` accepts either an object (auto-serialized to JSON) or a pre-serialized JSON string. Works on `create`, `update`, and `generateSync`.

### Downloading the PDF

```ts
// As a Uint8Array
const bytes = await client.documents.download(doc); // or doc.id

// As a ReadableStream — pipe straight to disk or an HTTP response
const stream = await client.documents.downloadStream(doc.id);
```

The helpers throw `PDFMonkeyError` if the document has no `download_url` yet — wait for generation to complete first.

### Reading meta back

`Document.meta` is a JSON string on the wire. Use `parseMeta` to recover the structured object you sent:

```ts
import { parseMeta } from 'pdfmonkey';

const decoded = parseMeta(doc.meta); // DocumentMeta | null
if (decoded?._filename) console.log(decoded._filename);
```

### Synchronous Generation

Generate a PDF and wait for it to complete in a single request:

```ts
const card = await client.documents.generateSync({
  document_template_id: 'tpl_xxx',
  payload: { invoice_number: 1234 },
});

console.log(card.download_url);
```

### Polling for Completion

Create a document then poll until generation completes:

```ts
const doc = await client.documents.create({
  document_template_id: 'tpl_xxx',
  payload: { data: 'value' },
  status: 'pending',
});

const completed = await client.documents.waitForGeneration(doc.id, {
  interval: 2000,  // poll every 2s (default)
  timeout: 120000, // give up after 120s (default)
  signal: AbortSignal.timeout(30000), // optional AbortSignal
});

console.log(completed.download_url);
```

### Document Status

Documents and document cards share a `DocumentStatus` type:

```ts
import type { DocumentStatus } from 'pdfmonkey';
// 'draft' | 'pending' | 'generating' | 'success' | 'failure' | 'error'
```

### Document Templates

```ts
const page = await client.documentTemplates.list({ workspace_id: 'ws_xxx' });
const template = await client.documentTemplates.get('tpl_xxx');
const created = await client.documentTemplates.create({ identifier: 'invoice' });
const updated = await client.documentTemplates.update('tpl_xxx', { identifier: 'receipt' });
await client.documentTemplates.delete('tpl_xxx');
```

> Leave `pdf_engine_draft_id` unset on `create`/`update` — the API auto-selects the latest engine. Override only when an end-user explicitly asks to pin a specific engine version (see PDF Engines below).

### PDF Engines (advanced)

Read-only list of available rendering engines. Most callers do not need this. Use only when an end-user explicitly wants to pin a template to a specific engine version.

```ts
const engines = await client.pdfEngines.list();
// [{ id: 'eng_xxx', name: 'chromium', version: 6, deprecated_on: null }, ...]

await client.documentTemplates.update('tpl_xxx', {
  pdf_engine_draft_id: engines[0]!.id,
});
```

### Pagination

All list methods return a `Page<T>` with built-in navigation:

```ts
const page = await client.documentCards.list({ document_template_id: 'tpl_xxx' });

console.log(page.data);        // items on this page
console.log(page.currentPage); // 1
console.log(page.totalPages);  // 5

if (page.hasNextPage()) {
  const next = await page.getNextPage();
}
```

### Webhooks

Register webhook endpoints:

```ts
const hook = await client.restHooks.create({
  url: 'https://example.com/webhook',
  events: ['document.done'],
});

await client.restHooks.delete(hook.id);
```

Verify incoming webhook signatures (Svix HMAC-SHA256):

```ts
import { verifyWebhook } from 'pdfmonkey';

const event = await verifyWebhook(
  rawBody,
  {
    'svix-id': req.headers['svix-id'],
    'svix-timestamp': req.headers['svix-timestamp'],
    'svix-signature': req.headers['svix-signature'],
  },
  process.env.WEBHOOK_SECRET,
);

// `WebhookEvent` is a discriminated union — narrow on `type`
if (event.type === 'document.done') {
  console.log(event.data.download_url);
} else if (event.type === 'document.error') {
  console.log(event.data.failure_cause);
}
```

### Other Resources

```ts
// Snippets
const snippets = await client.snippets.list();
await client.snippets.create({ identifier: 'header', code: '<div>Header</div>', workspace_id: 'ws_xxx' });

// Template Folders
const folders = await client.templateFolders.list();

// Workspaces
const workspaces = await client.workspaces.list();

// Current User
const user = await client.currentUser.get();
```

## Configuration

```ts
const client = new PDFMonkey({
  apiKey: 'your-api-key',           // or set PDFMONKEY_API_KEY in the environment
  baseURL: 'https://api.pdfmonkey.io/api/v1', // default
  timeout: 30_000,                  // request timeout in ms (default: 30s)
  maxRetries: 2,                    // retry on 408/429/5xx (default: 2)
  fetch: customFetch,               // bring your own fetch implementation
  logger: console,                  // debug logging
  retryDelay: (attempt) => attempt * 250, // custom backoff (optional)
  hooks: {                          // request/response/error interceptors
    onRequest: (ctx) => { ctx.headers['X-Trace-Id'] = newTraceId(); },
    onResponse: (ctx) => metrics.observe(ctx.durationMs, ctx.response.status),
  },
});
```

When `apiKey` is omitted, the client reads `process.env.PDFMONKEY_API_KEY`.

### Per-request options

Every resource method accepts a trailing options object for `signal`, `timeout`, `maxRetries`, `headers`, and `idempotencyKey`:

```ts
await client.documents.create(
  { document_template_id: 'tpl_xxx', payload: { invoice: 1 } },
  {
    idempotencyKey: 'order-1234',
    signal: AbortSignal.timeout(10_000),
    headers: { 'X-Trace-Id': 'trace_abc' },
  },
);
```

### Browser & edge runtimes

The SDK uses only Web Crypto + global `fetch`, so `verifyWebhook` and the client both run on Cloudflare Workers, Vercel Edge, Deno, and Bun in addition to Node 20+. Pass a custom `fetch` if your runtime needs a wrapped one.

## Error Handling

```ts
import { APIConnectionError, AuthenticationError, NotFoundError, RateLimitError } from 'pdfmonkey';

try {
  await client.documents.get('doc_xxx');
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid API key (401)
  } else if (error instanceof NotFoundError) {
    // Resource not found (404)
  } else if (error instanceof RateLimitError) {
    console.log(error.retryAfter); // seconds from Retry-After header
  } else if (error instanceof APIConnectionError) {
    console.log(error.cause); // original network error (native Error.cause)
  }
}
```

## License

MIT
