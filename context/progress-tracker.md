# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress — Phase A: Foundation

## Current Goal

- Unit 4: App shell and static layout (sidebar, store switcher, color tokens)

## Completed

- Unit 1: Project scaffold and tooling — Next.js 16.2.12 (App Router, TypeScript, Tailwind v4, Turbopack) scaffolded at repo root; shadcn/ui initialized (`base-nova` preset, neutral base color, lucide-react icons); Inter + JetBrains Mono fonts wired via `next/font/google` in `app/layout.tsx`; empty-shell folders created for `lib/db/`, `lib/shopify/`, `lib/jobs/`, `lib/ai/`, `types/`; Vitest + React Testing Library test harness set up in `tests/` with a passing smoke test. `npm run dev`, `build`, `lint`, and `test` all verified green.
- Unit 2: Database schema and migrations — `prisma/schema.prisma` written with 7 models (`Account`, `AccountUser`, `Store`, `ShopifyToken`, `Product`, `Variant`, `Job`) and 5 enums, every non-`Account` model scoped by `accountId` (and `storeId` where applicable). Prisma 7 (`prisma-client` generator, output `lib/generated/prisma`) installed and configured via `prisma.config.ts`. Initial migration (`20260729022339_init`) applied against the real Neon database and verified via `prisma db pull`. No `lib/db/` query code yet — schema and connection only, per the unit's own scope. `npm run build`, `lint`, and `test` reverified green with Prisma installed.
- Unit 3: Authentication — Clerk wired up via the **Clerk CLI** (`clerk init --app app_3HAqpcTUTmgzPFqpohwrTCiaQFv`, linked to the "Dockit" Clerk application), which generated `proxy.ts` (`clerkMiddleware()`), `<ClerkProvider>` in `app/layout.tsx`, and `app/sign-in/[[...sign-in]]/`, `app/sign-up/[[...sign-up]]/` pages. Added the project-specific piece the CLI doesn't know about: `lib/db/client.ts` (singleton `PrismaClient` using the new Prisma 7 `@prisma/adapter-pg` driver adapter — required by the `prisma-client` generator, not optional) and `lib/db/accounts.ts`'s `getOrCreateAccountForClerkUser()`, which lazily provisions an `Account` + `AccountUser` row on first authenticated request (no Clerk webhook route — see Architecture Decisions). A temporary `app/dashboard/page.tsx` calls this and renders the resolved account id; Unit 4 will replace it with the real shell. **Verified end-to-end**: user signed up through the browser, `/dashboard` resolved and rendered the account id, and a direct DB query confirmed exactly one `Account`/`AccountUser` pair (`role: OWNER`) — no duplicates. `npm run build`, `lint`, `test` all green.
- Renamed the app to **Dockit**: `package.json` name, `app/layout.tsx` metadata, homepage heading. Neon database renamed to `dockit` (new connection strings supplied by the user); the Unit 2 migration was re-applied there via `prisma migrate deploy` and reverified with `prisma db pull` (all 7 tables present).

## In Progress

- None.

## Next Up

- Unit 4: App shell and static layout — sidebar, store switcher, and main content layout per `context/ui-context.md`, using **shadcn's `sidebar` block** specifically (`SidebarProvider`/`Sidebar`/`SidebarTrigger` composition, collapsible-to-icons — the user explicitly asked for this exact shadcn component rather than a hand-rolled sidebar). This is also where the indigo-violet (`#5B5FEF`) color tokens and radius scale from `context/ui-context.md` finally get wired into `app/globals.css`, deferred from Units 1–3. The temporary `app/dashboard/page.tsx` from Unit 3 gets absorbed into the real `app/(dashboard)/` route group here. Depends on Units 1, 3, per `context/00-build-plan.md`.

## Open Questions

- **Pooled vs. direct Neon connection at runtime.** `.env` holds both `DATABASE_URL` (direct/non-pooler — used for migrations and now also the live app runtime via `lib/db/client.ts`) and `DATABASE_URL_POOLED` (PgBouncer, unused so far). Revisit once query volume matters (Unit 5+ background jobs): keep using the direct URL, or switch runtime queries to the pooled one.

## Architecture Decisions

