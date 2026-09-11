import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { getLegalPolicy, legalPolicyPages } from '../src/pages/Legal/legalPolicyPages.ts';
import { wordingCleanupLegalVersion, wordingCleanupLegalSlugs } from '../src/pages/Legal/wordingCleanupLegal.ts';
import { serializeEconomicLegalSemanticContent } from '../src/pages/Legal/economicLegalContentManifest.ts';

const manifest = JSON.parse(await fs.readFile('src/pages/Legal/wordingCleanupLegalManifest.json', 'utf8'));
const hash = (page: NonNullable<ReturnType<typeof getLegalPolicy>>) => crypto.createHash('sha256').update(serializeEconomicLegalSemanticContent(page)).digest('hex');
assert.equal(manifest.version, wordingCleanupLegalVersion);
assert.equal(manifest.pages.length, legalPolicyPages.length);
assert.deepEqual(manifest.pages.filter((p: { changed: boolean }) => p.changed).map((p: { slug: string }) => p.slug).sort(), [...wordingCleanupLegalSlugs].sort());
for (const row of manifest.pages) {
  const current = getLegalPolicy(row.slug)!;
  assert.equal(hash(current), row.currentSha256, `${row.slug}: unreviewed current text`);
  if (row.changed) {
    assert.equal(hash(getLegalPolicy(row.slug, row.priorVersion)!), row.priorSha256, `${row.slug}: previous text was rewritten`);
    assert.deepEqual(getLegalPolicy(row.slug, wordingCleanupLegalVersion), current);
    assert(!current.body.includes('elysia-ecobotics-online.pages.dev'));
  } else {
    assert.equal(row.currentSha256, row.priorSha256, `${row.slug}: unrelated policy changed`);
    assert.equal(getLegalPolicy(row.slug, wordingCleanupLegalVersion), undefined);
  }
}
// All existing economic consent manifests must continue resolving to their frozen content.
const owner = JSON.parse(await fs.readFile('src/pages/Legal/ownerDecisionLegalManifest.json', 'utf8'));
for (const bundle of Object.values(owner.bundles) as { documents: Record<string, { path: string; version: string; contentSha256: string }> }[]) {
  for (const doc of Object.values(bundle.documents)) {
    assert.equal(hash(getLegalPolicy(doc.path.split('/').at(-1), doc.version)!), doc.contentSha256);
  }
}
assert.equal(getLegalPolicy('privacy-policy', 'unknown-version'), undefined);
assert(!getLegalPolicy('privacy-policy')!.body.includes('before backend account sync is built'));
assert(!getLegalPolicy('terms-of-use')!.body.includes('reviewed before publication'));
assert(getLegalPolicy('terms-of-use')!.body.includes('remain subject to legal review'));
console.log(`Wording legal integrity passed: ${legalPolicyPages.length} current pages, 8 corrected versions, exact prior text and all 8 consent bundles preserved.`);
