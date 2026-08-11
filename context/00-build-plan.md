# Build Plan

Each unit produces one visible or verifiable result, stays within one system boundary from `architecture.md`, and can be built in a single focused session. Dependencies are introduced just in time, nothing is installed or scaffolded before the unit that needs it.

## Phase A: Foundation

**Unit 1: Project scaffold and tooling**
What it builds: Next.js 16 app with TypeScript, Tailwind v4, shadcn/ui initialized, Geist Sans/Geist Mono fonts wired up, base folder structure from `code-standards.md` (`app/`, `lib/`, `types/`) created as empty shells. No features, no database, no auth.
Dependencies: none.

**Unit 2: Database schema and migrations**
What it builds: `prisma/schema.prisma` with Account, Store, Product, Variant, SyncJob/PushJob, and OAuth token models, all non-account tables scoped with `accountId`/`storeId`. Initial migration run against Neon. No app code reads or writes to it yet, just the schema and a confirmed working connection.
Dependencies: Unit 1.

**Unit 3: Authentication**
What it builds: Clerk sign-in/sign-up integrated, a session resolves to an `accountId`, and a new Clerk user automatically gets an Account row created in Postgres on first sign-in. Verifiable by signing in and confirming an Account row exists.
Dependencies: Units 1, 2.

**Unit 4: App shell and static layout**
What it builds: Sidebar, store switcher, and main content layout per `ui-context.md`, using shadcn's sidebar component, color tokens, and radius scale. Store switcher shows placeholder/mock stores, not real data. No API calls yet.
Dependencies: Units 1, 3 (shell is behind auth).

## Phase B: Shopify Connection

**Unit 5: Shopify OAuth connect flow**
What it builds: "Connect store" button, the `app/api/shopify/oauth/callback/` route, token exchange, and encrypted token storage against a new Store row linked to the current account. Verifiable by connecting a real Shopify store and seeing a Store row appear.
Dependencies: Units 2, 3, 4.

**Unit 6: Background job queue infrastructure**
What it builds: Job queue setup (e.g. Inngest), the SyncJob/PushJob table wiring, the `app/api/jobs/run/` scheduler endpoint, and a minimal job runner that can execute a no-op job end to end. No product logic yet, just the plumbing and one test job that proves it fires and records status.
Dependencies: Units 2, 5.

**Unit 7: Initial store import**
What it builds: A job that pulls all products from a newly connected Shopify store into the app's database on first connect, using `lib/shopify/` for the GraphQL calls. Verifiable by connecting a store and seeing its real products appear in the database.
Dependencies: Unit 6.

## Phase C: Product Viewing

**Unit 8: Product list UI**
What it builds: The product list table (thumbnail, title, price, status badge, last-synced timestamp) wired to real data from the current store, per the layout in `ui-context.md`. Read-only.
Dependencies: Units 4, 7.

## Phase D: Core Product Editing

**Unit 9: Product editor, core fields**
What it builds: The product editor page showing title, description, price, and draft/active status for a single product, read from the database. No save yet, no variants, no images, no AI.
Dependencies: Unit 8.

**Unit 10: Product create/edit/delete (core fields only)**
What it builds: Server actions in `app/(dashboard)/products/actions.ts` to create, edit, and delete a product's core fields (title, description, price, status) as a draft in Postgres. Verifiable by creating, editing, and deleting a product and confirming the database state.
Dependencies: Unit 9.

## Phase E: Variants

**Unit 11: Variant management**
What it builds: UI inside the product editor to add/edit/remove variants (option name, per-variant price, per-variant inventory), plus the server action and database writes for variants as a child of the product draft.
Dependencies: Unit 10.

## Phase F: Images

**Unit 12: Draft image upload**
What it builds: Image upload inside the product editor to Vercel Blob while the product is a draft, with the Blob URL stored on the product record. No Shopify interaction yet.
Dependencies: Unit 10.

## Phase G: Collections and Tags (Manual)

**Unit 13: Manual collection and tag assignment**
What it builds: A collection select field (populated from Shopify collections fetched via `lib/shopify/`) and a tag input field on the product editor, both manually set by the owner, saved as part of the draft.
Dependencies: Unit 10.

## Phase H: AI Generation

**Unit 14: AI SEO, tags, and collection suggestion**
What it builds: The "Suggest SEO & tags" button, the server action that calls the Vercel AI SDK via `lib/ai/`, and the suggested-field visual state described in `ui-context.md`. Suggestions populate the fields from Unit 13 and the description/title fields from Unit 10, editable before save.
Dependencies: Units 10, 13.

## Phase I: Push to Shopify

**Unit 15: Push a single draft**
What it builds: The push server action (enqueues a job), the push job itself in `lib/jobs/` (creates/updates the product on Shopify via `lib/shopify/`, promotes images from Vercel Blob to the returned Shopify CDN URL, deletes the Blob copy on success). Verifiable by pushing one product and confirming it appears correctly on the actual Shopify store.
Dependencies: Units 6, 11, 12, 13.

**Unit 16: Push all drafts**
What it builds: The "push all drafts" action and batch handling in the push job, including per-product success/failure tracking within a single job run.
Dependencies: Unit 15.

## Phase J: Sync from Shopify

**Unit 17: Manual sync (non-conflicting path)**
What it builds: The "Sync Store" trigger and the sync job that pulls current Shopify product state and updates the database, for the case where no unpushed draft changes exist. No conflict handling yet.
Dependencies: Units 6, 7.

