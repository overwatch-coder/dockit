# Code Standards

## General Principles

1. No `any`. If a type is genuinely unknown, use `unknown` and narrow it, never `any`.
2. No direct Prisma calls outside `lib/db/`. Every database read or write goes through a function in `lib/db/`, even if the query is a one-liner.
3. No direct Shopify API calls outside `lib/shopify/`. Every request to Shopify's GraphQL API goes through a function in `lib/shopify/`, even a simple product fetch.
4. Every function that touches a product, draft, store, or token takes an `accountId` (and `storeId` where relevant) as an explicit parameter. Never infer tenant scope from a global session variable deep inside a helper function.
5. No silent catches. Every `catch` block either rethrows, returns a typed error result, or logs with enough context (accountId, storeId, productId) to debug it later. An empty `catch {}` is not allowed.
6. Functions do one thing. If a function both calls Shopify and writes to Postgres, split it into two functions and call both from the caller.

## TypeScript Rules

- Define a shared `types/` directory for domain types (Product, Variant, Store, Account, SyncJob, PushJob). Server actions, jobs, and UI components import from here, not from Prisma's generated types directly, so the domain shape is decoupled from the database schema.
- Prisma-generated types are only used inside `lib/db/`. Convert them to domain types before returning data to a server action or component.
- Use discriminated unions for job and sync states, not string literals compared with `===` scattered across the codebase. Example: `type JobStatus = { state: "pending" } | { state: "running" } | { state: "failed"; error: string } | { state: "succeeded" }`.
- All server action inputs are validated with a schema (e.g. Zod) before touching the database. Never trust a form value's TypeScript type alone, since it's not enforced at runtime.
- Exported functions always have explicit return types. Don't rely on inference for anything that crosses a module boundary.

## Framework-Specific Rules (Next.js 16, React)

- Server actions live next to the feature that uses them, e.g. `app/(dashboard)/products/actions.ts`, not in one giant shared `actions.ts` file.
- A server action's job is to: validate input, call the appropriate `lib/db/` or `lib/jobs/` function, and return a typed result. It does not contain business logic inline. Business logic lives in `lib/`.
- API routes are only created for the three documented external-caller cases (Shopify OAuth callback, webhooks, job scheduler trigger). Adding a new API route for anything triggered by the dashboard UI is not allowed. Use a server action instead.
- Client components that need interactivity are marked `"use client"` explicitly at the top of the file. Don't mark a whole page client-side just because one child needs state; extract that child into its own client component.
- Zustand stores are scoped per feature (e.g. a store for the product editor's in-progress form state), not one global store for the entire app. Don't put server-fetched data into Zustand; that belongs in React Server Component data fetching or a query cache.
- Loading and error states are handled with Next.js's `loading.tsx` and `error.tsx` conventions at the route level, not with manual `isLoading` booleans wrapping entire pages.

## Styling Rules

- Tailwind utility classes only. No inline `style={}` objects except for values that are computed at runtime (e.g. a progress bar width from a percentage).
- No custom CSS files. If a pattern repeats more than twice, extract it into a component, not a shared CSS class.
- Design tokens (colors, spacing, font sizes) come from the Tailwind config, not hardcoded hex values or pixel counts in component code.
- Icons come from a single icon library chosen up front (e.g. lucide-react). Don't mix icon sets.

## API Rules (Shopify Integration)

- All Shopify calls use the GraphQL Admin API, not the REST Admin API. Don't mix both in the same codebase.
- Every Shopify mutation (create/update/delete product) is wrapped in a function in `lib/shopify/` that returns a typed result: `{ success: true; data: T } | { success: false; error: string }`. Callers never deal with raw GraphQL response shapes.
- Shopify API errors are never swallowed. If a push or sync job fails partway through a batch, the job records which specific products succeeded and which failed, so the owner sees a per-product result, not a single opaque "sync failed."
- Rate limit handling (retry with backoff) lives inside `lib/shopify/`, not duplicated in every job that calls it.
- The frontend never calls Shopify directly, not even for a read. Every product view the owner sees comes from the app's own database, kept current through push/sync, not a live Shopify call on every page load.

## Data and Storage Rules

- The database (Postgres via Prisma) is the source of truth for anything the owner sees while browsing the app: draft products, last-synced product state, sync/conflict status, store connections, encrypted OAuth tokens.
- Product images in draft state live in Vercel Blob. Once a push succeeds, the Blob URL is replaced with the Shopify CDN URL on the product record, and the Blob file is deleted. A product record never references both a Blob URL and a Shopify CDN URL for the same image at the same time.
- Nothing sensitive (OAuth tokens, API keys) is ever stored in plaintext. Tokens are encrypted at rest and decrypted only inside `lib/shopify/` at the moment of use.
- Session and auth state is never duplicated into the app's own database. Clerk owns that; the app only stores the `accountId` it maps to.
- Every query against products, drafts, or stores includes an explicit `where: { accountId }` (and `storeId` where relevant), even when the caller already "knows" the account from context. This is enforced at the `lib/db/` function signature level, not left to the caller to remember.
- Job status and conflict snapshots (both versions of a product when a conflict is detected) are persisted in Postgres, not held only in memory, so a page refresh or server restart doesn't lose the owner's pending conflict resolution.

## File Organization

- `app/(dashboard)/` — Owner-facing pages and layouts. Product list, product editor, store switcher, sync/push status views.
- `app/(dashboard)/products/actions.ts` — Server actions for product CRUD and AI generation trigger.
- `app/(dashboard)/products/store.ts` — Zustand store for the product editor's in-progress draft form state.
- `app/api/shopify/oauth/callback/` — Handles the Shopify OAuth redirect after store connection approval.
- `app/api/shopify/webhooks/` — Reserved for future webhook handling.
- `app/api/jobs/run/` — Endpoint the job scheduler calls to process queued push/sync jobs.
- `lib/db/` — Prisma client and all database query functions, grouped by domain (`lib/db/products.ts`, `lib/db/stores.ts`, `lib/db/accounts.ts`, `lib/db/jobs.ts`).
- `lib/shopify/` — Shopify GraphQL client, OAuth token exchange, product mutations, collection fetching, rate limit handling.
- `lib/jobs/` — Background job definitions: push job, sync job, conflict detection logic.
- `lib/ai/` — Vercel AI SDK configuration, prompt templates for SEO/tags/collection generation.
- `types/` — Shared domain types (Product, Variant, Store, Account, JobStatus) used across server actions, jobs, and components.
- `prisma/schema.prisma` — Database schema, including `accountId`/`storeId` scoping on every relevant model.
