"use client";

import React, { useState } from "react";
import {
  Store,
  LayoutDashboard,
  Package,
  BarChart3,
  DollarSign,
  Megaphone,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";

type NavTab = "product" | "marketing" | "analytics" | "finances";
type FilterTab = "all" | "drafts" | "synced" | "conflicts";

const SAMPLE_TASKS = [
  {
    id: "1",
    title: "Minimalist Leather Backpack",
    category: "Apparel & Accessories > Bags",
    sku: "BP-LTH-01",
    status: "Synced",
    statusVariant: "success",
    date: "Mar 23",
    avatars: [
      { bg: "bg-indigo-500", text: "JD" },
      { bg: "bg-emerald-500", text: "AK" },
    ],
  },
  {
    id: "2",
    title: "Organic Cotton Oversized Hoodie",
    category: "Apparel & Accessories > Clothing",
    sku: "HD-COT-02",
    status: "Draft",
    statusVariant: "primary",
    date: "Apr 12",
    avatars: [
      { bg: "bg-purple-500", text: "SL" },
      { bg: "bg-blue-500", text: "MR" },
      { bg: "bg-amber-500", text: "CN" },
    ],
  },
  {
    id: "3",
    title: "Wireless Noise-Canceling Headphones",
    category: "Electronics > Audio Equipment",
    sku: "HP-WRL-03",
    status: "Draft",
    statusVariant: "primary",
    date: "Apr 28",
    avatars: [{ bg: "bg-rose-500", text: "EH" }],
  },
  {
    id: "4",
    title: "Ceramic Minimalist Mug Set",
    category: "Home & Garden > Kitchenware",
    sku: "MG-CRM-04",
    status: "Synced",
    statusVariant: "success",
    date: "May 04",
    avatars: [
      { bg: "bg-teal-500", text: "PL" },
      { bg: "bg-indigo-500", text: "JD" },
    ],
  },
  {
    id: "5",
    title: "Ergonomic Mechanical Keyboard",
    category: "Electronics > Computer Accessories",
    sku: "KB-ERG-05",
    status: "Conflict",
    statusVariant: "conflict",
    date: "Jun 18",
    avatars: [
      { bg: "bg-purple-500", text: "SL" },
      { bg: "bg-emerald-500", text: "AK" },
    ],
  },
];

const CAMPAIGNS = [
  {
    title: "Summer Collection Launch",
    status: "Active",
    channel: "Shopify Storefront",
    impressions: "14.2k",
    conversions: "480",
  },
  {
    title: "AI SEO Product Blast",
    status: "Scheduled",
    channel: "Search Engines",
    impressions: "8.5k",
    conversions: "--",
  },
  {
    title: "Social Catalog Teaser",
    status: "Completed",
    channel: "Multi-Channel",
    impressions: "28.9k",
    conversions: "1,120",
  },
];

const FINANCIAL_ITEMS = [
  { sku: "BP-LTH-01", name: "Leather Backpack", unitPrice: "$120.00", stock: "45 units", margin: "48%" },
  { sku: "HD-COT-02", name: "Oversized Hoodie", unitPrice: "$85.00", stock: "120 units", margin: "52%" },
  { sku: "HP-WRL-03", name: "Noise-Cancel Headphones", unitPrice: "$199.00", stock: "28 units", margin: "38%" },
  { sku: "KB-ERG-05", name: "Mechanical Keyboard", unitPrice: "$149.00", stock: "60 units", margin: "44%" },
];

export function AppShowcase() {
  const [activeTab, setActiveTab] = useState<NavTab>("product");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({ "1": true });

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredTasks = SAMPLE_TASKS.filter((task) => {
    if (activeFilter === "drafts") return task.status === "Draft";
    if (activeFilter === "synced") return task.status === "Synced";
    if (activeFilter === "conflicts") return task.status === "Conflict";
    return true;
  });

  const getUrl = () => {
    switch (activeTab) {
      case "marketing":
        return "dockit.app/workspace/marketing";
      case "analytics":
        return "dockit.app/workspace/analytics";
      case "finances":
        return "dockit.app/workspace/finances";
      default:
        return "dockit.app/workspace/launch";
    }
  };

  return (
    <section id="app-showcase" className="relative overflow-hidden py-20 bg-surface/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> Interactive Workspace Showcase
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Built for speed, clarity, and precision
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Click through the workspace tabs below to preview real catalog operations in action.
          </p>
        </div>

        {/* Tilted Perspective Container */}
        <div className="relative mt-14 flex justify-center [perspective:1200px]">
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl transition-all duration-700 hover:[transform:perspective(1200px)_rotateX(6deg)_rotateY(-2deg)_scale(0.98)]"
            style={{
              transform: "perspective(1200px) rotateX(10deg) rotateY(-3deg) scale(0.97)",
              transformOrigin: "center top",
            }}
          >
            {/* Desktop Window Title Bar */}
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-red-500/80" />
                <span className="size-3 rounded-full bg-yellow-500/80" />
                <span className="size-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground border border-border transition-all">
                <Search className="size-3 text-muted-foreground/70" />
                <span className="font-mono text-[11px]">{getUrl()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="size-2 rounded-full bg-success animate-pulse" />
                <span>Shopify Connected</span>
              </div>
            </div>

            {/* Application Main Layout */}
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] min-h-[520px]">
              {/* Left Navigation Panel */}
              <aside className="border-r border-border bg-surface p-4 flex flex-col justify-between">
                <div>
                  {/* Store Switcher Pill */}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5 shadow-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="flex size-7 items-center justify-center rounded-md bg-primary-subtle text-primary">
                        <Store className="size-4" />
                      </div>
                      <div className="truncate">
                        <p className="truncate text-xs font-semibold text-foreground">Acme Store</p>
                        <p className="text-[10px] text-muted-foreground">Primary Catalog</p>
                      </div>
                    </div>
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  </div>

                  {/* Nav List */}
                  <nav className="mt-6 flex flex-col gap-1 text-xs">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Workspace
                    </div>
                    <button
                      onClick={() => setActiveTab("marketing")}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                        activeTab === "marketing"
                          ? "bg-primary-subtle font-medium text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      <Megaphone className="size-4" />
                      <span>Marketing</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("product")}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                        activeTab === "product"
                          ? "bg-primary-subtle font-medium text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      <Package className="size-4" />
                      <span>Product</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("analytics")}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                        activeTab === "analytics"
                          ? "bg-primary-subtle font-medium text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      <BarChart3 className="size-4" />
                      <span>Analytics</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("finances")}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                        activeTab === "finances"
                          ? "bg-primary-subtle font-medium text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      <DollarSign className="size-4" />
                      <span>Finances</span>
                    </button>
                  </nav>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                    <LayoutDashboard className="size-4 text-primary" />
                    <span>Dockit v2.4</span>
                  </div>
                </div>
              </aside>

              {/* Main Content Area */}
              <main className="p-6 bg-background">
                {/* 1. PRODUCT TAB VIEW */}
                {activeTab === "product" && (
                  <div className="animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-border">
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground">Launch</h3>
                        <p className="text-xs text-muted-foreground">
                          Product queue, launch schedule, and draft status updates.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover">
                          <Plus className="size-3.5" />
                          New Product
                        </button>
                      </div>
                    </div>

                    {/* Filter Tabs Bar */}
                    <div className="mt-4 flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          onClick={() => setActiveFilter("all")}
                          className={`rounded-md px-2.5 py-1 font-semibold transition-colors border ${
                            activeFilter === "all"
                              ? "bg-surface text-foreground border-border"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          All Products (5)
                        </button>
                        <button
                          onClick={() => setActiveFilter("drafts")}
                          className={`rounded-md px-2.5 py-1 font-semibold transition-colors border ${
                            activeFilter === "drafts"
                              ? "bg-surface text-foreground border-border"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Drafts (2)
                        </button>
                        <button
                          onClick={() => setActiveFilter("synced")}
                          className={`rounded-md px-2.5 py-1 font-semibold transition-colors border ${
                            activeFilter === "synced"
                              ? "bg-surface text-foreground border-border"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Synced (2)
                        </button>
                        <button
                          onClick={() => setActiveFilter("conflicts")}
                          className={`rounded-md px-2.5 py-1 font-semibold transition-colors border flex items-center gap-1 ${
                            activeFilter === "conflicts"
                              ? "bg-surface text-foreground border-border"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Conflicts{" "}
                          <span className="rounded-full bg-conflict/15 px-1.5 py-0.5 text-[10px] text-conflict font-bold">
                            1
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Product Table */}
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="py-2.5 pl-2 pr-3 w-8">
                              <input type="checkbox" className="rounded border-border" defaultChecked />
                            </th>
                            <th className="py-2.5 px-3 font-medium">Product / Title</th>
                            <th className="py-2.5 px-3 font-medium">Status</th>
                            <th className="py-2.5 px-3 font-medium">Launch Date</th>
                            <th className="py-2.5 px-3 font-medium">Team</th>
                            <th className="py-2.5 pr-2 pl-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredTasks.map((task) => (
                            <tr key={task.id} className="group transition-colors hover:bg-surface">
                              <td className="py-3 pl-2 pr-3">
                                <input
                                  type="checkbox"
                                  className="rounded border-border"
                                  checked={!!checkedIds[task.id]}
                                  onChange={() => toggleCheck(task.id)}
                                />
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-foreground">{task.title}</div>
                                <div className="font-mono text-[11px] text-muted-foreground">{task.sku}</div>
                              </td>
                              <td className="py-3 px-3">
                                {task.statusVariant === "success" && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success border border-success/20">
                                    <CheckCircle2 className="size-3" /> Synced
                                  </span>
                                )}
                                {task.statusVariant === "primary" && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
                                    <Clock className="size-3" /> Draft
                                  </span>
                                )}
                                {task.statusVariant === "conflict" && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-conflict/15 px-2 py-0.5 text-[11px] font-semibold text-conflict border border-conflict/20">
                                    <AlertTriangle className="size-3" /> Conflict
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-muted-foreground">
                                {task.date}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex -space-x-1.5">
                                  {task.avatars.map((av, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-background ${av.bg}`}
                                    >
                                      {av.text}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 pr-2 pl-3 text-right">
                                <button className="text-muted-foreground hover:text-foreground">
                                  <MoreHorizontal className="size-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. MARKETING TAB VIEW */}
                {activeTab === "marketing" && (
                  <div className="animate-in fade-in duration-200">
                    <div className="pb-5 border-b border-border">
                      <h3 className="text-xl font-bold tracking-tight text-foreground">Marketing & Campaigns</h3>
                      <p className="text-xs text-muted-foreground">
                        Promotional push schedules, SEO campaign sync, and storefront launches.
                      </p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {CAMPAIGNS.map((c) => (
                        <div key={c.title} className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">{c.title}</span>
                              <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {c.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{c.channel}</p>
                          </div>
                          <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                            <span className="text-muted-foreground">Impressions: <strong className="text-foreground">{c.impressions}</strong></span>
                            <span className="text-muted-foreground">Conversions: <strong className="text-foreground">{c.conversions}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. ANALYTICS TAB VIEW */}
                {activeTab === "analytics" && (
                  <div className="animate-in fade-in duration-200">
                    <div className="pb-5 border-b border-border">
                      <h3 className="text-xl font-bold tracking-tight text-foreground">Analytics & Catalog Health</h3>
                      <p className="text-xs text-muted-foreground">
                        Sync performance, AI SEO generation metrics, and catalog velocity.
                      </p>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs text-muted-foreground">Total Catalog Items</p>
                        <p className="mt-2 text-2xl font-bold text-foreground">142</p>
                        <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-success">
                          <TrendingUp className="mr-1 size-3" /> +12% this month
                        </span>
                      </div>

                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs text-muted-foreground">Sync Health</p>
                        <p className="mt-2 text-2xl font-bold text-success">99.8%</p>
                        <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-success">
                          <ShieldCheck className="mr-1 size-3" /> Zero data loss
                        </span>
                      </div>

                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs text-muted-foreground">AI Tag Accuracy</p>
                        <p className="mt-2 text-2xl font-bold text-primary">96.4%</p>
                        <span className="mt-1 inline-flex items-center text-[10px] font-semibold text-primary">
                          <Zap className="mr-1 size-3" /> One-click accept
                        </span>
                      </div>

                      <div className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs text-muted-foreground">Conflict Time</p>
                        <p className="mt-2 text-2xl font-bold text-foreground">&lt; 45s</p>
                        <span className="mt-1 text-[10px] text-muted-foreground">Instant resolution</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. FINANCES TAB VIEW */}
                {activeTab === "finances" && (
                  <div className="animate-in fade-in duration-200">
                    <div className="pb-5 border-b border-border">
                      <h3 className="text-xl font-bold tracking-tight text-foreground">Finances & Inventory Value</h3>
                      <p className="text-xs text-muted-foreground">
                        Draft inventory valuation, margin analysis, and unpushed catalog potential.
                      </p>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="py-2.5 px-3 font-medium">SKU</th>
                            <th className="py-2.5 px-3 font-medium">Product Name</th>
                            <th className="py-2.5 px-3 font-medium">Unit Price</th>
                            <th className="py-2.5 px-3 font-medium">Stock Level</th>
                            <th className="py-2.5 px-3 font-medium">Margin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {FINANCIAL_ITEMS.map((item) => (
                            <tr key={item.sku} className="group transition-colors hover:bg-surface">
                              <td className="py-3 px-3 font-mono text-muted-foreground">{item.sku}</td>
                              <td className="py-3 px-3 font-semibold text-foreground">{item.name}</td>
                              <td className="py-3 px-3 font-mono text-foreground">{item.unitPrice}</td>
                              <td className="py-3 px-3 text-muted-foreground">{item.stock}</td>
                              <td className="py-3 px-3 font-semibold text-success">{item.margin}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
