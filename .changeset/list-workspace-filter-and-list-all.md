---
"pdfmonkey": minor
---

Adding a required `workspace_id` to `snippets.list()` and `templateFolders.list()` (the API returns nothing without it), and a `listAll()` method on workspaces, document templates, snippets and template folders that fetches every item in a single `page=all` request.
