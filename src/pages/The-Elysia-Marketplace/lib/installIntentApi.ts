import type { AddonManifest, MarketplaceApiResult } from "../types";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "./supabase";

export type InstallIntentResult = {
  created: boolean;
  opened: boolean;
  intentId?: string;
  deepLink?: string;
  expiresAt?: string;
  message: string;
};

function demo<T>(data: T, warning: string): MarketplaceApiResult<T> {
  return {
    data,
    demoMode: true,
    warnings: [warning],
    sourceState: "supabase_not_configured",
    statusMessage: warning,
    supabaseConfigured: false,
    seedFallbackActive: true
  };
}

function configured<T>(data: T, warnings: string[] = []): MarketplaceApiResult<T> {
  return {
    data,
    demoMode: false,
    warnings,
    supabaseConfigured: true,
    seedFallbackActive: false
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function prepareLocalInstallIntent(addon: AddonManifest): Promise<MarketplaceApiResult<InstallIntentResult>> {
  if (!hasSupabaseConfig || !supabase) {
    return demo(
      {
        created: false,
        opened: false,
        message: "Supabase is not configured. This page can show manifest and permission truth, but it cannot create an account-connected local install intent."
      },
      supabaseNotConfiguredMessage
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return configured({
      created: false,
      opened: false,
      message: "Sign in to create an account-connected local install intent. The website still cannot install locally."
    }, ["Sign in to save add-ons or create local install intents."]);
  }

  const { data: addonRows, error: addonError } = await supabase
    .from("addons")
    .select("id, slug, name, addon_versions(id, version, review_status)")
    .eq("slug", addon.id)
    .limit(1);

  const addonRow = Array.isArray(addonRows) ? addonRows[0] as { id?: string; name?: string; addon_versions?: Array<{ id: string; version: string; review_status: string }> } | undefined : undefined;
  const versions = addonRow?.addon_versions ?? [];
  const versionRow = versions.find((version) => version.review_status === "approved" && version.version === addon.version)
    ?? versions.find((version) => version.review_status === "approved");

  const nonce = randomNonce();
  const nonceHash = await sha256Hex(nonce);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: intent, error } = await supabase
    .from("marketplace_install_intents")
    .insert({
      user_id: auth.user.id,
      addon_id: addonRow?.id ?? null,
      addon_version_id: versionRow?.id ?? null,
      addon_slug: addon.id,
      addon_name: addonRow?.name ?? addon.name,
      nonce_hash: nonceHash,
      expires_at: expiresAt,
      status: "created"
    })
    .select("id, expires_at")
    .single();

  if (error || !intent) {
    const reason = error?.message ?? "Install intent insert failed.";
    const schemaHint = reason.includes("schema cache") || reason.includes("marketplace_install_intents") || reason.includes("permission denied")
      ? `Marketplace account storage is not configured yet: ${reason}`
      : reason;
    return configured({ created: false, opened: false, message: schemaHint }, [schemaHint, ...(addonError ? [`Catalog UUID lookup warning: ${addonError.message}`] : [])]);
  }

  const intentId = (intent as { id: string }).id;
  const deepLink = `elysia://marketplace/install?intent_id=${encodeURIComponent(intentId)}&nonce=${encodeURIComponent(nonce)}`;
  let opened = false;
  try {
    window.location.href = deepLink;
    opened = true;
  } catch {
    opened = false;
  }

  return configured({
    created: true,
    opened,
    intentId,
    deepLink,
    expiresAt: (intent as { expires_at?: string }).expires_at ?? expiresAt,
    message: `Install intent created. Local Elysia must review and approve this install. The website cannot install or enable add-ons. If your browser does not open Elysia, use this link manually: ${deepLink}`
  }, addonError ? [`Catalog UUID lookup warning: ${addonError.message}; saved install intent used slug/name fallback.`] : []);
}

