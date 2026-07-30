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
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
