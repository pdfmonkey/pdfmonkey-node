---
"pdfmonkey": patch
---

Fixing `documents.waitForGeneration()` so its `timeout` is a true total budget: in-flight polls and their retries are now aborted when it expires, instead of resolving with a late success or reporting the timeout only after a slow response came back.
