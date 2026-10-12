"use client";

import React, { useState } from "react";
import {
  Store,
  Package,
  GitCompare,
  Wand2,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
} from "lucide-react";

type NavTab = "catalog" | "conflict" | "ai" | "sync";
type FilterTab = "all" | "drafts" | "synced" | "conflicts";

const SAMPLE_PRODUCTS = [
  {
    id: "1",
    title: "Minimalist Leather Backpack",
    category: "Apparel & Accessories > Bags",
    sku: "BP-LTH-01",
    price: "$120.00",
    stock: "45 in stock",
    status: "Synced",
    date: "Synced 4m ago",
  },
  {
    id: "2",
    title: "Organic Cotton Oversized Hoodie",
    category: "Apparel & Accessories > Clothing",
    sku: "HD-COT-02",
    price: "$85.00",
    stock: "120 in stock",
    status: "Draft",
    date: "Edited 12m ago",
  },
  {
    id: "3",
    title: "Wireless Noise-Canceling Headphones",
    category: "Electronics > Audio Equipment",
    sku: "HP-WRL-03",
    price: "$199.00",
    stock: "28 in stock",
    status: "Draft",
    date: "Edited 1h ago",
  },
  {
    id: "4",
    title: "Ceramic Minimalist Mug Set",
    category: "Home & Garden > Kitchenware",
    sku: "MG-CRM-04",
    price: "$44.00",
    stock: "85 in stock",
    status: "Synced",
    date: "Synced 2h ago",
  },
  {
    id: "5",
    title: "Ergonomic Mechanical Keyboard",
    category: "Electronics > Computer Accessories",
    sku: "KB-ERG-05",
    price: "$149.00",
    stock: "60 in stock",
    status: "Conflict",
    date: "Conflict detected",
  },
];

