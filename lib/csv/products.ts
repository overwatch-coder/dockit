import type { Product } from "@/types/product";

// Unit 26: quotes (and doubles any internal double quote) only when a field
// actually needs it — a comma, quote, or newline — matching RFC 4180's
// minimal-quoting convention rather than quoting every field
// unconditionally.
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const CSV_HEADER = ["Title", "Price", "Status", "Category", "Tags", "Variants", "Last Synced"];

// Unit 26, per context/00-build-plan.md: "title, price, status, category,
// tags, variant summary, last-synced timestamp." A few presentation choices
// weren't pinned down by that one-line spec and are flagged here as
// assumptions rather than silently picked, per ai-workflow-rules.md #14:
// - Status renders Title Case ("Draft"/"Active"), matching the product
//   table's own ProductStatusBadge labels — this file is meant to be opened
//   by a person, not machine-parsed against the raw DB enum.
// - Category is collectionTitle, the same field the product table's own
//   "Category" column already shows. Shopify's separate standardized
//   Product Taxonomy (categoryFullName) isn't a second column, since the
//   table itself only ever surfaces one "category" concept too.
// - Variants are summarized as "name (price, qty inventory)" per variant,
//   joined with "; " into a single field — a compact one-line summary, not
//   a full per-variant breakdown table, matching the spec's own word
//   "summary".
// - Last Synced is a full ISO 8601 timestamp, not the product table's
//   locale-formatted display string — a CSV is meant for spreadsheet/
//   scripted consumption, where an unambiguous, sortable timestamp is more
//   useful than a human-readable one. Never synced renders as an empty
//   field.
function toCsvRow(product: Product): string[] {
  const variantsSummary = product.variants
    .map((variant) => `${variant.optionName} (${variant.price}, qty ${variant.inventory})`)
    .join("; ");

  return [
    product.title,
    product.price,
    product.status === "ACTIVE" ? "Active" : "Draft",
    product.collectionTitle ?? "",
    product.tags.join("; "),
    variantsSummary,
    product.lastSyncedAt ? product.lastSyncedAt.toISOString() : "",
  ];
}

export function buildProductsCsv(products: Product[]): string {
  const rows = [CSV_HEADER, ...products.map(toCsvRow)];
  // CRLF line endings, per RFC 4180 — the widely-expected CSV convention
  // (Excel/Sheets both handle a bare \n fine too, but \r\n is the actual
  // spec and costs nothing extra to get right).
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}
