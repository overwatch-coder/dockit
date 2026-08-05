import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormSkeleton } from "@/components/product-form-skeleton";

// Plain file-based loading.tsx / React Suspense — not Cache Components (see
// context/progress-tracker.md's Open Questions for why that was ruled out).
export default function NewProductLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-7 w-40" />
      <ProductFormSkeleton />
    </div>
  );
}
