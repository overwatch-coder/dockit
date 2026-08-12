import { z } from "zod";

// Shared by addVariant/updateVariant (app/(dashboard)/products/actions.ts).
// price follows the same non-negative-decimal shape as
// lib/validation/product.ts's price field; inventory is a plain
// non-negative integer (Variant.inventory is `Int`, not `Decimal`).
export const variantFormSchema = z.object({
  optionName: z.string().trim().min(1, "Option name is required"),
  price: z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0, {
      message: "Enter a valid, non-negative price",
    }),
  inventory: z
    .coerce
    .number("Inventory must be a whole number")
    .int("Inventory must be a whole number")
    .min(0, "Inventory can't be negative"),
  // Unit 25: which of the product's own gallery images (if any) this
  // variant should link to on Shopify — a plain URL string, matching how
  // this app already treats image identity everywhere else (Product.imageUrl/
  // imageUrls are themselves just URL strings, never a separate id table).
  // Whether the URL actually belongs to this variant's own product can't be
  // checked here, since this schema only ever sees one variant in
  // isolation — enforced instead by lib/db/variants.ts's
  // isValidVariantImageUrl, the layer that has the product loaded.
  // .default(null) normalizes an absent field to null so every parsed
  // variant always has this key, same "always present, never optional"
  // convention as the rest of the domain's Variant type.
  imageUrl: z.string().trim().min(1).nullable().default(null),
});

export type VariantFormInput = z.infer<typeof variantFormSchema>;
