import type { AddonManifest } from "../types";

// Release gate: the website has no proven, registered local protocol handler.
// Keep catalog/review truth visible without rendering a local-install control.
export const MARKETPLACE_LOCAL_INSTALL_ENABLED = false;

export function canPrepareMarketplaceInstall(addon: AddonManifest) {
  if (!MARKETPLACE_LOCAL_INSTALL_ENABLED) return false;
  if (addon.listing_stage === "official_candidate") return false;
  if (addon.status === "pending_review") return false;
  if (["revoked", "security_hold", "deprecated", "rejected"].includes(addon.status ?? "")) return false;
  if (["blocked", "deprecated", "unreviewed"].includes(addon.trust_tier)) return false;
  return addon.status === "approved" || (addon.status === "available" && Boolean(addon.marketplace_listing_id));
}

export function marketplaceListingLabel(addon: AddonManifest) {
  if (addon.listing_stage === "official_candidate") return "Official candidate · not installable";
  if (addon.marketplace_listing_id) return "Live reviewed listing";
  if (addon.status === "approved") return "Legacy reviewed listing";
  return "Not publicly installable";
}
