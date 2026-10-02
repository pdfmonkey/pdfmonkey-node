# pdfmonkey

## Unreleased

- `snippets.list()` and `templateFolders.list()` now require `workspace_id`; the API returns nothing without it.
- Adding `listAll()` to workspaces, document templates, snippets and template folders to fetch every item in a single `page=all` request.

## 1.0.0

### Major Changes

- a0a2381: Initial public release of the PDFMonkey Node.js SDK — a zero-dependency, dual ESM + CommonJS client for the PDFMonkey API. Covers documents (create/get/update/delete, synchronous generation, polling, and PDF download/stream), document cards, templates, template folders, snippets, PDF engines, rest hooks, workspaces, and the current user. Includes paginated list helpers, a typed error hierarchy, request/response/error hooks, configurable retries with backoff, and Web Crypto webhook signature verification for Node 20+ and edge runtimes.
