import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { evaluateMarketplaceSubmissionReadiness, marketplaceSubmissionOutcome } from "../src/pages/The-Elysia-Marketplace/lib/submissionReadiness.ts";

const readyInput = {
  supabaseConfigured: true,
  signedIn: true,
  developerProfileAvailable: true,
  manifestBlocked: false,
  intakeBlocked: false,
  uploadDisclosureAccepted: true,
  permissionReasonsComplete: true,
  elevatedPermissionRequested: false,
  elevatedRiskAccepted: false,
  submitting: false
};

assert.equal(evaluateMarketplaceSubmissionReadiness(readyInput).ready, true);
for (const [field, blocker] of [
  ["supabaseConfigured", "remote_review_not_configured"],
  ["signedIn", "sign_in_required"],
  ["developerProfileAvailable", "developer_profile_required"],
  ["uploadDisclosureAccepted", "upload_disclosure_required"],
  ["permissionReasonsComplete", "permission_reasons_required"]
] as const) {
  const result = evaluateMarketplaceSubmissionReadiness({ ...readyInput, [field]: false });
  assert.equal(result.ready, false);
  assert(result.blockers.includes(blocker));
}
assert(evaluateMarketplaceSubmissionReadiness({ ...readyInput, manifestBlocked: true }).blockers.includes("manifest_blocked"));
assert(evaluateMarketplaceSubmissionReadiness({ ...readyInput, intakeBlocked: true }).blockers.includes("package_intake_blocked"));
assert(evaluateMarketplaceSubmissionReadiness({ ...readyInput, elevatedPermissionRequested: true }).blockers.includes("elevated_risk_acknowledgement_required"));
assert.equal(marketplaceSubmissionOutcome.submissionStatus, "pending");
assert.equal(marketplaceSubmissionOutcome.reviewItemStatus, "pending_review");
assert.equal(marketplaceSubmissionOutcome.autoPublicListing, false);
assert.equal(marketplaceSubmissionOutcome.installAuthorityGranted, false);

const api = await fs.readFile("src/pages/The-Developer-Forge/developerForgeApi.ts", "utf8");
assert.match(api, /addon_submissions"\)\.insert\(\{[^}]*status: "pending"/s);
assert.match(api, /review_items"\)\.insert\(\{[^}]*status: "pending_review"/s);
assert(!/marketplace_listings"\)\.insert/.test(api), "Submission client must not insert a public Marketplace listing.");

console.log("Marketplace signed-in submission boundary mock passed.");
