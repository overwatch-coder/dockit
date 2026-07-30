import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getProductById } from "@/lib/db/products";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/product-form";

// Unit 10: editable core fields (title, description, price, status) for a
// single product, saved via updateProduct (app/(dashboard)/products/actions.ts).
// No variants, images, or AI yet — those are Units 11/12/14. Row click and
// the product list's Edit action both land here (components/product-table.tsx).
export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const { id } = await params;

  const product = await getProductById(account.id, id);
  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeft className="size-4" />
          Back to products
        </Button>
      </div>

      <h1 className="text-page-title font-semibold text-foreground">{product.title}</h1>

      <ProductForm mode="edit" product={product} />
    </div>
  );
}
