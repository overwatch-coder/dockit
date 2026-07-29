# UI Context

This is an internal operations dashboard, not a marketing site. The design goal is clarity and speed for a single owner managing products all day, not visual flair. Every color, spacing, and component decision below is fixed. Never invent a new one.

Note on components: "ShardCN" refers to shadcn/ui. That's the component library used throughout this file.

## Color Tokens

Primary is a clean indigo-violet, closer to Stripe's restrained use of purple than to Shopify's green, since the brand isn't Shopify-facing, the owner is the one who has to look at this all day. No gradients anywhere. No purple-to-pink AI gradient accents. Flat color only.

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#5B5FEF` | Primary buttons, active nav item, links, focus ring base |
| `--primary-hover` | `#4C4FD9` | Hover/active state for primary buttons |
| `--primary-subtle` | `#EEF0FD` | Selected row background, subtle highlight, badge background for primary-tinted badges |
| `--background` | `#FFFFFF` | Page background |
| `--surface` | `#FAFAFA` | Card and panel backgrounds, sidebar background |
| `--border` | `#E5E5E7` | Default border color for cards, inputs, table rows |
| `--foreground` | `#18181B` | Primary text color |
| `--foreground-muted` | `#71717A` | Secondary text, timestamps, helper text |
| `--foreground-subtle` | `#A1A1AA` | Placeholder text, disabled text |
| `--success` | `#16A34A` | Successful push/sync, "Active" status badge |
| `--warning` | `#D97706` | Draft status, pending job, unpushed changes indicator |
| `--destructive` | `#DC2626` | Delete actions, failed push/sync, destructive confirmation |
| `--conflict` | `#7C3AED` | Reserved specifically for sync conflict indicators, distinct from destructive so a conflict never reads as an outright error |
| `--ring` | `#5B5FEF` (40% opacity) | Focus ring on inputs and buttons |

Do not introduce any other named color. If a new state needs a color (for example, a new job status), pick from this table or extend it explicitly here before using it in code, never inline a new hex value in a component.

## Dark Mode

The app supports both light and dark, toggled via a `.dark` class on `<html>` (next-themes, `attribute="class"`). Dark mode uses the same semantic roles and the same indigo-violet accent family as the light table above, with standard dark-mode brightening for contrast (roughly one Tailwind step lighter than the light-mode equivalent) rather than a different hue or a second invented palette:

| Token | Hex | Notes |
|---|---|---|
| `--primary` | `#818CF8` | Lighter than light mode's `#5B5FEF` for contrast on a dark background |
| `--primary-hover` | `#6366F1` | |
| `--primary-subtle` | `#26263F` | Dark indigo-tinted surface, same role as light mode (selected row, subtle highlight) |
| `--background` | `#0B0B0F` | Near-black, slightly blue-tinted rather than flat black |
| `--surface` | `#17171C` | Cards, panels, sidebar |
| `--border` | `#2A2A31` | |
| `--foreground` | `#F4F4F5` | |
| `--foreground-muted` | `#A1A1AA` | |
| `--success` | `#22C55E` | |
| `--warning` | `#F59E0B` | |
| `--destructive` | `#EF4444` | |
| `--conflict` | `#A78BFA` | |

Same rule applies: don't introduce a color outside this table (light or dark) without extending it here first.

## Typography

- **UI face:** Inter, for all interface text (nav, buttons, body copy, form labels). It's the de facto standard for this kind of product (Linear, Stripe-adjacent dashboards) — huge x-height, extremely legible at small sizes, and a neutral personality that won't compete with the `--primary` indigo-violet accent.
- **Data/mono face:** JetBrains Mono, for anything tabular or precise: SKUs, prices, variant IDs, timestamps, tags. Using mono here signals "this is a value," not prose, and keeps numbers aligned in tables.
- **Type scale:**

| Role | Size | Weight |
|---|---|---|
| Page title | 24px | 600 |
| Section heading | 18px | 600 |
| Body / default | 14px | 400 |
| Label / caption | 12px | 500 |
| Table data (mono) | 13px | 400 |

No display/serif face anywhere. This is a utility dashboard, not a brand moment.

## Border Radius Scale

Minimal and consistent, never pill-shaped, never sharp (0px) either.

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Badges, small buttons, tags |
| `--radius-md` | 8px | Inputs, default buttons, dropdown menus |
| `--radius-lg` | 12px | Cards, modals, panels |

## Component Library Conventions

- Use shadcn/ui for every component that has a shadcn equivalent: buttons, inputs, dialogs, dropdowns, tables, badges, tabs, sidebar/app-shell layout, toasts, select fields, tag/combobox inputs. Never hand-build a component shadcn already provides.
- Customize shadcn components only through the theme tokens above, defined as CSS variables in `app/globals.css` (Tailwind v4 uses CSS-based theme configuration, not a `tailwind.config.js` color palette). Never override individual component internals with one-off classes.
- Icons: lucide-react exclusively, since it's the icon set shadcn is built around. Don't mix in a second icon library.
- Buttons: primary action per view is the `--primary` filled button. Every other action (cancel, secondary navigation) is an outline or ghost button. Never more than one filled primary button visible in the same view.
- Badges: used for all status indicators (Draft, Active, Synced, Conflict, Push Failed). Each maps to exactly one color from the token table above; don't introduce a new badge color per feature.

## Layout Patterns

- **App shell:** shadcn sidebar component on the left (store switcher at the top, product navigation below), main content area on the right. This structure is fixed across every page, no page opts out of the sidebar.
- **Store switcher:** lives at the top of the sidebar, always visible. Switching stores re-scopes the entire main content area to the newly selected store; it never opens a separate page.
- **Product list:** a shadcn table, one row per product, with a status badge (Draft/Active/Conflict), a thumbnail, title, price, and last-synced timestamp as columns. Row click opens the product editor, it does not expand inline.
- **Product editor:** opens as a full page (not a modal), since it has too many fields (title, description, variants, images, SEO, tags, collection) for a dialog. Save Draft and Push to Shopify are separate, clearly distinct actions in the page header, never combined into one button.
- **Conflict resolution:** a modal (shadcn dialog), triggered from a Conflict badge. Shows the app's draft version and Shopify's version side by side in two columns, with the app version on the left and Shopify's on the right, consistently, so the owner learns the layout once and doesn't have to re-read it every time.
- **AI generation:** a single button inside the product editor (near the SEO/tags/collection fields) labeled with what it does, not "Generate with AI" but "Suggest SEO & tags." Suggestions populate the fields directly and are visually marked as suggested (a subtle `--primary-subtle` background on the field) until the owner edits or saves them, at which point the marking clears.
- **Sync/push status:** a small persistent indicator in the top bar (not a full page) showing whether a push or sync job is currently running, with a link to see per-product results if the last job had partial failures.

## What Not To Do

- Never use a raw hex value in component code. Always reference a token.
- Never add a gradient, glow, or blur-based accent anywhere in the interface.
- Never build a custom version of a component shadcn already provides.
- Never introduce a second font family, icon set, or color outside this file without updating this file first.
