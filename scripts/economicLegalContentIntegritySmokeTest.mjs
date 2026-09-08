import crypto from "node:crypto";
import fs from "node:fs/promises";
import { archivedLegalPolicyPages as legalPolicyPages } from "../src/pages/Legal/economicLegalArchive.ts";
import {
  billingLegalConsentBundleIntegrityExpectations,
  billingLegalDocumentIntegrityExpectations,
  economicLegalPageIntegrity,
  serializeEconomicLegalSemanticContent
} from "../src/pages/Legal/economicLegalContentManifest.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(page) {
  return crypto.createHash("sha256")
    .update(serializeEconomicLegalSemanticContent(page), "utf8")
    .digest("hex");
}

const integrityEntries = Object.values(economicLegalPageIntegrity);
assert(integrityEntries.length === 9, "The canonical economic legal-page set changed without an integrity-manifest update.");
assert(new Set(integrityEntries.map((entry) => entry.slug)).size === integrityEntries.length, "Economic legal integrity manifest contains a duplicate slug.");
assert(new Set(integrityEntries.map((entry) => entry.route)).size === integrityEntries.length, "Economic legal integrity manifest contains a duplicate route.");

for (const expected of integrityEntries) {
  assert(/^[0-9a-f]{64}$/.test(expected.contentSha256), `Canonical legal digest is not lowercase SHA-256: ${expected.route}`);
  const page = legalPolicyPages.find((candidate) => candidate.slug === expected.slug);
  assert(page, `Canonical economic legal page is absent: ${expected.slug}`);
  assert(page.route === expected.route, `Canonical economic legal route drifted under ${expected.version}: ${expected.slug}`);
  assert(page.title === expected.title, `Canonical economic legal title drifted under ${expected.version}: ${expected.slug}`);
  assert(page.status === expected.status, `Canonical economic legal status drifted under ${expected.version}: ${expected.slug}`);
  assert(page.lastUpdated === expected.lastUpdated, `Canonical economic legal last-updated date drifted under ${expected.version}: ${expected.slug}`);
  assert(sha256(page) === expected.contentSha256, `Canonical economic legal semantic content drifted without a new reviewed version: ${expected.route}`);

  for (const field of ["route", "title", "status", "lastUpdated", "body"]) {
    const changed = { ...page, [field]: `${page[field]}#integrity-change` };
    assert(sha256(changed) !== expected.contentSha256, `Semantic digest unexpectedly excludes ${field}: ${expected.route}`);
  }
}

const integrityByPath = new Map(integrityEntries.map((entry) => [entry.route, entry]));
for (const [documentKey, reference] of Object.entries(billingLegalDocumentIntegrityExpectations)) {
  const page = integrityByPath.get(reference.path);
  assert(page, `Billing legal document points outside the canonical page manifest: ${documentKey}`);
  assert(reference.contentSha256 === page.contentSha256, `Billing legal document hash disagrees with its canonical page: ${documentKey}`);
  assert(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(reference.version), `Billing legal document version is invalid: ${documentKey}`);
}
for (const [bundleKey, bundle] of Object.entries(billingLegalConsentBundleIntegrityExpectations)) {
  assert(integrityByPath.has(bundle.path), `Consent bundle public path is not canonical: ${bundleKey}`);
  for (const [documentKey, reference] of Object.entries(bundle.documents)) {
    const page = integrityByPath.get(reference.path);
    assert(page, `Consent bundle document points outside the canonical page manifest: ${bundleKey}.${documentKey}`);
    assert(reference.contentSha256 === page.contentSha256, `Consent bundle document hash disagrees with canonical content: ${bundleKey}.${documentKey}`);
  }
}

const migration = await fs.readFile(new URL("../supabase/migrations/20260716020000_private_economic_core.sql", import.meta.url), "utf8");
const serverParser = await fs.readFile(new URL("../functions/api/billing/_shared/database.ts", import.meta.url), "utf8");
const browserParser = await fs.readFile(new URL("../src/shared/billing/billingClient.ts", import.meta.url), "utf8");
assert(migration.includes("content_sha256 text not null") && migration.includes("content_sha256 ~ '^[0-9a-f]{64}$'"), "Economic legal document rows lost their required lowercase SHA-256 constraint.");
assert(migration.includes("private.economic_legal_manifest_is_valid(document_manifest)"), "Consent bundle manifests lost exact hash-aware database validation.");
assert(migration.includes("private.active_economic_legal_content_sha256"), "Public capabilities lost their active legal-content hash lookup.");

for (const [documentKey, reference] of Object.entries(billingLegalDocumentIntegrityExpectations)) {
  assert(migration.includes(`'contentSha256', private.active_economic_legal_content_sha256(`), "Public capabilities no longer expose content hashes for active legal documents.");
  assert(migration.includes(reference.contentSha256), `Database migration is missing the canonical hash for ${documentKey}.`);
}
for (const [bundleKey, bundle] of Object.entries(billingLegalConsentBundleIntegrityExpectations)) {
  assert(migration.includes(`'${bundleKey}'`), `Database migration is missing canonical bundle ${bundleKey}.`);
  for (const [documentKey, reference] of Object.entries(bundle.documents)) {
    assert(migration.includes(`"${documentKey}":${JSON.stringify(reference)}`), `Database bundle manifest is not bound to version, path, and hash: ${bundleKey}.${documentKey}`);
  }
}

for (const [label, source] of [["server", serverParser], ["browser", browserParser]]) {
  assert(source.includes("billingLegalDocumentIntegrityExpectations") && source.includes("billingLegalConsentBundleIntegrityExpectations"), `${label} capabilities parser does not use the canonical integrity manifest.`);
  assert(source.includes('Object.keys(document).length !== 3') || source.includes('exactRecord(documentMap[key], ["version", "path", "contentSha256"]'), `${label} capabilities parser lost exact three-field legal-reference validation.`);
  assert(source.includes("document.contentSha256 !== expectation.contentSha256") || source.includes("document.contentSha256 !== expectedDocument.contentSha256"), `${label} capabilities parser does not fail closed on content-hash mismatch.`);
}

console.log(`Economic legal content integrity smoke test ok (${integrityEntries.length} canonical pages).`);
