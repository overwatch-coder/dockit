import { z } from "zod";

// Shared by createProduct/updateProduct (app/(dashboard)/products/actions.ts).
// price stays a string end-to-end (matches Prisma's Decimal-as-string mapping
// in lib/db/products.ts) — coerced only for the positivity check, not stored
// as a parsed number.
export const productFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string(),
  price: z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0, {
      message: "Enter a valid, non-negative price",
    }),
  status: z.enum(["DRAFT", "ACTIVE"], { message: "Select a status" }),
  // Manual collection assignment. Empty string means "no
  // collection" — collectionTitle rides alongside it (the client already
  // knows the title of whichever collection it picked from the fetched
  // list), matching the "write both together" convention.
  collectionId: z.string().trim().optional(),
  collectionTitle: z.string().trim().optional(),
  // Shopify's separate standardized Product Taxonomy category — same "empty
  // string means unset, write both together" convention as collectionId/
  // collectionTitle above.
  categoryId: z.string().trim().optional(),
  categoryFullName: z.string().trim().optional(),
  // Shopify's own SEO title/description — distinct from the main
  // title/description above, manually editable and/or AI-suggested. Empty
  // string means "not set."
  seoTitle: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
