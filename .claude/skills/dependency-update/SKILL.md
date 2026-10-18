---
name: dependency-update
description: Add, upgrade or remove a dependency safely — justify it, vet the package (maintenance, licence, advisories, release age), install with the right tool (npx expo install for Expo/RN), read the changelog or migration guide, and verify with the quality gate. Use for any package.json change, Dependabot PR follow-up or SDK upgrade.
argument-hint: '[add|upgrade|remove] <package>[@version] [app|api|root]'
---

# Dependency change

Request: `$ARGUMENTS`

Every dependency is attack surface (T-08). Prefer the platform, the existing stack or a few lines of code over a new package.

## Vet before adding

Check with `pnpm view <pkg>` and the package's repository (via `docs-researcher` if needed):

- Is it needed? Could Node, Expo, NestJS or an existing dependency do it?
- Maintained (recent releases, open issues handled), widely used, typed, licence compatible (MIT/Apache-2.0/BSD/ISC — ask for anything else).
- No known advisories (`pnpm audit` after install), no install scripts unless essential (then add to the workspace build-script allowlist with a comment).
- Version is a **stable** release older than the workspace `minimumReleaseAge`; never `latest` blindly — Prisma's `latest` tag is a pre-release, for example.

## Install

- Expo / React Native packages: `npx expo install <pkg>` inside `app/` (keeps SDK-compatible versions), then `pnpm run app:doctor`.
- API: `pnpm --filter @sbank/api add <pkg>@<exact-version>`; dev tools with `-D`.
- Root: only cross-cutting dev tools.
- Prisma packages always move together on the same 7.x version (`prisma`, `@prisma/client`, `@prisma/adapter-pg`).

Installing asks the user for permission — explain in one line what you install and why.

## Upgrade

1. Read the release notes / migration guide between the current and target version (official source).
2. Upgrade one package family at a time (Expo SDK as a whole via the official upgrade guide; NestJS packages together; Prisma together).
3. Apply required code changes, then run the `quality-gate` skill (full).
4. For major upgrades, add a short ADR note if behaviour or configuration changed.

## Remove

Delete usages first, then `pnpm --filter <pkg> remove <dep>`; check nothing else imports it (`pnpm why <dep>`).

## Hand-over

List: package, from → to, why, licence, advisories checked, breaking changes handled, checks run. Lockfile changes are expected — mention them in `prepare-commit`.
