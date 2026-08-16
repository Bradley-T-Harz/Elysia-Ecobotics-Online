import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (path) => fs.readFile(path, "utf8");
const [intake, panel, localManifestContract, submit, submissionReadiness, forge, forgeApi, catalogApi, seeds, card, details, installIntent, preview, privacy, submissionRules, cleanup] = await Promise.all([
  read("src/shared/addons/browserAddonIntake.ts"),
  read("src/shared/addons/AddonIntakePanel.tsx"),
  read("src/shared/addons/localElysiaManifestContract.ts"),
  read("src/pages/The-Elysia-Marketplace/components/DeveloperSubmissionForm.tsx"),
  read("src/pages/The-Elysia-Marketplace/lib/submissionReadiness.ts"),
  read("src/pages/The-Developer-Forge/index.tsx"),
  read("src/pages/The-Developer-Forge/developerForgeApi.ts"),
  read("src/pages/The-Elysia-Marketplace/lib/marketplaceApi.ts"),
  read("src/pages/The-Elysia-Marketplace/data/seedAddons.ts"),
  read("src/pages/The-Elysia-Marketplace/components/AddonCard.tsx"),
  read("src/pages/The-Elysia-Marketplace/components/AddonDetails.tsx"),
  read("src/pages/The-Elysia-Marketplace/lib/installIntentApi.ts"),
  read("public/catalog-preview.json"),
  read("docs/marketplace_privacy_boundary.md"),
  read("docs/developer_submission_rules.md"),
  read("docs/marketplace/v1-catalog-cleanup-plan.md")
]);

for (const required of ["inspectAddonArchive", "inspectAddonFiles", "maxFiles", "maxTotalBytes", "missing_manifest", "duplicate_manifest", "private_absolute_path", "secret_api_key", "network_behavior_indicator"]) {
  assert(intake.includes(required), `Browser intake contract is missing ${required}.`);
}
for (const required of ["Import .elysia-addon", "Import ZIP / source bundle", "Import folder / repository", "Import manifest.json", "Choosing files does not upload them", "Selected file tree", "manifest.json", "it is not the entire add-on"]) {
  assert(panel.includes(required), `Browser intake UI is missing: ${required}.`);
}
assert(panel.includes("Local Elysia contract") && localManifestContract.includes('localElysiaCanonicalSchema = "1.1"'), "Browser intake does not surface Local Elysia schema truth.");
assert(submit.includes("Submit private pending review") && submit.includes("will leave my computer") && submit.includes("Git repository URL (metadata only)") && submit.includes("Paste or edit manifest JSON") && submit.includes("Add Git repository URL as review metadata"), "Marketplace Submit lost explicit source paths, pending-review, upload-disclosure, or Git-metadata truth.");
assert(submit.includes("evaluateMarketplaceSubmissionReadiness") && submissionReadiness.includes("sign_in_required") && submissionReadiness.includes("developer_profile_required") && submissionReadiness.includes("upload_disclosure_required"), "Marketplace submission is not fail-closed on account/profile/disclosure requirements.");
for (const path of ["Create from template", "Import .elysia-addon", "Import ZIP / source bundle", "Import folder / repository", "Import manifest.json", "Use Git URL metadata", "Export inert .elysia-addon", "Prepare Marketplace review"]) assert(forge.includes(path), `Developer Forge workflow map is missing ${path}.`);
assert(forge.includes("Transfer selected package privately") && forge.includes("files held in browser memory") && forge.includes("does not fetch, clone"), "Developer Forge lost its local-import/private-transfer/Git boundary.");
assert(forgeApi.includes("Blocking static/archive findings prevented private package transfer") && forgeApi.includes("unsupported_package_type"), "Private package transfer does not fail closed on static findings/type.");
for (const stale of ["Advanced PDF Parser", "Ollama Local Models", "SearXNG Research"]) assert(!seeds.includes(stale) && !preview.includes(stale), `Stale static listing remains: ${stale}.`);
for (const staleId of ["advanced-pdf-parser", "ollama-local-models", "searxng-research"]) assert(catalogApi.includes(staleId), `Source-side remote suppression missing ${staleId}.`);
assert(seeds.includes("Codev") && seeds.includes('status: "pending_review"') && seeds.includes('listing_stage: "official_candidate"'), "Codev is not represented as a pending, non-installable official candidate.");
assert(card.includes("Candidate · not installable") && details.includes("Install intent unavailable"), "Candidate UI still looks installable.");
assert(installIntent.includes("canPrepareMarketplaceInstall"), "Install-intent service does not enforce shared listing eligibility.");
assert(privacy.includes("explicitly selects") && privacy.includes("leave") && submissionRules.includes("Admin review reduces risk but does not guarantee safety"), "Privacy/developer submission docs lack the remote transfer/review disclaimer.");
assert(cleanup.includes("No Supabase rows were queried, changed, hidden, or deleted") && cleanup.includes("Bradley/admin approval"), "Catalog cleanup record lost the database non-mutation gate.");

const parsedPreview = JSON.parse(preview);
assert.equal(parsedPreview.addons.length, 1, "Static catalog preview must contain only the truthful Codev candidate.");
assert.equal(parsedPreview.addons[0].id, "elysia-codev");
assert.equal(parsedPreview.addons[0].status, "pending_review");

console.log("Marketplace/Developer Forge add-on intake contract passed.");
