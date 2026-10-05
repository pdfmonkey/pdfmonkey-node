---
"pdfmonkey": minor
---

Adding the `search` filter to `documentCards.list()` (exact document ID or partial filename) and letting `status` take several statuses. Query values now accept arrays, sent as `key[]=a&key[]=b`. Documenting the accepted `folders` and `sort` values on `documentTemplates.list()`.

Fixing `workspaceCards.update()` to send `PUT` instead of `PATCH`, matching the API and the other update endpoints. Removing the `'error'` value from `DocumentStatus` (and the `document.error` webhook payload status): the API never returns it.
