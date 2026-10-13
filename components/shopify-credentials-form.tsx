"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Database,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  Store as StoreIcon,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveAppCredentialsAction,
  saveLegacyTokenAction,
  disconnectStoreAction,
  deleteStoreAction,
  unlinkStoreAction,
} from "@/app/(dashboard)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoreCredentialsView } from "@/lib/db/stores";

function toShopDomain(nameOrDomain: string): string {
  const clean = nameOrDomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
  return clean.endsWith(".myshopify.com") ? clean : `${clean}.myshopify.com`;
}

export function ShopifyCredentialsForm({
  storeId,
  storeName,
  initialCredentials,
  oauthResult,
  oauthError,
}: {
  storeId: string;
  storeName: string;
  initialCredentials: StoreCredentialsView | null;
  oauthResult?: string | null;
  oauthError?: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [credentials, setCredentials] = useState<StoreCredentialsView | null>(initialCredentials);
  const isConnected = Boolean(credentials?.isConnected);
  const hasSavedAppCredentials = Boolean(credentials?.hasOAuthAppCredentials);

  const [shopDomainInput, setShopDomainInput] = useState(
    credentials?.shopDomain || ""
  );
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [legacyToken, setLegacyToken] = useState("");
  const [connectionMode, setConnectionMode] = useState<"oauth" | "legacy">("oauth");

  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteWithData, setDeleteWithData] = useState(false);
  const [isUnlinkingOrDeleting, setIsUnlinkingOrDeleting] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(() => {
    if (oauthResult === "1") {
      return { tone: "good", text: "Successfully connected to Shopify!" };
    }
    if (oauthError === "cancelled") {
      return { tone: "bad", text: "Shopify authorization was cancelled." };
    }
    if (oauthError === "credentials_missing") {
      return { tone: "bad", text: "Shopify Client ID and Client Secret are required before connecting." };
    }
    if (oauthError === "invalid_hmac") {
      return { tone: "bad", text: "Shopify signature verification failed." };
    }
    if (oauthError === "exchange_failed") {
      return { tone: "bad", text: "Shopify token exchange failed. Please verify your credentials." };
    }
    if (oauthError === "invalid_shop") {
      return { tone: "bad", text: "Invalid Shopify store domain." };
    }
    if (oauthError) {
      return { tone: "bad", text: `Connection failed: ${oauthError}` };
    }
    return null;
  });

  useEffect(() => {
    if (statusMessage?.tone === "good") {
      const timer = window.setTimeout(() => setStatusMessage(null), 6000);
      return () => window.clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanDomainInput = shopDomainInput.trim();
    if (!cleanDomainInput) {
      setStatusMessage({ tone: "bad", text: "Please enter your Shopify store domain." });
      return;
    }

    const targetDomain = toShopDomain(cleanDomainInput);

    if (connectionMode === "legacy") {
      const cleanToken = legacyToken.trim();
      if (!cleanToken) {
        setStatusMessage({ tone: "bad", text: "Please enter your Admin API Access Token." });
        return;
      }

      setSaving(true);
      try {
        const result = await saveLegacyTokenAction({
          storeId,
          shopDomain: targetDomain,
          accessToken: cleanToken,
        });

        if (!result.success) {
          setStatusMessage({ tone: "bad", text: result.error });
          return;
        }

        setLegacyToken("");
        setCredentials({
          shopDomain: result.shopDomain,
          isConnected: true,
          hasOAuthAppCredentials: false,
          tokenPreview: result.tokenPreview,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setStatusMessage({ tone: "good", text: "Connected to Shopify successfully!" });
        router.refresh();
      } catch {
        setStatusMessage({ tone: "bad", text: "Failed to save credentials." });
      } finally {
        setSaving(false);
      }
      return;
    }

    // OAuth Mode
    const cleanApiKey = apiKey.trim();
    const cleanApiSecret = apiSecret.trim();
    const hasApiKey = cleanApiKey.length > 0;
    const hasApiSecret = cleanApiSecret.length > 0;

    if (hasApiKey !== hasApiSecret) {
      setStatusMessage({
        tone: "bad",
        text: "Please provide both Client ID and Client Secret, or leave both empty if already saved.",
      });
      return;
    }

    if (!hasApiKey && !hasSavedAppCredentials) {
      setStatusMessage({
        tone: "bad",
        text: "Please enter your Shopify App's Client ID and Client Secret.",
      });
      return;
    }

    setSaving(true);
    try {
      if (hasApiKey && hasApiSecret) {
        const result = await saveAppCredentialsAction({
          storeId,
          shopDomain: targetDomain,
          apiKey: cleanApiKey,
          apiSecret: cleanApiSecret,
        });

        if (!result.success) {
          setStatusMessage({ tone: "bad", text: result.error });
          setSaving(false);
          return;
        }
      }

      // Initiate top-level OAuth redirect
      window.location.href = `/api/shopify/oauth/login?storeId=${encodeURIComponent(
        storeId
      )}&shopDomain=${encodeURIComponent(targetDomain)}`;
    } catch {
      setStatusMessage({ tone: "bad", text: "Failed to initiate Shopify connection." });
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await disconnectStoreAction({ storeId });
      if (!result.success) {
        setStatusMessage({ tone: "bad", text: result.error ?? "Failed to disconnect." });
        return;
      }

      setDisconnectDialogOpen(false);
      setCredentials((prev) =>
        prev
          ? {
              ...prev,
              isConnected: false,
              tokenPreview: null,
            }
          : null
      );
      setStatusMessage({ tone: "good", text: "Shopify disconnected successfully." });
      router.refresh();
    } catch {
      setStatusMessage({ tone: "bad", text: "Failed to disconnect store." });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUnlinkOrDeleteStore = async () => {
    setIsUnlinkingOrDeleting(true);
    try {
      if (deleteWithData) {
        const result = await deleteStoreAction({ storeId });
        if (!result.success) {
          setStatusMessage({ tone: "bad", text: result.error ?? "Failed to delete store." });
          return;
        }
        setDeleteDialogOpen(false);
        toast.success("Store and data permanently deleted.");
        router.push("/dashboard");
      } else {
        const result = await unlinkStoreAction({ storeId });
        if (!result.success) {
          setStatusMessage({ tone: "bad", text: result.error ?? "Failed to unlink store." });
          return;
        }
        setDeleteDialogOpen(false);
        setCredentials((prev) =>
          prev
            ? {
                ...prev,
                isConnected: false,
                shopDomain: "",
                tokenPreview: null,
                hasOAuthAppCredentials: false,
              }
            : null
        );
        setShopDomainInput("");
        setApiKey("");
        setApiSecret("");
        setLegacyToken("");
        setStatusMessage({
          tone: "good",
          text: "Store unlinked from Shopify. All products and data remain safely saved in your database.",
        });
        toast.success("Store unlinked. Products preserved in database.");
        router.refresh();
      }
    } catch {
      setStatusMessage({
        tone: "bad",
        text: deleteWithData ? "Failed to delete store." : "Failed to unlink store.",
      });
    } finally {
      setIsUnlinkingOrDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Shopify Integration Card */}
      <section
        className="flex flex-col gap-4 sm:gap-5 rounded-xl border bg-card p-3.5 shadow-sm sm:p-6"
        aria-label="Shopify Store Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 sm:pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-semibold">Shopify Connection</h3>
          </div>
          {isConnected && credentials?.shopDomain ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {credentials.shopDomain}
              </span>
              <Badge
                variant="outline"
                className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] sm:text-xs"
              >
                <ShieldCheck className="mr-1 size-3 sm:size-3.5" />
                Connected
              </Badge>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] sm:text-xs"
            >
              <AlertCircle className="mr-1 size-3 sm:size-3.5" />
              Not connected
            </Badge>
          )}
        </div>

        {/* Subheading & Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
            <StoreIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Store: <strong className="text-foreground font-semibold">{storeName}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-1.5 sm:gap-2" role="group" aria-label="Connection mode">
            <Button
              type="button"
              size="sm"
              variant={connectionMode === "oauth" ? "default" : "outline"}
              onClick={() => setConnectionMode("oauth")}
              className="text-xs h-8"
            >
              OAuth App
            </Button>
            <Button
              type="button"
              size="sm"
              variant={connectionMode === "legacy" ? "default" : "outline"}
              onClick={() => setConnectionMode("legacy")}
              className="text-xs h-8"
            >
              Custom App (Token)
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="shop-domain" className="text-xs font-medium text-muted-foreground">
                Shopify Store Domain
              </label>
              <Input
                id="shop-domain"
                type="text"
                placeholder="your-store or your-store.myshopify.com"
                value={shopDomainInput}
                onChange={(e) => setShopDomainInput(e.target.value)}
                disabled={saving}
                className="text-xs sm:text-sm"
                required
              />
              <span className="text-[11px] text-muted-foreground">
                Your myshopify.com domain address or store name.
              </span>
            </div>

            {connectionMode === "oauth" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="client-id" className="text-xs font-medium text-muted-foreground">
                    Client ID (API Key)
                  </label>
                  <Input
                    id="client-id"
                    type="text"
                    autoComplete="off"
                    placeholder={hasSavedAppCredentials ? "•••••••••••••••• (Saved)" : "Shopify App Client ID"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={saving}
                    className="font-mono text-xs sm:text-sm"
                    required={!hasSavedAppCredentials}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="client-secret"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <span>Client Secret</span>
                    <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
                  </label>
                  <Input
                    id="client-secret"
                    type="password"
                    autoComplete="new-password"
                    placeholder={hasSavedAppCredentials ? "•••••••••••••••• (Saved)" : "Shopify App Client Secret"}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    disabled={saving}
                    className="font-mono text-xs sm:text-sm"
                    required={!hasSavedAppCredentials}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {hasSavedAppCredentials
                      ? "App credentials are configured. Enter new ones only to replace them."
                      : "From your Shopify Partner Dashboard or Dev App settings."}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label
                  htmlFor="legacy-token"
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  <span>Admin API Access Token</span>
                  <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
                </label>
                <Input
                  id="legacy-token"
                  type="password"
                  autoComplete="new-password"
                  placeholder={credentials?.tokenPreview ?? "shpat_••••••••••••••••••••••••"}
                  value={legacyToken}
                  onChange={(e) => setLegacyToken(e.target.value)}
                  disabled={saving}
                  className="font-mono text-xs sm:text-sm"
                  required={!credentials?.tokenPreview}
                />
                <span className="text-[11px] text-muted-foreground">
                  Created via Shopify Admin → Settings → Apps and sales channels → Develop apps. Requires read/write scopes for Products.
                </span>
              </div>
            )}
          </div>

          <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground bg-muted/30">
            {connectionMode === "oauth"
              ? "OAuth flow: We'll redirect you to Shopify to authorize the app with your store."
              : "Direct Token: Dockit will verify the token immediately against your Shopify store."}
          </p>

          {statusMessage && (
            <p
              role="status"
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                statusMessage.tone === "good"
                  ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {statusMessage.tone === "good" ? (
                <CheckCircle className="size-3.5 shrink-0" />
              ) : (
                <AlertCircle className="size-3.5 shrink-0" />
              )}
              {statusMessage.text}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button type="submit" size="sm" disabled={saving} className="w-full sm:w-auto text-xs sm:text-sm">
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {connectionMode === "legacy"
                  ? "Save and Connect"
                  : isConnected
                  ? "Reconnect Shopify"
                  : "Connect with Shopify"}
              </Button>
              {isConnected && credentials?.shopDomain ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  render={
                    <a
                      href={`https://${toShopDomain(credentials.shopDomain)}/admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                    />
                  }
                >
                  <ExternalLink className="size-3.5" />
                  Shopify Admin
                </Button>
              ) : null}
            </div>

            {isConnected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDisconnectDialogOpen(true)}
                className="w-full sm:w-auto text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Danger Zone: Unlink or Delete Store */}
      <section
        className="flex flex-col gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 sm:p-6 shadow-sm"
        aria-label="Danger Zone"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-destructive">Unlink or Delete Store</h4>
            <p className="text-xs text-muted-foreground">
              Unlink <span className="font-semibold">{storeName}</span> to clear credentials on this page while keeping all catalog products safe in your database for a new store, or permanently delete everything.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteWithData(false);
                setDeleteDialogOpen(true);
              }}
              className="w-full sm:w-auto text-xs border-amber-600/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Unlink className="size-3.5 mr-1.5" />
              Unlink Store
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteWithData(true);
                setDeleteDialogOpen(true);
              }}
              className="w-full sm:w-auto text-xs self-start sm:self-auto shrink-0"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Delete Store
            </Button>
          </div>
        </div>
      </section>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Shopify Store</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect Shopify for <strong>{storeName}</strong>? Products stored in Dockit will remain intact, but you won&apos;t be able to sync or push updates to Shopify until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Disconnect Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink / Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteWithData ? "Permanently Delete Store & Data" : "Unlink Shopify Store"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure how you want to handle <strong>{storeName}</strong> and your product catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-left">
            {/* Shopify Store Untouched Notice */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <span className="font-semibold">Shopify Store Untouched:</span>
                <p className="mt-0.5 text-blue-900/80 dark:text-blue-300/80 leading-relaxed">
                  The data inside your Shopify store will <strong>not</strong> be deleted. Only credentials and the connection on this page will be removed.
                </p>
              </div>
            </div>

            {/* Dockit Database Preservation Notice */}
            {deleteWithData ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Permanent Deletion from Dockit:</span>
                  <p className="mt-0.5 text-destructive/80 leading-relaxed">
                    This action cannot be undone. This will permanently delete <strong>{storeName}</strong>, all associated products, variants, and sync jobs from your Dockit database.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
                <Database className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-semibold">Database Products Preserved:</span>
                  <p className="mt-0.5 text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                    All products, descriptions, images, variants, and AI generation rules will remain saved in your database. If you link a new Shopify store later, you will still have all your existing data ready to publish.
                  </p>
                </div>
              </div>
            )}

            {/* Checkbox to opt-in to deleting database data */}
            <div className="flex items-start space-x-3 rounded-lg border p-3 bg-muted/40">
              <Checkbox
                id="delete-with-data-check"
                checked={deleteWithData}
                onCheckedChange={(checked) => setDeleteWithData(Boolean(checked))}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="delete-with-data-check"
                  className="text-xs font-semibold cursor-pointer text-foreground"
                >
                  Also permanently delete all products and sync jobs from Dockit database
                </label>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Leave unchecked to keep your database products safe so you can link a new store later.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isUnlinkingOrDeleting}
            >
              Cancel
            </Button>
            {deleteWithData ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleUnlinkOrDeleteStore}
                disabled={isUnlinkingOrDeleting}
              >
                {isUnlinkingOrDeleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Permanently Delete
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                onClick={handleUnlinkOrDeleteStore}
                disabled={isUnlinkingOrDeleting}
              >
                {isUnlinkingOrDeleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Unlink Store (Keep Data)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
