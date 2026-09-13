import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
const result = await build({ stdin: { contents: `import * as model from './src/shared/codev/workspace'; import * as recovery from './src/shared/codev/workspaceRecovery'; window.workspaceFixture = { ...model, ...recovery };`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', write: false });
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
  console.log('PASS: real Chromium IndexedDB owner isolation, reload recovery, cross-tab compare-and-swap conflicts, dirty-buffer preservation and stale-delete refusal. No external network.');
  await context.close();
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
