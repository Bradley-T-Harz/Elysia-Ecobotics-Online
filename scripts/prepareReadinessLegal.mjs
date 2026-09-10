// This public revision is now immutable. Future edits need a NEW version and
// migration; this checker never rewrites historical hashes or archive text.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
const legalPolicyPages = JSON.parse(await fs.readFile(new URL("../src/pages/Legal/readinessLegalArchive.json", import.meta.url), "utf8"));
import {archivedLegalPolicyPages} from "../src/pages/Legal/economicLegalArchive.ts";
import {readinessLegalVersion as version} from "../src/pages/Legal/readinessLegalClarifications.ts";
import {serializeEconomicLegalSemanticContent, billingLegalConsentBundleIntegrityExpectations} from "../src/pages/Legal/economicLegalContentManifest.ts";
import {preparedEconomicLegalPageIntegrity, preparedEconomicLegalBundles} from "../src/pages/Legal/preparedEconomicLegalManifest.ts";
if (process.argv.length !== 3 || process.argv[2] !== "--check") throw new Error("This legal revision is published and immutable. Use --check; future revisions need a new version and migration.");
const root = new URL("../", import.meta.url);
const pages = legalPolicyPages.filter(p => archivedLegalPolicyPages.some(a => a.slug === p.slug));
const manifest = Object.fromEntries(pages.map(p => [p.slug, {slug:p.slug, route:p.route,title:p.title,status:p.status,lastUpdated:p.lastUpdated,version,contentSha256:crypto.createHash("sha256").update(serializeEconomicLegalSemanticContent(p)).digest("hex")}]));
const bundles = Object.fromEntries(Object.entries(billingLegalConsentBundleIntegrityExpectations).map(([k,b]) => [k, {...b,version,documents:Object.fromEntries(Object.entries(b.documents).map(([k,d]) => [k,{version,path:d.path,contentSha256:manifest[d.path.split("/").pop()].contentSha256}]))}]));
assert.deepEqual(preparedEconomicLegalPageIntegrity, manifest, "Published semantic hashes must not change.");
assert.deepEqual(preparedEconomicLegalBundles, bundles, "Prepared bundle hashes must match the published documents.");
const old = await fs.readFile(new URL("supabase/migrations/20260716020000_private_economic_core.sql",root),"utf8");
const rows = [...old.slice(old.indexOf("insert into private.economic_legal_document_versions("),old.indexOf("insert into private.economic_active_legal_documents(")).matchAll(/\('([^']+)', '[^']+', '(\/legal\/[^']+)', '[a-f0-9]{64}'\)/g)].map(([,k,p]) => `  ('${k}', '${version}', '${p}', '${manifest[p.split("/").pop()].contentSha256}', 'infinity'::timestamptz)`);
for (const slug of ["donation-recognition-terms","terms-of-use"]) rows.push(`  ('${slug.replaceAll("-","_")}', '${version}', '/legal/${slug}', '${manifest[slug].contentSha256}', 'infinity'::timestamptz)`);
const expectedMigration = `-- Prepared public text, not an activation or a retroactive acceptance.\n-- Infinite effective date marks staged rows; no active pointers are changed.\nbegin;\ninsert into private.economic_legal_document_versions (document_key, document_version, public_path, content_sha256, effective_at) values\n${rows.join(",\n")};\ninsert into private.economic_legal_consent_bundle_versions (bundle_key, bundle_version, public_path, document_manifest, effective_at) values\n${Object.entries(bundles).map(([k,b]) => `  ('${k}', '${version}', '${b.path}', '${JSON.stringify(b.documents)}'::jsonb, 'infinity'::timestamptz)`).join(",\n")};\ncommit;\n`;
assert.equal(await fs.readFile(new URL("supabase/migrations/20260908010000_prepared_economic_legal_versions.sql",root), "utf8"), expectedMigration, "Staged legal migration must match the immutable revision without activation.");
console.log(`Verified ${pages.length} published semantic versions and ${Object.keys(bundles).length} inactive bundles; no files written.`);