- **Typography changed from Geist Sans/Geist Mono to Inter/JetBrains Mono.** `context/ui-context.md`'s Typography section originally specified Geist as fixed; the user explicitly requested a different pairing during Unit 1. Inter is used for the UI face (nav, buttons, body, labels), JetBrains Mono for the data face (SKUs, prices, timestamps, tags). `context/ui-context.md` was updated in the same session to keep the doc in sync with this decision, per `context/ai-workflow-rules.md`.
- **shadcn/ui base color deferred to Unit 4.** Initialized with the `neutral` default rather than the indigo-violet (`#5B5FEF`) palette from `context/ui-context.md`, since the build plan assigns color-token/sidebar theming work to Unit 4 ("App shell and static layout"), not Unit 1.
- **Test tooling: Vitest + React Testing Library + jsdom**, chosen by reading Next 16's own bundled docs (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`) rather than assuming carried-over conventions, per `AGENTS.md`'s standing instruction. Tests live in `tests/` (not the docs' default `__tests__/` convention) to match the `/tests/` folder `AGENTS.md` specifies. Vitest's `pool` is set to `"threads"` in `vitest.config.mts` — the default `"forks"` pool hung indefinitely in this environment.
- **`ShopifyToken` is its own model, not fields on `Store`.** `context/00-build-plan.md`'s Unit 2 line lists "OAuth token" as a separate model from "Store" in its Oxford-comma list, and `context/architecture.md`'s Storage Model table gives OAuth tokens their own row. 1:1 with `Store` via a unique `storeId`.
- **Push and sync jobs share a single `Job` table**, not separate `SyncJob`/`PushJob` tables, because `context/00-build-plan.md`'s Unit 6 refers to "the SyncJob/PushJob **table**" (singular). `type: PUSH | SYNC` is the discriminator, per `context/code-standards.md`'s rule to use discriminated unions instead of scattered string comparisons.
- **Product images are not modeled yet.** `context/architecture.md`'s Storage Model table mentions product images, but `context/00-build-plan.md` assigns image handling to Unit 12 ("Draft image upload") specifically. Adding an `Image` table in Unit 2 would be a speculative addition ahead of the unit that actually needs it (`context/ai-workflow-rules.md` rule 7).
- **Prisma 7's new config shape.** This project's Prisma version (7.9.1) uses the new `prisma-client` generator (output to `lib/generated/prisma`, gitignored) and a `prisma.config.ts` file for datasource/migration config instead of the older schema-embedded `url`/`env()` pattern — confirmed by reading the generated files directly rather than assuming Prisma 5/6-era conventions, the same caution `AGENTS.md` asks for with Next.js itself.
- **Account provisioning is lazy, not webhook-driven.** `context/architecture.md` lists exactly three external-caller API routes (Shopify OAuth callback, Shopify webhooks, job scheduler). A Clerk `user.created` webhook route would be a fourth, undocumented external-caller route, so instead the first authenticated request that resolves a session checks for an existing `AccountUser` row by `clerkUserId` and creates `Account` + `AccountUser` together if none exists (`lib/db/accounts.ts`). A concurrent-first-request race is handled by catching the `AccountUser.clerkUserId` unique-constraint violation (`P2002`) and re-fetching once, not by a silent catch.
- **Prisma 7 requires a driver adapter at runtime.** The `prisma-client` generator's `PrismaClient` no longer connects directly from a datasource URL the way older Prisma versions did — it requires an explicit adapter instance (`@prisma/adapter-pg`'s `PrismaPg`, backed by the `pg` package). `lib/db/client.ts` constructs this once as a dev-mode singleton.
- **Neon connection string uses `sslmode=verify-full`, not `require`.** `pg`/`pg-connection-string` emit a deprecation warning treating `require`/`prefer`/`verify-ca` as aliases for `verify-full` and warn that this will change in a future major version; using `verify-full` explicitly in `.env` (both `DATABASE_URL` and `DATABASE_URL_POOLED`) avoids the warning and locks in the current (correct, already-in-effect) certificate-verification behavior.
- **App renamed to Dockit; Clerk CLI used for Unit 3 setup instead of manual key entry**, per explicit user request — `clerk init` handled SDK install, provider wiring, `proxy.ts`, and env config automatically, linked to a pre-existing Clerk application already named "Dockit".

## Session Notes

- Environment note: this shell has `NODE_ENV=development` set globally, which previously broke `next build`. **Fixed** — `cross-env` is now a dev dependency and every relevant npm script (`dev`, `build`, `start`, `test`, `test:watch`) explicitly sets `NODE_ENV` itself, so a polluted parent-shell value can no longer leak in. No manual workaround needed anymore; just use `npm run <script>` as normal.
- Repo root previously had no git history and a `context/`-path mismatch between `AGENTS.md` and the actual spec file locations; both were fixed in an earlier session (spec files moved into `context/`, git initialized).
- `.env` (real Neon + Clerk credentials) and `.env.example` (placeholder shape, safe to commit) both exist at the repo root. `.env` is gitignored and was confirmed absent from `git status` before every commit involving it.
- `app/dashboard/page.tsx` is **temporary** — built only to give Unit 3 something to verify session→Account resolution against. Unit 4 replaces it with the real `app/(dashboard)/` shell (shadcn sidebar block, store switcher, color tokens).
- User asked specifically for shadcn's `sidebar` block (`SidebarProvider`, `AppSidebar`, `SidebarTrigger`, collapsible-to-icons) for Unit 4's shell — not a hand-rolled sidebar. Install via `npx shadcn@latest add sidebar`.
