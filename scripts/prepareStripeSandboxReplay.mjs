// Preparation only: no network, database execution, credential reads or project creation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target='kdtqyxlrkpmlpupzgmwv',production='qwmcstyfegvpzjmjrylc';
const plan=JSON.parse(await readFile(path.join(root,'docs/stripe-sandbox-preparation-2026-09-16/sandbox-migration-plan.json'),'utf8'));
assert.equal(plan.stage,'PREPARED_NOT_APPLIED');assert.equal(plan.sandboxProjectRef,target);assert.equal(plan.forbiddenProductionProjectRef,production);
assert.equal(plan.pendingCount,74);assert.equal(plan.migrations.length,74);assert.equal(plan.seedEnabled,false);
const workspace=`/tmp/elysia-stripe-sandbox-${target}`;
assert.equal(plan.isolatedWorkspace,workspace);
const originalLink=await readFile(path.join(root,'supabase/.temp/project-ref'),'utf8');assert.equal(originalLink.trim(),production);
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const item of plan.migrations){
 assert.match(item.file,/^supabase\/migrations\/\d{14}_[A-Za-z0-9_]+\.sql$/);
 assert.equal(item.version,path.basename(item.file).slice(0,14));
 const bytes=await readFile(path.join(root,item.file));assert.equal(bytes.length,item.bytes);assert.equal(hash(bytes),item.sha256);
}
const link=path.join(workspace,'supabase/.temp/project-ref');
try{assert.equal((await readFile(link,'utf8')).trim(),target);}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(path.dirname(link),{recursive:true});await mkdir(path.join(workspace,'supabase/migrations'),{recursive:true});
await writeFile(link,target+'\n');
await writeFile(path.join(workspace,'supabase/config.toml'),'project_id = "elysia-stripe-isolated-sandbox"\n[db.seed]\nenabled = false\n');
for(const item of plan.migrations){const dest=path.join(workspace,item.file);await copyFile(path.join(root,item.file),dest);assert.equal(hash(await readFile(dest)),item.sha256);}
assert.equal(await readFile(path.join(root,'supabase/.temp/project-ref'),'utf8'),originalLink);
console.log(JSON.stringify({stage:'PREPARED_NOT_APPLIED',target,workspace,migrations:74,seedEnabled:false,productionLinkUnchanged:true,networkRequests:0,databaseWrites:0},null,2));
