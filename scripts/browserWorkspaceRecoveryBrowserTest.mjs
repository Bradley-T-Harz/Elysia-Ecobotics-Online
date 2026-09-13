import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
const result = await build({ stdin: { contents: `import * as model from './src/shared/codev/workspace'; import * as recovery from './src/shared/codev/workspaceRecovery'; import * as patch from './src/shared/codev/patchRecovery'; import * as receipts from './src/shared/codev/browserReceipts'; window.workspaceFixture = { ...model, ...recovery, ...patch, ...receipts };`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', write: false });
const server = createServer((request,response)=>{
  response.setHeader('Cache-Control','no-store');
  if(request.url==='/fixture.js'){response.setHeader('Content-Type','application/javascript');response.end(result.outputFiles[0].contents)}
  else {response.setHeader('Content-Type','text/html');response.end('<!doctype html><html><body><script src="/fixture.js"></script></body></html>')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const page=await context.newPage();await page.goto(origin);await page.waitForFunction(()=>!!window.workspaceFixture);
  const initial=await page.evaluate(async()=>{
    const f=window.workspaceFixture;
    const owner={accountId:'account-A',browserId:f.browserWorkspaceId(),surface:'forge',draftId:'draft-A'};
    const workspace=new f.BrowserWorkspace(owner,'Fixture',[{path:'main.py',text:'answer = 1\n',provenance:'editor'}]);
    workspace.updateText('main.py','answer = 2\n');
    const loaded=await f.loadWorkspaceRecovery(owner);
    const handle=await f.saveWorkspaceRecovery(workspace,loaded.handle,true);
    window.recoveryTest={owner,workspace,handle};
    const other=await f.loadWorkspaceRecovery({...owner,accountId:'account-B'});
    return {generation:handle.generation,dirty:workspace.getSnapshot().dirty,other:other.workspace===null};
  });
  assert.deepEqual(initial,{generation:1,dirty:false,other:true});
  const second=await context.newPage();await second.goto(origin);await second.waitForFunction(()=>!!window.workspaceFixture);
  await second.evaluate(async()=>{
    const f=window.workspaceFixture;const owner={accountId:'account-A',browserId:f.browserWorkspaceId(),surface:'forge',draftId:'draft-A'};
    const loaded=await f.loadWorkspaceRecovery(owner);window.recoveryTest={owner,...loaded};
  });
  await page.evaluate(async()=>{const t=window.recoveryTest;t.workspace.updateText('main.py','answer = 3\n');t.handle=await window.workspaceFixture.saveWorkspaceRecovery(t.workspace,t.handle,true)});
  const conflict=await second.evaluate(async()=>{
    const t=window.recoveryTest;t.workspace.updateText('main.py','answer = 99\n');
    try {await window.workspaceFixture.saveWorkspaceRecovery(t.workspace,t.handle,true);return {blocked:false}}
    catch(error){return {blocked:error instanceof window.workspaceFixture.WorkspaceConflict,dirty:t.workspace.getSnapshot().dirty,text:t.workspace.getSnapshot().files[0].text}}
  });
  assert.deepEqual(conflict,{blocked:true,dirty:true,text:'answer = 99\n'});
  await page.reload();await page.waitForFunction(()=>!!window.workspaceFixture);
  const restored=await page.evaluate(async()=>{
    const f=window.workspaceFixture;const owner={accountId:'account-A',browserId:f.browserWorkspaceId(),surface:'forge',draftId:'draft-A'};
    const loaded=await f.loadWorkspaceRecovery(owner);return {generation:loaded.handle.generation,text:loaded.workspace.getSnapshot().files[0].text,dirty:loaded.workspace.getSnapshot().dirty,packageRevision:loaded.workspace.getSnapshot().packageRevision};
  });
  assert.deepEqual(restored,{generation:2,text:'answer = 3\n',dirty:false,packageRevision:null});
  const clearConflict=await second.evaluate(async()=>{try{await window.workspaceFixture.clearWorkspaceRecovery(window.recoveryTest.handle);return false}catch(error){return error instanceof window.workspaceFixture.WorkspaceConflict}});
  assert.equal(clearConflict,true);
  const patches=await page.evaluate(async()=>{
    const f=window.workspaceFixture;
    const owner={accountId:'account-A',browserId:f.browserWorkspaceId(),surface:'marketplace',draftId:null};
    const model=new f.BrowserWorkspace(owner,'Exact patch recovery',[
      {path:'main.py',text:'answer = 1\n',provenance:'editor'},
      {path:'LICENSE',text:'Full license\nSecond line.\n',provenance:'intake'},
      {path:'assets/data.bin',bytes:new Uint8Array([0,255,128,42]),provenance:'intake'}]);
    const original=await model.capture();const before=original.files.find(file=>file.path==='main.py');
    const text='answer = 2\n';const hash=await f.browserHash(new TextEncoder().encode(text));
    const plan={plan_id:'fixture_exact_patch',workspace_id:original.workspaceId,workspace_hash:original.contentHash,base_revision:original.revision,
      changes:[{path:'main.py',base_hash:before.content_hash,new_hash:hash,new_text:text}]};
    const backup=await f.backupCodevPatch(model,plan);
    const owned=await f.listCodevPatchBackups(owner),other=await f.listCodevPatchBackups({...owner,accountId:'account-B'}),otherDraft=await f.listCodevPatchBackups({...owner,draftId:'another-draft'});
    let otherClearBlocked=false;try{await f.clearCodevPatchBackup({...owner,accountId:'account-B'},backup.id);}catch{otherClearBlocked=true;}
    const input={planId:plan.plan_id,revision:original.revision,contentHash:original.contentHash,owner,explicitlyApproved:true,
      changes:[{path:'main.py',baseHash:before.content_hash,newHash:hash,text}]};
    let active=true,authorityRaceBlocked=false;
    try{await model.applyReviewedPatch({...input,assertAuthority:()=>{if(!active)throw Error('Draft locked while hashing');queueMicrotask(()=>{active=false;});}});}catch{authorityRaceBlocked=true;}
    const afterRefusal=await model.capture();
    await model.applyReviewedPatch(input);const accepted=await model.capture();
    let tamperedRecoveryBlocked=false;try{await f.restoreCodevPatch(model,{...backup,afterHash:'0'.repeat(64)},()=>{});}catch{tamperedRecoveryBlocked=true;}
    await f.restoreCodevPatch(model,backup,()=>{});const restored=await model.capture();
    let replayBlocked=false;try{await f.restoreCodevPatch(model,backup,()=>{});}catch{replayBlocked=true;}
    await f.clearCodevPatchBackup(owner,backup.id);
    await f.saveBrowserReceipt(owner,{operation_id:'fixture_receipt',request_id:'fixture_request',workspace_id:original.workspaceId,status:'completed',summary:'Exact synthetic browser mutation',files_changed:['main.py'],created_at:new Date().toISOString()});
    const ownTrace=(await f.loadBrowserReceipts(owner)).length,otherTrace=(await f.loadBrowserReceipts({...owner,accountId:'account-B'})).length;
    await f.clearBrowserReceipts({...owner,accountId:'account-B'});const ownTraceAfterOtherClear=(await f.loadBrowserReceipts(owner)).length;
    await f.clearBrowserReceipts(owner);
    return {ownTrace,otherTrace,ownTraceAfterOtherClear,ownerRecords:owned.length,otherRecords:other.length,otherDraftRecords:otherDraft.length,otherClearBlocked,authorityRaceBlocked,
      refusedHashUnchanged:afterRefusal.contentHash===original.contentHash,refusedRevisionUnchanged:afterRefusal.revision===original.revision,
      acceptedRevision:accepted.revision,restoredRevision:restored.revision,restoredHash:restored.contentHash===original.contentHash,
      binaryUnchanged:accepted.files.find(file=>file.path==='assets/data.bin').content_hash===original.files.find(file=>file.path==='assets/data.bin').content_hash,
      licenseUnchanged:accepted.files.find(file=>file.path==='LICENSE').content_hash===original.files.find(file=>file.path==='LICENSE').content_hash,
      tamperedRecoveryBlocked,replayBlocked,remaining:(await f.listCodevPatchBackups(owner)).length};
  });
  assert.deepEqual(patches,{ownTrace:1,otherTrace:0,ownTraceAfterOtherClear:1,ownerRecords:1,otherRecords:0,otherDraftRecords:0,otherClearBlocked:true,authorityRaceBlocked:true,
    refusedHashUnchanged:true,refusedRevisionUnchanged:true,acceptedRevision:1,restoredRevision:2,restoredHash:true,binaryUnchanged:true,licenseUnchanged:true,tamperedRecoveryBlocked:true,replayBlocked:true,remaining:0});
  console.log('PASS: real Chromium IndexedDB owner isolation, reload recovery, cross-tab compare-and-swap conflicts, dirty-buffer preservation stale-delete refusal, exact patch backups/restoration, account-scoped recovery and authority revocation during hashing. No external network.');
  await context.close();
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
