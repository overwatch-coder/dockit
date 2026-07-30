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
  inventory: z.coerce.number().int("Inventory must be a whole number").min(0, "Inventory can't be negative"),
});

export type VariantFormInput = z.infer<typeof variantFormSchema>;
