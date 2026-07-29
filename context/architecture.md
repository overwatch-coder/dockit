# Architecture

Assumption: the frontend/backend framework is Next.js (App Router), since Vercel Blob and the Vercel AI SDK are already decided and this matches your existing stack. Flag it if that's wrong.

## Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend/backend framework | Next.js 16 (App Router) | Serves the dashboard UI. Server actions handle product CRUD, push/sync triggers, and AI generation; API routes are reserved for external callers (Shopify OAuth callback, future webhooks, job scheduler triggers) |
| Language | TypeScript | Type safety across frontend, API routes, and Prisma models |
| State management | Zustand | Client-side state for draft product forms, UI state, active store selection |
| Database | PostgreSQL via Neon | Source of truth for accounts, stores, products, drafts, sync metadata |
| ORM | Prisma | Schema definition, migrations, and typed database access |
| Auth | Clerk | Owner sign-in (email/password, Google), session management |
| File storage | Vercel Blob | Temporary storage for product images while a product is in draft state |
| AI layer | Vercel AI SDK | Unified interface to call OpenAI or Groq for SEO/tags/collection generation |
| AI providers | OpenAI, Groq | Underlying models called through the Vercel AI SDK |
| External API | Shopify Admin GraphQL API | Product CRUD on Shopify, collection lookup, OAuth-based store connection |
| Background jobs | Job queue (e.g. Inngest or a Vercel-compatible queue) | Runs push-to-Shopify and sync-from-Shopify operations outside the request/response cycle |
| Hosting | Vercel | Deployment for the app and its API routes |

## System Boundaries

The rule for choosing between the two: if a human triggers it by clicking something in the dashboard, it's a server action. If an external system calls into the app (Shopify redirecting after OAuth, a Shopify webhook, a cron-based job scheduler), it's an API route.

**Server actions** (`app/(dashboard)/**/actions.ts`)
- Product CRUD: create, edit, delete, save draft. Owns validation and persistence to Postgres via Prisma. Does not call Shopify directly.
- AI generation trigger: calls the Vercel AI SDK to generate SEO fields, tags, and collection suggestion for a single product. Returns suggestions only; never writes directly to the product record.
- Push trigger: enqueues a push job for one or more drafts. Does not perform the push itself; hands off to the background job layer.
- Sync trigger: enqueues a "Sync Store" pull job. Does not perform the pull itself.

**API routes** (`app/api/`), reserved for external callers only
- `app/api/shopify/oauth/callback/` — Receives the redirect from Shopify after the owner approves the store connection. Exchanges the auth code for a token and hands off to `lib/shopify/`.
- `app/api/shopify/webhooks/` — Reserved for future real-time webhook handling, not used in v1 since sync is manual.
- `app/api/jobs/run/` — Endpoint the job scheduler (e.g. Vercel Cron or QStash) hits to process queued push/sync jobs. Not called from the UI.

**Shared library boundaries**
- `app/(dashboard)/` — All owner-facing UI: product list, product editor, store switcher, sync status. Owns rendering and client-side form state only. Never talks to Shopify or Prisma directly; calls server actions.
- `lib/shopify/` — All Shopify API interaction (OAuth token exchange, GraphQL queries/mutations, collection fetching). This is the only part of the codebase allowed to call Shopify.
- `lib/jobs/` — Background job definitions for push and sync operations, including conflict detection logic.
- `lib/db/` — Prisma client and query helpers. This is the only part of the codebase allowed to query the database directly; server actions, API routes, and jobs all go through it.
- `lib/ai/` — Vercel AI SDK configuration and prompt construction for SEO/tag/collection generation.

## Storage Model

| Data | Where it lives | Notes |
|---|---|---|
| Accounts, stores, store-to-account links | Postgres (Prisma) | Multi-tenant from day one: every row below is scoped to an account/store |
| Products (draft and last-known-synced state) | Postgres (Prisma) | Includes fields for title, description, price, variants, tags, collection ID, status, plus `lastEditedAt` and `lastSyncedAt` timestamps for conflict detection |
| Variants | Postgres (Prisma), child table of products | Each variant has its own price and inventory count |
| Product images (draft state) | Vercel Blob | Deleted once the product is successfully pushed and the image lives on Shopify's CDN |
| Product images (published state) | Shopify CDN | Source of truth once pushed; the app references the Shopify image URL, not a local copy |
| Shopify OAuth tokens | Postgres (Prisma), encrypted at rest | Scoped per store, used by `lib/shopify/` for all API calls |
| Sync/conflict state | Postgres (Prisma) | Per-product flag plus a snapshot of both versions when a conflict is detected, cleared once the owner resolves it |
| Session data | Managed by Clerk | Not stored in the app's own database |

## Auth and Access Model

- Owner authentication is handled entirely by Clerk. The app never stores passwords.
- Every database row that isn't a system table (products, drafts, stores, tokens) carries an `accountId` and, where relevant, a `storeId`.
- Every API route and job must resolve the authenticated Clerk user to an `accountId` before touching any data, and every database query must be filtered by that `accountId`. There is no cross-account query path.
- Shopify OAuth tokens are stored per store, not per account, since one account can hold multiple stores. A request against store A can never use store B's token, even within the same account.
- v1 has a single role (owner) per account. The schema should still include a `role` field on the account-user relationship so staff roles can be added later without a migration that changes the shape of existing data.

## AI and Background Task Model

- AI generation (SEO/tags/collection) is a synchronous request from the UI: the owner clicks the button, a server action calls the Vercel AI SDK, and the suggestion returns directly to the form. It does not go through the job queue since it's a single fast call and the result must be reviewable before anything is saved.
- Push-to-Shopify and Sync Store operations go through the background job queue, not the request/response cycle. Pushing "all drafts" or pulling a full catalog can involve many Shopify API calls and can exceed a typical request timeout, especially for larger catalogs.
- Conflict detection runs as part of the sync job: for each product being pulled, compare Shopify's `updated_at` against the app's `lastSyncedAt`. If the app also has unpushed changes (`lastEditedAt` after `lastSyncedAt`), mark the product as conflicted instead of overwriting it.
- Job status (running, succeeded, failed, partially failed) is written to Postgres so the UI can show sync/push progress and surface failures per product rather than as a single opaque success/failure for the whole batch.

## Invariants

1. Only `lib/shopify/` is allowed to make calls to the Shopify API. No server action, API route, job, or UI component calls Shopify directly.
2. Only `lib/db/` is allowed to query the database directly. Server actions, API routes, and jobs call into `lib/db/`, never `prisma.*` inline elsewhere.
3. Every database query for products, drafts, stores, or tokens must be scoped by `accountId` (and `storeId` where applicable). A query with no account scope is a bug, not an edge case.
4. Push and sync operations always run through the background job queue, never inline in a server action. Server actions only enqueue jobs and read job status; they do not perform the Shopify calls themselves.
5. API routes exist only for external callers (Shopify OAuth callback, webhooks, job scheduler). Anything triggered by a click inside the dashboard is a server action, never a new API route.
6. A product with unpushed draft changes is never silently overwritten by a Shopify-side change during sync. It is always flagged as a conflict and left for the owner to resolve.
7. AI-generated content (SEO fields, tags, collection) is never written to a product record automatically. It is returned as a suggestion and only persisted when the owner saves the product.
8. Product images only move from Vercel Blob to Shopify's CDN, never the reverse, and a Blob copy is deleted only after the corresponding push to Shopify succeeds, not before.
