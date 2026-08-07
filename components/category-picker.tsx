"use client";

import { useRef, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { searchProductCategories } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ShopifyTaxonomyCategory } from "@/lib/shopify/taxonomy";

const SEARCH_DEBOUNCE_MS = 300;

// New (Shopify Product Category unit): unlike components/product-form.tsx's
// Collection <Select>, Shopify's real taxonomy (~10,000 categories) is far
// too large to load wholesale like the small pre-fetched collections list —
// this live-searches as the owner types instead, via the new
// searchProductCategories server action (lib/shopify/taxonomy.ts). The
// debounce is driven entirely from the CommandInput's own onValueChange
// callback, not a useEffect watching `query` — this project's lint config
// (react-hooks/set-state-in-effect) wants state changes triggered by user
// input handled in the event callback itself, not synchronized via an
// effect. A plain setTimeout, not a new dependency.
export function CategoryPicker({
  storeId,
  categoryId,
  categoryFullName,
  onChange,
}: {
  storeId: string;
  categoryId: string;
  categoryFullName: string;
  onChange: (categoryId: string, categoryFullName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShopifyTaxonomyCategory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleQueryChange(next: string) {
    setQuery(next);
    clearTimeout(debounceRef.current);

    if (!next.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const result = await searchProductCategories(storeId, next);
      setResults("success" in result ? result.data : []);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearTimeout(debounceRef.current);
      setQuery("");
      setResults([]);
      setIsSearching(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="w-full max-w-96 justify-between font-normal" />}
      >
        <span className={categoryFullName ? "truncate" : "truncate text-foreground-subtle"}>
          {categoryFullName || "No category"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search Shopify&apos;s product categories..."
            value={query}
            onValueChange={handleQueryChange}
          />
          <CommandList>
            {categoryId && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange("", "");
                    setOpen(false);
                  }}
                >
                  <X className="size-4" />
                  Clear category
                </CommandItem>
              </CommandGroup>
            )}
            {isSearching && <CommandEmpty>Searching...</CommandEmpty>}
            {!isSearching && query.trim() && results.length === 0 && (
              <CommandEmpty>No matching category.</CommandEmpty>
            )}
            {!isSearching && !query.trim() && (
              <CommandEmpty>Type to search Shopify&apos;s product categories.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.id}
                    onSelect={() => {
                      onChange(category.id, category.fullName);
                      setOpen(false);
                    }}
                  >
                    {category.fullName}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
