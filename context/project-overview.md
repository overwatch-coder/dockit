# Project Overview

## What It Does

This application is a custom product management dashboard for a Shopify store owner. Instead of using Shopify's admin panel to create, edit, and update product content, the owner manages everything from this app. Products are created and edited as drafts, then pushed to Shopify on demand. Changes made directly in Shopify can also be pulled back into the app. The app is built for a single client first, but its data model supports multiple merchant accounts, each with one or more connected stores, so it can be extended to other merchants later.

## Goals

1. Let the store owner manage all product content (title, description, price, variants, images, SEO, tags, collection) without opening Shopify admin.
2. Reduce manual SEO and tagging work by generating those fields with AI, while keeping them editable.
3. Support a draft and publish workflow so changes are reviewed before they go live on Shopify.
4. Detect and surface conflicts when a product is edited in both the app and Shopify directly, instead of silently overwriting either version.
5. Build the data model as multi-tenant from the start, so additional merchant accounts can be added later without a schema rewrite.

## Core User Flow

1. Owner signs in via Clerk (email/password or Google).
2. Owner connects their Shopify store through Shopify OAuth (no manual API tokens).
3. Owner lands on a dashboard showing products scoped to the currently selected store. If they have multiple stores, they can switch between them.
4. Owner creates a new product or opens an existing one to edit. Fields include title, description, price, variants (options like size or color, each with its own price and inventory), images, SEO title and description, tags, collection, and draft/active status.
5. Images uploaded during editing are stored in Vercel Blob until the product is pushed to Shopify.
6. Owner can click a button to generate SEO fields, tags, and a suggested collection using AI. The app fetches existing Shopify collections so the AI can suggest a matching one. All AI-generated fields remain editable, and the owner can accept, edit, or clear them.
7. Owner saves the product. It is stored as a draft in the app's database, not yet reflected on Shopify.
8. Owner pushes the draft to Shopify, either by selecting individual products or using a "push all drafts" action. On successful push, any Vercel Blob image copies for that product are deleted.
9. Owner can click "Sync Store" at any time to pull changes made directly in Shopify back into the app.
10. If a product has unpushed draft changes in the app and has also changed in Shopify since the last sync, the app flags it as a conflict and shows both versions so the owner can resolve it manually. Products with no conflicting changes update automatically.

## Features

**Authentication and accounts**
- Clerk-based sign-in (email/password, Google)
- Multi-tenant account model: one merchant account can be linked to multiple stores
- Shopify store connection via OAuth

**Product management**
- Create, edit, and delete products
- Fields: title, description, price, variants (with per-variant price and inventory), images, SEO title/description, tags, collection assignment, draft/active status
- Image upload to Vercel Blob during draft state

**AI assistance**
- One-click generation of SEO fields, tags, and collection suggestion
- Uses Vercel AI SDK with OpenAI and Groq as initial providers
- All AI output is editable before saving or pushing

**Draft and sync workflow**
- Local draft state before anything reaches Shopify
- Push individual products or all drafts at once
- Manual "Sync Store" pull from Shopify into the app
- Per-product conflict detection using last-synced and last-edited timestamps, with manual resolution when both sides changed

## In Scope

- Product CRUD (create, read, update, delete) for a single connected Shopify store, extendable to multiple stores per account
- Variants with per-variant price and inventory
- Collection assignment (manual or AI-suggested)
- SEO fields and tags, AI-generated and editable
- Draft/active status control
- Draft-then-push workflow to Shopify
- Manual pull-based sync from Shopify with conflict detection
- Multi-tenant data model supporting multiple merchant accounts and multiple stores per account

## Out of Scope

- Order management
- Customer management
- Discounts and promotions
- Inventory management across multiple locations
- Automatic real-time sync (webhooks) in v1; sync is manual/button-triggered only
- Staff or team member accounts (only the store owner has access in v1)
- Shopify App Store public listing and review process (this starts as a private/custom app for one client)

## Success Criteria

- The store owner can sign in, connect their Shopify store, and see their products without visiting Shopify admin.
- The owner can create a product with variants, images, and a collection, generate SEO fields and tags with one click, edit any of it, save it as a draft, and push it to Shopify, where it appears correctly.
- The owner can edit a product directly in Shopify, click "Sync Store," and see that change reflected in the app.
- If the same product is edited in both places between syncs, the app shows the conflict instead of overwriting either version.
- The database and account structure support adding a second merchant account with its own store(s) without requiring schema changes.
