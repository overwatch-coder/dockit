"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import {
  saveAppCredentialsAction,
  saveLegacyTokenAction,
  disconnectStoreAction,
  deleteStoreAction,
} from "@/app/(dashboard)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const handleDeleteStore = async () => {
    setDeleting(true);
    try {
      const result = await deleteStoreAction({ storeId });
      if (!result.success) {
        setStatusMessage({ tone: "bad", text: result.error ?? "Failed to delete store." });
        return;
      }
      setDeleteDialogOpen(false);
      router.push("/dashboard");
    } catch {
      setStatusMessage({ tone: "bad", text: "Failed to delete store." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Shopify Integration Card */}
      <section
        className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
        aria-label="Shopify Store Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-semibold">Shopify Connection</h3>
          </div>
          {isConnected && credentials?.shopDomain ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {credentials.shopDomain}
              </span>
              <Badge
                variant="outline"
                className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                <ShieldCheck className="mr-1 size-3.5" />
                Connected
              </Badge>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            >
              <AlertCircle className="mr-1 size-3.5" />
              Not connected
            </Badge>
          )}
        </div>

        {/* Subheading & Switcher */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <StoreIcon className="size-4" aria-hidden="true" />
            <span>Store: {storeName}</span>
          </div>

          <div className="flex gap-2" role="group" aria-label="Connection mode">
            <Button
              type="button"
              size="sm"
              variant={connectionMode === "oauth" ? "default" : "outline"}
              onClick={() => setConnectionMode("oauth")}
            >
              OAuth App
            </Button>
            <Button
              type="button"
              size="sm"
              variant={connectionMode === "legacy" ? "default" : "outline"}
              onClick={() => setConnectionMode("legacy")}
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={saving}>
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
                  render={
                    <a
                      href={`https://${toShopDomain(credentials.shopDomain)}/admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs"
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
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Danger Zone: Delete Store */}
      <section
        className="flex flex-col gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-5 shadow-sm sm:p-6"
        aria-label="Danger Zone"
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-destructive">Delete Store</h4>
            <p className="text-xs text-muted-foreground">
              Permanently remove <span className="font-semibold">{storeName}</span> and its catalog data from Dockit.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs"
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Delete Store
          </Button>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Store Permanently</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete <strong>{storeName}</strong> and all associated products and sync jobs from Dockit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteStore}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
