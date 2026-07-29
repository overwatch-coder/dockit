# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress — Phase A: Foundation

## Current Goal

- Unit 3: Authentication (Clerk sign-in/sign-up, session → `accountId`)

## Completed

- Unit 1: Project scaffold and tooling — Next.js 16.2.12 (App Router, TypeScript, Tailwind v4, Turbopack) scaffolded at repo root; shadcn/ui initialized (`base-nova` preset, neutral base color, lucide-react icons); Inter + JetBrains Mono fonts wired via `next/font/google` in `app/layout.tsx`; empty-shell folders created for `lib/db/`, `lib/shopify/`, `lib/jobs/`, `lib/ai/`, `types/`; Vitest + React Testing Library test harness set up in `tests/` with a passing smoke test. `npm run dev`, `build`, `lint`, and `test` all verified green.
- Unit 2: Database schema and migrations — `prisma/schema.prisma` written with 7 models (`Account`, `AccountUser`, `Store`, `ShopifyToken`, `Product`, `Variant`, `Job`) and 5 enums, every non-`Account` model scoped by `accountId` (and `storeId` where applicable). Prisma 7 (`prisma-client` generator, output `lib/generated/prisma`) installed and configured via `prisma.config.ts`. Initial migration (`20260729022339_init`) applied against the real Neon database and verified via `prisma db pull`. No `lib/db/` query code yet — schema and connection only, per the unit's own scope. `npm run build`, `lint`, and `test` reverified green with Prisma installed.

## In Progress

- None.

## Next Up

- Unit 3: Authentication — Clerk sign-in/sign-up integrated, a session resolves to an `accountId`, and a new Clerk user automatically gets an `Account` + `AccountUser` row created on first sign-in (the `AccountUser.clerkUserId` column from Unit 2 is what this wires up to). Depends on Units 1 and 2, per `context/00-build-plan.md`.

## Open Questions

- **Pooled vs. direct Neon connection at runtime.** `.env` holds both `DATABASE_URL` (direct/non-pooler — used for migrations, and currently the only one wired into `prisma.config.ts`) and `DATABASE_URL_POOLED` (PgBouncer, unused so far). Prisma 7's `prisma.config.ts` datasource only takes a single `url` (no `directUrl` field like older Prisma versions), so the pooled-vs-direct split needs a decision once `lib/db/` actually starts running queries under load (Unit 5+): keep using the direct URL, or switch runtime queries to the pooled one while migrations keep using the direct one via a separate mechanism.

## Architecture Decisions

- **Typography changed from Geist Sans/Geist Mono to Inter/JetBrains Mono.** `context/ui-context.md`'s Typography section originally specified Geist as fixed; the user explicitly requested a different pairing during Unit 1. Inter is used for the UI face (nav, buttons, body, labels), JetBrains Mono for the data face (SKUs, prices, timestamps, tags). `context/ui-context.md` was updated in the same session to keep the doc in sync with this decision, per `context/ai-workflow-rules.md`.
- **shadcn/ui base color deferred to Unit 4.** Initialized with the `neutral` default rather than the indigo-violet (`#5B5FEF`) palette from `context/ui-context.md`, since the build plan assigns color-token/sidebar theming work to Unit 4 ("App shell and static layout"), not Unit 1.
- **Test tooling: Vitest + React Testing Library + jsdom**, chosen by reading Next 16's own bundled docs (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`) rather than assuming carried-over conventions, per `AGENTS.md`'s standing instruction. Tests live in `tests/` (not the docs' default `__tests__/` convention) to match the `/tests/` folder `AGENTS.md` specifies. Vitest's `pool` is set to `"threads"` in `vitest.config.mts` — the default `"forks"` pool hung indefinitely in this environment.
- **`ShopifyToken` is its own model, not fields on `Store`.** `context/00-build-plan.md`'s Unit 2 line lists "OAuth token" as a separate model from "Store" in its Oxford-comma list, and `context/architecture.md`'s Storage Model table gives OAuth tokens their own row. 1:1 with `Store` via a unique `storeId`.
- **Push and sync jobs share a single `Job` table**, not separate `SyncJob`/`PushJob` tables, because `context/00-build-plan.md`'s Unit 6 refers to "the SyncJob/PushJob **table**" (singular). `type: PUSH | SYNC` is the discriminator, per `context/code-standards.md`'s rule to use discriminated unions instead of scattered string comparisons.
- **Product images are not modeled yet.** `context/architecture.md`'s Storage Model table mentions product images, but `context/00-build-plan.md` assigns image handling to Unit 12 ("Draft image upload") specifically. Adding an `Image` table in Unit 2 would be a speculative addition ahead of the unit that actually needs it (`context/ai-workflow-rules.md` rule 7).
- **Prisma 7's new config shape.** This project's Prisma version (7.9.1) uses the new `prisma-client` generator (output to `lib/generated/prisma`, gitignored) and a `prisma.config.ts` file for datasource/migration config instead of the older schema-embedded `url`/`env()` pattern — confirmed by reading the generated files directly rather than assuming Prisma 5/6-era conventions, the same caution `AGENTS.md` asks for with Next.js itself.

## Session Notes

- Environment note: this shell has `NODE_ENV=development` set globally, which previously broke `next build`. **Fixed** — `cross-env` is now a dev dependency and every relevant npm script (`dev`, `build`, `start`, `test`, `test:watch`) explicitly sets `NODE_ENV` itself, so a polluted parent-shell value can no longer leak in. No manual workaround needed anymore; just use `npm run <script>` as normal.
- Repo root previously had no git history and a `context/`-path mismatch between `AGENTS.md` and the actual spec file locations; both were fixed in an earlier session (spec files moved into `context/`, git initialized).
- `.env` (real Neon credentials) and `.env.example` (placeholder shape, safe to commit) both exist at the repo root. `.env` is gitignored and was confirmed absent from `git status` before every commit involving it.
