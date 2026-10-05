# pdfmonkey

## 1.4.0

### Minor Changes

- dfafa9f: Adding the `search` filter to `documentCards.list()` (exact document ID or partial filename) and letting `status` take several statuses. Query values now accept arrays, sent as `key[]=a&key[]=b`. Documenting the accepted `folders` and `sort` values on `documentTemplates.list()`.
  
  Fixing `workspaceCards.update()` to send `PUT` instead of `PATCH`, matching the API and the other update endpoints. Removing the `'error'` value from `DocumentStatus`: the API never returns it.
- af5932f: Fixing `verifyWebhook()`, which rejected every real PDFMonkey webhook: it expected a `{ type, data, timestamp }` envelope the API never sends. It now returns the delivered body as a `WebhookPayload`, either `{ document }` (the document card, for `documents.generation.success`/`failure`) or the `quota.warning` usage figures. Narrow with `'document' in payload` and check `payload.document.status`. Removing the `WebhookEvent`, `WebhookEventType`, `DocumentDoneEvent`, `DocumentErrorEvent`, their `*Data` types and `UnknownWebhookEvent`.

### Patch Changes

- ad9d7cd: Fixing `documents.waitForGeneration()` so its `timeout` is a true total budget: in-flight polls and their retries are now aborted when it expires, instead of resolving with a late success or reporting the timeout only after a slow response came back.

## 1.3.0

### Minor Changes

- 44349df: Adding `client.workspaceCards` to call the `workspace_cards` endpoint: `list()`/`listAll()` return workspace summaries including the admin's `current_plan`, and `update()` renames a workspace.

## 1.2.0

### Minor Changes

- 2c03f6d: Fixing endpoints that never worked against the live API: `workspaces.list()`/`listAll()`/`get()` now read the `apps`/`app` payload keys, `documentTemplates.create()` and `templateFolders.create()` take a required `workspace_id`, and `restHooks.create()` sends the `event`/`platform` fields the API expects (events are now `documents.generation.success` / `documents.generation.failure`). Adding a live-API integration suite runnable with `pnpm test:integration`.

## 1.1.0

### Minor Changes

- df48ead: Adding a required `workspace_id` to `snippets.list()` and `templateFolders.list()` (the API returns nothing without it), and a `listAll()` method on workspaces, document templates, snippets and template folders that fetches every item in a single `page=all` request.

## 1.0.0

### Major Changes

- a0a2381: Initial public release of the PDFMonkey Node.js SDK — a zero-dependency, dual ESM + CommonJS client for the PDFMonkey API. Covers documents (create/get/update/delete, synchronous generation, polling, and PDF download/stream), document cards, templates, template folders, snippets, PDF engines, rest hooks, workspaces, and the current user. Includes paginated list helpers, a typed error hierarchy, request/response/error hooks, configurable retries with backoff, and Web Crypto webhook signature verification for Node 20+ and edge runtimes.
