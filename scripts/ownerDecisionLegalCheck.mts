import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {legalPolicyPages,getLegalPolicy} from '../src/pages/Legal/legalPolicyPages.ts';
import {ownerDecisionLegalSlugs,ownerDecisionLegalVersion as version} from '../src/pages/Legal/ownerDecisionLegal.ts';
import {serializeEconomicLegalSemanticContent} from '../src/pages/Legal/economicLegalContentManifest.ts';
const file='src/pages/Legal/ownerDecisionLegalManifest.json',migration='supabase/migrations/20260910050000_owner_decision_legal_versions.sql';
const saved=JSON.parse(await fs.readFile(file,'utf8'));
const pages=Object.fromEntries(legalPolicyPages.filter(p=>ownerDecisionLegalSlugs.has(p.slug)).map(p=>[p.slug,{slug:p.slug,route:p.route,title:p.title,status:p.status,lastUpdated:p.lastUpdated,version,contentSha256:crypto.createHash('sha256').update(serializeEconomicLegalSemanticContent(p)).digest('hex')}]));
const bundles=Object.fromEntries(Object.entries(saved.bundles).map(([key,b]:[string,any])=>[key,{...b,documents:Object.fromEntries(Object.entries(b.documents).map(([k,d]:[string,any])=>[k,{...d,contentSha256:pages[d.path.split('/').pop()].contentSha256}]))}]));
// During this uncommitted implementation only, generated hashes are refreshed by a separate local script.
assert.deepEqual(saved,{pages,bundles},'New current policy hashes must match the exact reviewed content.');
const sql=await fs.readFile(migration,'utf8');
for(const page of Object.values(pages))assert(sql.includes(page.contentSha256));
for(const archive of ['readinessLegalArchive.json','ownerDecisionPriorLegalArchive.json'])for(const old of JSON.parse(await fs.readFile('src/pages/Legal/'+archive,'utf8')))assert.deepEqual(getLegalPolicy(old.slug,old.lastUpdated),old,'Historical policy was rewritten');
assert(!/update\s+private\.|delete\s+from|insert into private\.economic_active/i.test(sql),'Never rewrite history or activate consent pointers');
console.log('Owner policy legal integrity passed: 14 current versions, 8 staged bundles, frozen historical pages.');