**Unit 18: Conflict detection**
What it builds: The comparison logic inside the sync job using `lastEditedAt`/`lastSyncedAt`, flagging a product as conflicted and storing a snapshot of both versions instead of overwriting, per the invariant in `architecture.md`.
Dependencies: Unit 17.

**Unit 19: Conflict resolution UI**
What it builds: The conflict modal from `ui-context.md` (app draft on the left, Shopify version on the right), and the server action that applies the owner's chosen resolution and clears the conflict flag.
Dependencies: Unit 18.

## Phase K: Status and Polish

**Unit 20: Job status indicator**
What it builds: The persistent top-bar indicator showing running push/sync jobs, with a link to per-product results when a job had partial failures.
Dependencies: Units 15, 16, 17.

**Unit 21: Multi-store switching, end to end**
What it builds: The store switcher from Unit 4 wired to real stores, re-scoping the product list, editor, and job status to whichever store is selected.
Dependencies: Units 5, 8, 20.

**Unit 22: Error handling and rate limit pass**
What it builds: Retry-with-backoff for Shopify rate limits inside `lib/shopify/`, and a review pass across all server actions and jobs confirming every error path from `code-standards.md` and every invariant from `architecture.md` is actually satisfied, not just the happy path.
Dependencies: all previous units.

## Phase L: Catalog Productivity

Proposed after v1 shipped, per explicit owner request. Units 23–24 are complete; Units 25–28 remain for review before implementation.

**Unit 23: Product duplication**
What it builds: A "Duplicate" action on an existing product (product list row menu and/or the editor) that creates a new local-only draft copying the original's title (suffixed "Copy"), description, price, variants, tags, collection, category, and SEO fields. Images are duplicated as references to the same URLs, not re-uploaded to Blob. The new draft's `shopifyProductId` stays null, same as any other newly created product — a duplicate is never automatically pushed.
Dependencies: Unit 10.

**Unit 24: Bulk AI generation**
What it builds: A bulk counterpart to Unit 14's single-product "Suggest SEO & tags" — select multiple products from the list, queue an AI suggestion for each through the existing `lib/ai/` path, and review/apply results per product before anything is saved. Suggestions are never auto-applied to any product in the batch (`architecture.md` invariant 7 still applies per product, not just to a single-product flow).
Dependencies: Units 8, 14.

**Unit 25: Variant-level images**
What it builds: Lets a variant reference one specific image from the product's gallery (e.g. one photo per color option) instead of every variant implicitly sharing the whole gallery. Touches the variant editor (an image picker per row) and the push mutation's media-to-variant linking on Shopify's side (exact mutation shape to be verified against shopify.dev before implementing, per `ai-workflow-rules.md` #15 — not assumed up front).
Dependencies: Units 11, 12, 15.

**Unit 26: CSV catalog export**
What it builds: An "Export CSV" action on the product list that downloads the current (optionally filtered) catalog view as a CSV file — title, price, status, category, tags, variant summary, last-synced timestamp. Read-only; adds no new server-side state.
Dependencies: Unit 8.

**Unit 27: CSV catalog import**
What it builds: An "Import CSV" flow that reads an uploaded CSV file and bulk-creates local draft products from it, reusing Unit 10's create path per row and surfacing per-row validation errors (malformed price, missing title, etc.) up front before anything is saved, rather than after a partial import. Imported products are drafts like any other — never auto-pushed to Shopify.
Dependencies: Unit 10.

**Unit 28: Select-all-across-pages for bulk actions**
What it builds: Extends the product list's existing page-scoped bulk selection (deliberately deferred during the earlier pagination work) with a "Select all N products matching this filter" option, so bulk actions (push, status change, delete) can apply across every matching product, not just the rows on the current page.
Dependencies: Unit 8.

## Phase M: History and Insights

Proposed after v1 shipped, per explicit owner request. Not yet started — added to the plan for review before any unit here begins.

**Unit 29: Per-product activity log**
What it builds: A timeline on the product editor showing what happened and when — edited, pushed, synced, conflict flagged/resolved — built from a new lightweight event-log table (a schema change, requiring explicit approval per `ai-workflow-rules.md` #16 before `prisma/schema.prisma` is touched) plus the `lastEditedAt`/`lastSyncedAt` timestamps already on the product.
Dependencies: Units 10, 15, 17, 19.

**Unit 30: Low-stock and pricing sanity alerts**
What it builds: A dashboard callout surfacing products with unusually low variant inventory or a price that looks like a data-entry mistake (e.g. zero, or implausibly low relative to the store's typical range), computed entirely from data already on `Product`/`Variant` — no new external calls.
Dependencies: Unit 8.

## Phase N: Access and Scheduling

Proposed after v1 shipped, per explicit owner request. Not yet started — added to the plan for review before any unit here begins.

**Unit 31: Staff accounts**
What it builds: Activates the `AccountRole` field `architecture.md`'s schema already reserves for this (`v1 has a single role (owner) per account`) — a second role (e.g. "editor") that can edit and save products but not push, sync, delete, or manage store connections, plus an invite flow for the owner to add a staff member to their account.
Dependencies: Units 3, 4.

**Unit 32: Scheduled publishing**
What it builds: Lets a draft product be scheduled to flip to Active and push automatically at a future date/time, instead of a manual status toggle. Needs a new background scheduling mechanism beyond the existing click-triggered job queue (e.g. a periodic check against a new `scheduledFor` field) — the first job in this app not triggered directly by an owner's click.
Dependencies: Units 6, 10, 15.