export function AppShowcase() {
  const [activeTab, setActiveTab] = useState<NavTab>("catalog");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({ "2": true, "3": true });
  const [activeStore, setActiveStore] = useState("Acme Supply Co. (US)");
  const [conflictChoices, setConflictChoices] = useState<Record<string, "dockit" | "shopify">>({
    title: "dockit",
    price: "shopify",
    inventory: "shopify",
  });

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredProducts = SAMPLE_PRODUCTS.filter((item) => {
    if (activeFilter === "drafts") return item.status === "Draft";
    if (activeFilter === "synced") return item.status === "Synced";
    if (activeFilter === "conflicts") return item.status === "Conflict";
    return true;
  });

  const getUrl = () => {
    switch (activeTab) {
      case "conflict":
        return "dockit.app/products/conflict-resolver?sku=KB-ERG-05";
      case "ai":
        return "dockit.app/products/ai-taxonomy?sku=BP-LTH-01";
      case "sync":
        return "dockit.app/settings/store-sync";
      default:
        return "dockit.app/products/staging-queue";
    }
  };

  return (
    <section id="showcase" className="py-16 md:py-20 border-b border-border/80 bg-surface/20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-medium">
              Interactive Workspace
            </span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Built for speed, clarity, and precision
            </h2>
          </div>
          <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
            Click through the workspace operations below to inspect real catalog management workflows: draft queues, diff resolvers, and AI taxonomy.
          </p>
        </div>

        {/* Desktop Interface Container */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2.5">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </div>

            <div className="hidden min-w-0 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground sm:flex">
              <Search className="size-3 shrink-0 text-muted-foreground/60" />
              <span className="truncate font-mono text-[11px]">{getUrl()}</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              <span className="text-[11px]">Shopify OAuth Active</span>
            </div>
          </div>

          {/* App Layout Split */}
          <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] min-h-[460px]">
            {/* Sidebar */}
            <aside className="border-r border-border bg-surface p-3 flex flex-col justify-between">
              <div>
                {/* Store Switcher */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveStore((prev) =>
                      prev === "Acme Supply Co. (US)" ? "Acme Living (EU)" : "Acme Supply Co. (US)"
                    )
                  }
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-card"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="flex size-6 items-center justify-center rounded bg-primary-subtle text-primary">
                      <Store className="size-3.5" />
                    </div>
                    <div className="truncate">
                      <p className="truncate text-xs font-medium text-foreground">{activeStore}</p>
                      <p className="text-[10px] text-muted-foreground">Click to switch</p>
                    </div>
                  </div>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                </button>

                {/* Navigation items */}
                <nav className="mt-4 flex flex-col gap-1 text-xs">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Catalog Workflows
                  </div>
                  <button
                    onClick={() => setActiveTab("catalog")}
                    className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                      activeTab === "catalog"
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Package className="size-3.5" />
                      <span>Catalog Matrix</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-80">5</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("conflict")}
                    className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                      activeTab === "conflict"
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <GitCompare className="size-3.5" />
                      <span>Conflict Resolver</span>
                    </span>
                    <span className="font-mono text-[10px] rounded bg-conflict/20 px-1 py-0.2 text-conflict font-bold">1</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${
                      activeTab === "ai"
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <Wand2 className="size-3.5" />
                    <span>AI Taxonomy</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("sync")}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${
                      activeTab === "sync"
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Sync Engine</span>
                  </button>
                </nav>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between px-2 text-[11px] font-mono text-muted-foreground">
                  <span>Dockit Engine</span>
                  <span>v1.0</span>
                </div>
              </div>
            </aside>

            {/* Main Stage */}
            <main className="p-6 bg-background">
              {/* TAB 1: CATALOG MATRIX */}
              {activeTab === "catalog" && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Catalog Queue</h3>
                      <p className="text-xs text-muted-foreground">
                        Draft changes staged locally before publishing to live storefront.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary-hover">
                        Push 2 Drafts
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="mt-3 flex items-center justify-between overflow-x-auto border-b border-border pb-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        onClick={() => setActiveFilter("all")}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          activeFilter === "all"
                            ? "bg-surface text-foreground font-semibold border border-border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Products (5)
                      </button>
                      <button
                        onClick={() => setActiveFilter("drafts")}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          activeFilter === "drafts"
                            ? "bg-surface text-foreground font-semibold border border-border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Drafts (2)
                      </button>
                      <button
                        onClick={() => setActiveFilter("synced")}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          activeFilter === "synced"
                            ? "bg-surface text-foreground font-semibold border border-border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Synced (2)
                      </button>
                      <button
                        onClick={() => setActiveFilter("conflicts")}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                          activeFilter === "conflicts"
                            ? "bg-surface text-foreground font-semibold border border-border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Conflicts <span className="font-mono text-[10px] text-conflict font-bold">(1)</span>
                      </button>
                    </div>
                  </div>

                  {/* Product Table */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-2 pl-2 pr-3 w-8">
                            <input type="checkbox" className="rounded border-border" defaultChecked />
                          </th>
                          <th className="py-2 px-3 font-medium">Product / SKU</th>
                          <th className="py-2 px-3 font-medium">Taxonomy</th>
                          <th className="py-2 px-3 font-medium">Price & Inventory</th>
                          <th className="py-2 px-3 font-medium">Sync State</th>
                          <th className="py-2 pr-2 pl-3 text-right">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-border">
                        {filteredProducts.map((item) => (
                          <tr key={item.id} className="transition-colors hover:bg-surface/60">
                            <td className="py-2.5 pl-2 pr-3">
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                checked={!!checkedIds[item.id]}
                                onChange={() => toggleCheck(item.id)}
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-foreground">{item.title}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">{item.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-[170px] truncate">
                              {item.category}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              <span className="text-foreground">{item.price}</span>
                              <span className="text-muted-foreground ml-1.5 font-sans">({item.stock})</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {item.status === "Synced" && (
                                <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] text-success font-medium">
                                  <CheckCircle2 className="size-3" /> Synced
                                </span>
                              )}
                              {item.status === "Draft" && (
                                <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                                  <Clock className="size-3" /> Draft
                                </span>
                              )}
                              {item.status === "Conflict" && (
                                <span className="inline-flex items-center gap-1 rounded border border-conflict/30 bg-conflict/10 px-1.5 py-0.5 text-[10px] text-conflict font-medium">
                                  <AlertTriangle className="size-3" /> Conflict
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-2 pl-3 text-right font-mono text-[11px] text-muted-foreground">
                              {item.date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: CONFLICT RESOLVER */}
              {activeTab === "conflict" && (
                <div>
                  <div className="pb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded bg-conflict/20 text-conflict">
                        <AlertTriangle className="size-3" />
                      </span>
                      <h3 className="text-sm font-semibold text-foreground">
                        Conflict Detected: Ergonomic Mechanical Keyboard (KB-ERG-05)
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Both your local draft and Shopify admin were modified concurrently. Choose which fields to persist before pushing.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column 1: Dockit Local */}
                    <div className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-semibold">
                        <span className="text-primary font-mono text-[11px]">DOCKIT DRAFT (LOCAL)</span>
                        <span className="text-muted-foreground text-[10px]">Staged 11:24</span>
                      </div>
                      <div className="mt-3 space-y-3 text-xs">
                        <div
                          onClick={() => setConflictChoices((prev) => ({ ...prev, title: "dockit" }))}
                          className={`cursor-pointer rounded p-2 transition-colors border ${
                            conflictChoices.title === "dockit" ? "border-primary bg-primary/5" : "border-transparent"
                          }`}
                        >
                          <span className="text-muted-foreground text-[10px] font-mono block">Title</span>
                          <p className="font-medium text-foreground">Ergonomic Mechanical Keyboard v2</p>
                        </div>
                        <div
                          onClick={() => setConflictChoices((prev) => ({ ...prev, price: "dockit" }))}
                          className={`cursor-pointer rounded p-2 transition-colors border ${
                            conflictChoices.price === "dockit" ? "border-primary bg-primary/5" : "border-transparent"
                          }`}
                        >
                          <span className="text-muted-foreground text-[10px] font-mono block">Price</span>
                          <p className="font-mono text-foreground">$149.00</p>
                        </div>
                        <div
                          onClick={() => setConflictChoices((prev) => ({ ...prev, inventory: "dockit" }))}
                          className={`cursor-pointer rounded p-2 transition-colors border ${
                            conflictChoices.inventory === "dockit" ? "border-primary bg-primary/5" : "border-transparent"
                          }`}
                        >
                          <span className="text-muted-foreground text-[10px] font-mono block">Stock</span>
                          <p className="font-mono text-muted-foreground">60 units</p>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Shopify Live */}
                    <div className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-semibold">
                        <span className="text-conflict font-mono text-[11px]">SHOPIFY LIVE (REMOTE)</span>
                        <span className="text-muted-foreground text-[10px]">Admin Edit 11:42</span>
                      </div>
                      <div className="mt-3 space-y-3 text-xs">
                        <div
                          onClick={() => setConflictChoices((prev) => ({ ...prev, title: "shopify" }))}
                          className={`cursor-pointer rounded p-2 transition-colors border ${
                            conflictChoices.title === "shopify" ? "border-conflict bg-conflict/5" : "border-transparent"
                          }`}
                        >
                          <span className="text-muted-foreground text-[10px] font-mono block">Title</span>
                          <p className="font-medium text-foreground">Ergonomic Mechanical Keyboard</p>
                        </div>
                        <div
                          onClick={() => setConflictChoices((prev) => ({ ...prev, price: "shopify" }))}
                          className={`cursor-pointer rounded p-2 transition-colors border ${
                            conflictChoices.price === "shopify" ? "border-conflict bg-conflict/5" : "border-transparent"
                          }`}
                        >
                          <span className="text-muted-foreground text-[10px] font-mono block">Price</span>
                          <p className="font-mono text-foreground">$159.00</p>
                        </div>
                        <div
                          onClick={() => setConflictChoices((prev) => ({ ...prev, inventory: "shopify" }))}
                          className={`cursor-pointer rounded p-2 transition-colors border ${
                            conflictChoices.inventory === "shopify" ? "border-conflict bg-conflict/5" : "border-transparent"
                          }`}
                        >
                          <span className="text-muted-foreground text-[10px] font-mono block">Stock</span>
                          <p className="font-mono text-muted-foreground">48 units (12 sold online)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground font-mono">Select values above to resolve</span>
                    <div className="flex items-center gap-2">
                      <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card">
                        Keep Remote Shopify
                      </button>
                      <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover shadow-sm">
                        Apply Selection &amp; Push
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AI TAXONOMY */}
              {activeTab === "ai" && (
                <div>
                  <div className="pb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Wand2 className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">AI Taxonomy &amp; Metadata Generator</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Generates standardized Shopify product categories and search metadata with one click.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg border border-border bg-surface p-3.5">
                      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <span className="text-[10px]">SUGGESTED SHOPIFY CATEGORY</span>
                        <span className="text-success font-sans text-[11px] flex items-center gap-1">
                          <Check className="size-3" /> Taxonomy v2024 Match
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-foreground font-mono bg-background p-2 rounded border border-border">
                        Apparel &amp; Accessories &gt; Handbags, Wallets &amp; Cases &gt; Backpacks
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5">
                      <span className="text-[10px] font-mono text-muted-foreground">GENERATED SEO METADATA</span>
                      <div className="mt-2 space-y-2">
                        <div className="bg-background p-2.5 rounded border border-border text-xs">
                          <span className="text-[10px] text-muted-foreground font-mono block">SEO Title</span>
                          <span className="font-semibold text-foreground">
                            Full-Grain Leather Minimalist Backpack | Weatherproof Everyday Carry
                          </span>
                        </div>
                        <div className="bg-background p-2.5 rounded border border-border text-xs">
                          <span className="text-[10px] text-muted-foreground font-mono block">Meta Description</span>
                          <span className="text-muted-foreground leading-normal">
                            Handcrafted full-grain leather backpack featuring dedicated 16-inch laptop compartment and water-resistant lining. Built for daily commute.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
                    <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card">
                      Regenerate
                    </button>
                    <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover shadow-sm">
                      Accept All &amp; Save Draft
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: SYNC ENGINE */}
              {activeTab === "sync" && (
                <div>
                  <div className="pb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Shopify Store Synchronization</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Two-way GraphQL synchronization with automated rate-limit backoff.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-surface p-3.5">
                      <span className="text-[10px] font-mono text-muted-foreground">CONNECTED STORES</span>
                      <p className="mt-1 text-lg font-semibold text-foreground">2 Accounts</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Acme US, Acme EU</p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5">
                      <span className="text-[10px] font-mono text-muted-foreground">GRAPHQL RATE LIMIT</span>
                      <p className="mt-1 text-lg font-semibold text-success font-mono">40 / 40 pts</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">100% capacity restored</p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5">
                      <span className="text-[10px] font-mono text-muted-foreground">LAST PULL SYNC</span>
                      <p className="mt-1 text-lg font-semibold text-foreground font-mono">4m ago</p>
                      <p className="mt-0.5 text-[11px] text-success">Zero unhandled errors</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
                    <span className="text-[10px] font-mono text-muted-foreground">RECENT PIPELINE EVENTS</span>
                    <div className="mt-2 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>[12:28:10] SyncStore completed • 142 products checked</span>
                        <span className="text-success">OK</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>[12:24:02] PushDrafts batch (3 items) to acme-apparel.myshopify.com</span>
                        <span className="text-success">OK</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>[12:15:40] Conflict detected on SKU KB-ERG-05</span>
                        <span className="text-conflict">FLAGGED</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}
