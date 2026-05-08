# Contributing

Thanks for taking the time to contribute. This SDK is small and the bar
for changes is high — we optimise for stability and ergonomics over new
features.

## Local setup

Requirements:

- Node.js `>= 20`
- `pnpm` (use the version pinned in `packageManager`)

```sh
git clone https://github.com/pdfmonkey/pdfmonkey-node.git
cd pdfmonkey-node
pnpm install
```

## Common scripts

| Script                  | Purpose                                  |
| :---------------------- | :--------------------------------------- |
| `pnpm test`             | Run the Vitest suite                     |
| `pnpm test:watch`       | Vitest in watch mode                     |
| `pnpm test:coverage`    | Run tests with v8 coverage               |
| `pnpm lint`             | Biome lint + format check                |
| `pnpm lint:fix`         | Biome auto-fix                           |
| `pnpm typecheck`        | `tsc --noEmit`                           |
| `pnpm build`            | Build ESM + CJS bundles via tsup         |
| `pnpm attw`             | Are The Types Wrong type-resolution check|
| `pnpm publint`          | Lint the published package shape         |

## Pull requests

1. Fork the repo and create a feature branch.
2. Add a Changeset for any user-visible change:
   ```sh
   pnpm changeset
   ```
3. Make sure `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
   all pass locally.
4. Open the PR against `main`. CI runs the same checks across Node
   20/22/24 plus macOS and Windows.

## Coding conventions

- Follow Biome's recommended rules; run `pnpm lint:fix` before pushing.
- Public API additions need TSDoc and a test.
- Keep runtime dependencies at zero — the SDK relies on the platform's
  `fetch` and Web Crypto only.
- Resource methods are thin wrappers around `client.get/post/...`. Do not
  introduce ad-hoc HTTP code paths.

## Reporting issues

Open a GitHub issue with reproduction steps, expected vs. actual
behaviour, the SDK version, and the Node version. For security
vulnerabilities, see `SECURITY.md`.
