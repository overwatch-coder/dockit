# Dockit

Dockit is a custom product management dashboard for a Shopify store owner. Instead of using
Shopify's admin panel to create, edit, and update product content, the owner manages everything
from this app — products are created and edited as drafts, then pushed to Shopify on demand, and
changes made directly in Shopify can be pulled back into the app with conflict detection.

The app is built for a single client first, but its data model is multi-tenant (one merchant
account can be linked to multiple Shopify stores), so it can be extended to other merchants later.

## Features

- **Authentication and accounts** — Clerk-based sign-in (email/password, Google), multi-tenant
  account model, Shopify store connection via OAuth.
- **Product management** — create, edit, and delete products with title, description, price,
  variants (per-variant price and inventory), images, SEO title/description, tags, collection
  assignment, and Shopify Product Category (standardized taxonomy, manual search or AI-assisted).
- **Image uploads** — product images are uploaded to Vercel Blob while a product is in draft
  state, and cleaned up once the product is pushed to Shopify.
- **AI assistance** — one-click generation of SEO fields, tags, collection suggestions, and
  Shopify Product Category suggestions via the Vercel AI SDK (OpenAI and Groq). All AI output is
  editable before saving or pushing.
- **Draft and sync workflow** — local draft state before anything reaches Shopify, push
  individual products or all drafts at once, manual "Sync Store" pull from Shopify, and
  per-product conflict detection when a product changes on both sides between syncs.

See `context/project-overview.md` for the full product spec, and `context/architecture.md` for
system structure and data model details.

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router) with React 19 and TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) with shadcn/ui components
- [Prisma 7](https://www.prisma.io/) with PostgreSQL (targeting [Neon](https://neon.tech/))
- [Clerk](https://clerk.com/) for authentication
- [Shopify Admin API](https://shopify.dev/docs/api/admin) via OAuth for store integration
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) for draft image storage
- [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI/Groq for AI-assisted content
- [Inngest](https://www.inngest.com/) for background jobs
- [Vitest](https://vitest.dev/) + Testing Library for tests

## Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database (this project is built against [Neon](https://neon.tech/) — a direct
  connection string for migrations, and a pooled connection string for runtime queries)
- A [Clerk](https://clerk.com/) application
- A [Shopify Partner](https://partners.shopify.com/) account with a custom app (for OAuth
  credentials) — see `shopify.app.toml`
- A [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store
- An [OpenAI](https://platform.openai.com/api-keys) API key (used for the AI-assisted product
  fields)

## Getting Started

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/overwatch-coder/dockit.git
   cd dockit
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in real values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `DATABASE_URL` | Direct (non-pooled) Postgres connection string, used by Prisma for schema/migrations |
   | `DATABASE_URL_POOLED` | Pooled Postgres connection string, used by the app at runtime |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk sign-in/sign-up routes |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Post-auth redirect routes |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk API keys — set up via `clerk init` ([docs](https://clerk.com/docs/cli)) |
   | `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Credentials from your Shopify custom app |
   | `SHOPIFY_APP_URL` | Base URL the app is served from (e.g. `http://localhost:3000`) |
   | `SHOPIFY_SCOPES` | Shopify OAuth scopes, e.g. `read_products,write_products,read_collections` |
   | `SHOPIFY_TOKEN_ENCRYPTION_KEY` | 32-byte base64 key used to encrypt stored Shopify tokens — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
   | `OPENAI_API_KEY` | OpenAI API key used for AI-assisted SEO/tag/category suggestions |

3. **Set up the database**

   ```bash
   npx prisma migrate dev
   ```

   This applies migrations in `prisma/migrations` and generates the Prisma client into
   `lib/generated/prisma`.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   The app runs at [http://localhost:3000](http://localhost:3000). This also starts the Inngest
   dev server (`INNGEST_DEV=1`) for background jobs.

5. **Connect Shopify**

   Sign in, then connect a Shopify store via OAuth. `shopify.app.toml` holds the app
   configuration used by the [Shopify CLI](https://shopify.dev/docs/apps/tools/cli); update the
   `redirect_urls` and `application_url` if your local/deployed URL differs.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the app in development mode (with Inngest dev server) |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run the test suite in watch mode |

## Testing

Tests live in `tests/` (mirroring `app/`, `components/`, and `lib/`) and run with Vitest and
Testing Library:

```bash
npm run test
```

This project follows a TDD approach — new functionality should be accompanied by tests in
`tests/`.

## Project Structure

```
app/            Next.js App Router routes (dashboard, auth, API routes)
components/     Reusable React components (UI, forms, layout)
context/        Product spec, architecture, conventions, and progress tracker
hooks/          Shared React hooks
lib/            Core logic: AI, Shopify client, database, blob storage, jobs, validation
prisma/         Prisma schema and migrations
tests/          Test suite, mirroring the app/components/lib structure
types/          Shared TypeScript types
public/         Static assets
```

For a deeper look at system boundaries, storage model, and invariants, read
`context/architecture.md`. For coding conventions, read `context/code-standards.md`.

## Contributing

1. Create a feature branch from `main`.
2. Make your changes, following the conventions in `context/code-standards.md` and keeping the
   existing UI/design/app structure unless a change is explicitly in scope.
3. Add or update tests in `tests/` and make sure `npm run test` and `npm run lint` pass.
4. Update `context/progress-tracker.md` with what changed.
5. Open a pull request.

## License

No license has been chosen yet for this project.
