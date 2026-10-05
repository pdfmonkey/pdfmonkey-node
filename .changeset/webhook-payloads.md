---
"pdfmonkey": minor
---

Fixing `verifyWebhook()`, which rejected every real PDFMonkey webhook: it expected a `{ type, data, timestamp }` envelope the API never sends. It now returns the delivered body as a `WebhookPayload`, either `{ document }` (the document card, for `documents.generation.success`/`failure`) or the `quota.warning` usage figures. Narrow with `'document' in payload` and check `payload.document.status`. Removing the `WebhookEvent`, `WebhookEventType`, `DocumentDoneEvent`, `DocumentErrorEvent`, their `*Data` types and `UnknownWebhookEvent`.
