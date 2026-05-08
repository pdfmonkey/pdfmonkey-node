# Examples

Runnable snippets for common PDFMonkey SDK use cases.

Each example is a standalone file that imports `pdfmonkey` from the
local build (`../dist`) so they double as smoke tests for the published
shape (ESM + CJS).

Set `PDFMONKEY_API_KEY` in your environment before running.

```sh
pnpm build
node examples/quickstart.mjs
```

| File | What it shows |
| :--- | :--- |
| `quickstart.mjs`         | ESM: create a document and poll for completion |
| `quickstart.cjs`         | CommonJS: same flow as `quickstart.mjs` |
| `generate-sync.mjs`      | One-shot synchronous generation |
| `pagination.mjs`         | Async-iterating over all pages of document cards |
| `webhook-express.mjs`    | Verifying a webhook payload in an Express handler |
| `next-route-handler.ts`  | Verifying a webhook in a Next.js App Router route |
