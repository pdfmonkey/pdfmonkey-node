---
"pdfmonkey": minor
---

Fixing endpoints that never worked against the live API: `workspaces.list()`/`listAll()`/`get()` now read the `apps`/`app` payload keys, `documentTemplates.create()` and `templateFolders.create()` take a required `workspace_id`, and `restHooks.create()` sends the `event`/`platform` fields the API expects (events are now `documents.generation.success` / `documents.generation.failure`). Adding a live-API integration suite runnable with `pnpm test:integration`.
