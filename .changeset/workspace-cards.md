---
"pdfmonkey": minor
---

Adding `client.workspaceCards` to call the `workspace_cards` endpoint: `list()`/`listAll()` (with an optional `invite_token` filter) return workspace summaries including the admin's `current_plan`, and `update()` renames a workspace or regenerates its invite token (`invite_token: null`).
