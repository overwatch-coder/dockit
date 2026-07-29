# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress — Phase A: Foundation

## Current Goal

- Unit 2: Database schema and migrations (Prisma schema, Neon connection)

## Completed

- Unit 1: Project scaffold and tooling — Next.js 16.2.12 (App Router, TypeScript, Tailwind v4, Turbopack) scaffolded at repo root; shadcn/ui initialized (`base-nova` preset, neutral base color, lucide-react icons); Inter + JetBrains Mono fonts wired via `next/font/google` in `app/layout.tsx`; empty-shell folders created for `lib/db/`, `lib/shopify/`, `lib/jobs/`, `lib/ai/`, `types/`; Vitest + React Testing Library test harness set up in `tests/` with a passing smoke test. `npm run dev`, `build`, `lint`, and `test` all verified green.

## In Progress

- None.

## Next Up

- Unit 2: Database schema and migrations (`prisma/schema.prisma` — Account, Store, Product, Variant, SyncJob/PushJob, OAuth token models, all scoped by `accountId`/`storeId`), per `context/00-build-plan.md`.

## Open Questions

- None currently blocking.

## Architecture Decisions

- **Typography changed from Geist Sans/Geist Mono to Inter/JetBrains Mono.** `context/ui-context.md`'s Typography section originally specified Geist as fixed; the user explicitly requested a different pairing during Unit 1. Inter is used for the UI face (nav, buttons, body, labels), JetBrains Mono for the data face (SKUs, prices, timestamps, tags). `context/ui-context.md` was updated in the same session to keep the doc in sync with this decision, per `context/ai-workflow-rules.md`.
- **shadcn/ui base color deferred to Unit 4.** Initialized with the `neutral` default rather than the indigo-violet (`#5B5FEF`) palette from `context/ui-context.md`, since the build plan assigns color-token/sidebar theming work to Unit 4 ("App shell and static layout"), not Unit 1.
- **Test tooling: Vitest + React Testing Library + jsdom**, chosen by reading Next 16's own bundled docs (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`) rather than assuming carried-over conventions, per `AGENTS.md`'s standing instruction. Tests live in `tests/` (not the docs' default `__tests__/` convention) to match the `/tests/` folder `AGENTS.md` specifies. Vitest's `pool` is set to `"threads"` in `vitest.config.mts` — the default `"forks"` pool hung indefinitely in this environment.

## Session Notes

- Environment note: this shell has `NODE_ENV=development` set globally, which breaks `next build` (`TypeError: Cannot read properties of null (reading 'useContext')` while prerendering `/_global-error`). This is a pre-existing Next.js 16.2.12 issue triggered by a non-default `NODE_ENV` at build time, not something introduced by this project's code — reproduced on a completely vanilla `create-next-app` scaffold too. Always run `npm run build` as `env -u NODE_ENV NODE_ENV=production npm run build` (or otherwise ensure `NODE_ENV` isn't pre-set to `development`) until/unless this is fixed upstream.
- Repo root previously had no git history and a `context/`-path mismatch between `AGENTS.md` and the actual spec file locations; both were fixed in the prior session (spec files moved into `context/`, git initialized).
