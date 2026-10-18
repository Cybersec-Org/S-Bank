# Phase 1 — workspace blueprint

## `package.json` (root)

- `"private": true`, `"name": "sbank"`, `"type": "module"`.
- `"packageManager": "pnpm@<exact current version>"` — enable with `corepack enable` (tell the user if Corepack is off).
- `"engines": { "node": ">=<LTS major>" }` matching `.nvmrc`.
- `scripts`: exactly the contract in `ci-contract.md`. Implement package-specific scripts in the packages and call them from the root with `pnpm --filter @sbank/<pkg> run <script>` so the root names stay stable.
- Root devDependencies only for cross-cutting tools: `prettier`, `typescript` (for editor/root type checks, same major the packages use). ESLint stays per package because Expo and Nest ship their own flat configs.

## `pnpm-workspace.yaml`

```yaml
packages:
  - app
  - api
```

Add supply-chain settings after confirming the exact key names in the current pnpm docs:

- `minimumReleaseAge` (minutes) — `1440`: freshly published versions (the usual window for malicious releases) are not installed for a day. Add `minimumReleaseAgeExclude` only with a comment explaining why.
- Build-script allowlist (`onlyBuiltDependencies` or its current replacement) — only packages that really need install scripts.
- If Expo/React Native native builds fail with isolated `node_modules`, set `nodeLinker: hoisted` and record it in ADR 0001 (Expo supports isolated installs since SDK 54, so try isolated first).
- No `shamefully-hoist`.

## TypeScript

`tsconfig.base.json` with: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`, `isolatedModules`, `verbatimModuleSyntax` where the toolchain allows it (Nest decorators and Expo's Babel transform may not — keep what the generators require and document deviations in the package tsconfig with a comment). Each package `tsconfig.json` extends it. TypeScript major per package follows its generator (NestJS CLI and Expo pin their supported version); do not force one version across both.

## Formatting and linting

- `prettier.config.mjs` and `.prettierignore` already exist (delivered with the Claude Code setup, which is formatted with them) — keep them; only add `prettier` as a root devDependency with the exact current version.
- ESLint flat config per package with type-aware rules: `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `no-misused-promises`, `consistent-type-imports`, `no-non-null-assertion`, `switch-exhaustiveness-check`; `eslint-plugin-security` in the API; `no-console` (except scripts); `import`-order handled by Prettier or a single plugin, not both. `--max-warnings 0`.

## `.env.example`

All variables from `ci-contract.md` with local defaults; every password `__GENERATE__`. A header comment in Polish: the file is a template, real values go to `.env` created by `node scripts/dev-secrets.mjs`, never commit `.env`.

## Checks

`pnpm install`, `pnpm run format:check`.
