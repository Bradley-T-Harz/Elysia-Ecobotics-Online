import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {createHash} from 'node:crypto';
import {firstPartyLegalPageIntegrity,billingLegalConsentBundleIntegrityExpectations} from '../src/pages/Legal/firstPartyLegalManifest.ts';
import {serializeEconomicLegalSemanticContent} from '../src/pages/Legal/economicLegalContentManifest.ts';
const temp=await mkdtemp(join(tmpdir(),'first-party-legal-'));
try {
 await build({entryPoints:['src/pages/Legal/legalPolicyPages.ts'],bundle:true,platform:'node',format:'esm',outfile:join(temp,'pages.mjs')});
 const {getLegalPolicy}=await import(pathToFileURL(join(temp,'pages.mjs')));
 for(const [slug,ref] of Object.entries(firstPartyLegalPageIntegrity)) {
  const page=getLegalPolicy(slug,ref.version);assert(page);assert.equal(page.route,ref.path);
  assert.equal(createHash('sha256').update(serializeEconomicLegalSemanticContent(page)).digest('hex'),ref.contentSha256);
  assert(getLegalPolicy(slug,'2026-09-10-owner-decisions'),`Historical page missing: ${slug}`);
 }
 const sql=await readFile('supabase/migrations/20260915050000_first_party_prospective_legal.sql','utf8');
 for(const [key,bundle] of Object.entries(billingLegalConsentBundleIntegrityExpectations))if(bundle.version==='2026-09-15-first-party'){
  assert(sql.includes(`'${key}'`));for(const doc of Object.values(bundle.documents))assert(sql.includes(doc.contentSha256));
 }
 assert(!/update private[.]economic_legal_(document_versions|consent_bundle_versions)/i.test(sql));
 console.log('Prospective legal content, five active first-party bundles, and preserved historical routes verified.');
} finally {await rm(temp,{recursive:true,force:true});}
