import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, firefox } from "playwright";
const browserFamily=process.env.ELYSIA_CODEV_BROWSER_FAMILY||"chromium";
assert(["chromium","firefox"].includes(browserFamily),"Unsupported Codev qualification browser");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
assert(process.env.ELYSIA_QA_ROOT?.startsWith("/tmp/elysia-pass10d-i-"),"Run through Elysia's disposable-XDG backend test runner.");
const child=spawn(process.env.ELYSIA_TEST_PYTHON||"python",["-u","-m","tests.codev_browser_fixture"],{cwd:path.resolve(root,"../Elysia"),env:process.env,shell:false,stdio:["pipe","pipe","pipe"]});
let stderr="";child.stderr.on("data",chunk=>stderr+=chunk);
const queued=[];const waiters=[];
createInterface({input:child.stdout}).on("line",line=>{if(!line.startsWith("{"))return;const value=JSON.parse(line);if(value.disposable_xdg)return;const waiter=waiters.shift();if(waiter)waiter(value);else queued.push(value);});
const next=()=>queued.length?Promise.resolve(queued.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Native fixture timeout: "+stderr)),15000);waiters.push(value=>{clearTimeout(timer);resolve(value);});});
const command=async value=>{child.stdin.write(JSON.stringify(value)+"\n");return next();};
let browser;
try {
 assert((await next()).fixture_ready);
 const source=await build({stdin:{contents:'import * as client from "./src/shared/codev/brokerClient.ts"; import * as workspace from "./src/shared/codev/workspace.ts"; window.codevFixture={...client,...workspace};',resolveDir:root},bundle:true,write:false,format:"iife",platform:"browser",target:"es2020"});
 const headers=await readFile(path.join(root,"public/_headers"),"utf8");
 const original=headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)[1].replace(" http://127.0.0.1:47321", "");
 const csp=original.replace("connect-src 'self'","connect-src 'self' http://127.0.0.1:47321");
 const origin="https://elysiaecobotics.com";browser=await ({chromium,firefox}[browserFamily]).launch({headless:true});const evidence=[];
 const scenarios=[{name:"original-csp",permission:"granted",csp:original,success:false},{name:"signed-connection",permission:"granted",csp,success:true}];
 if(browserFamily==="chromium")scenarios.splice(1,0,{name:"permission-denied",permission:"denied",csp,success:false});
 for(const scenario of scenarios){
  const context=await browser.newContext();const page=await context.newPage();
  let permissionName="Firefox normal security; no permission override";
  if(browserFamily==="chromium"){
   const cdp=await context.newCDPSession(page);const browserContextId=(await cdp.send("Target.getTargetInfo")).targetInfo.browserContextId;
   permissionName=null;
   for(const name of ["loopback-network","local-network-access"]){try{await cdp.send("Browser.setPermission",{permission:{name},setting:scenario.permission,origin,browserContextId});permissionName=name;break;}catch{}}
   assert(permissionName,"Browser permission descriptor required; no security flags disabled.");
  }
  await page.exposeFunction("nativePair",key=>command(key));
  await context.route(origin+"/**",route=>route.request().url().endsWith("/fixture.js")
    ?route.fulfill({status:200,contentType:"application/javascript",body:source.outputFiles[0].text})
    :route.fulfill({status:200,headers:{"content-type":"text/html","content-security-policy":scenario.csp,"permissions-policy":"loopback-network=(self), local-network=()"},body:'<!doctype html><html><body><button id="connect">Explicit Sync</button><script src="/fixture.js"></script></body></html>'}));
  await page.goto(origin+"/fixture");
  await page.evaluate(async()=>{
    const f=window.codevFixture;
    const scope={accountId:crypto.randomUUID(),loginSessionId:crypto.randomUUID(),origin:location.origin,surface:"forge",browserSessionId:f.codevRandomId()};
    const key=await f.createCodevKey(scope);
    const paired=await window.nativePair({op:"pair",key:key.publicKey,account_id:scope.accountId,browser_id:scope.browserSessionId});
    window.fixtureKey=key;window.fixturePair=paired.pairing;window.fixtureAccount=true;
    window.fixtureClient=new f.CodevBrokerClient(key,paired.pairing,async()=>{if(!window.fixtureAccount)throw new Error("Account changed");});
    document.getElementById("connect").onclick=async()=>{try{window.connectionResult={ok:true,session:await window.fixtureClient.verifyConnection()};}catch(error){window.connectionResult={ok:false,error:String(error)};}};
  });
  const before=await command({op:"counts"});await page.getByRole("button",{name:"Explicit Sync"}).click();
  await page.waitForFunction(()=>window.connectionResult,undefined,{timeout:25000});
  const connected=await page.evaluate(()=>window.connectionResult);const after=await command({op:"counts"});
  assert.equal(connected.ok,scenario.success,JSON.stringify(connected));
  if(!scenario.success)assert.equal(after.requests,before.requests,"Denied browser reached native broker");
  if(scenario.success){
    const result=await page.evaluate(async()=>{
      const f=window.codevFixture;const client=window.fixtureClient;const scope=window.fixtureKey.scope;
      const model=new f.BrowserWorkspace({accountId:scope.accountId,browserId:scope.browserSessionId,surface:"forge",draftId:crypto.randomUUID()},"Actual browser source",[
        {path:"main.py",text:"answer = 42\n",provenance:"editor"}, {path:"LICENSE",text:"Complete license text\nSecond line\n",provenance:"editor"},
        {path:"binary.bin",bytes:new Uint8Array([0,255,128,42]),provenance:"intake"}]);
      const original=await model.capture();
      const share=await client.request("workspace/share",{workspace_id:original.workspaceId,surface:"forge",draft_id:original.owner.draftId,label:"Actual browser source",
        base_revision:original.baseRevision,current_revision:original.revision,content_hash:original.contentHash,files:original.files.map(file=>file.path==="main.py"?file:{...file,text:null,availability:"metadata_only"}),
        scopes:["read","propose"],explicitly_approved:true,expected_epoch:0});
      const revision={workspace_id:original.workspaceId,revision:original.revision,content_hash:original.contentHash,grant_epoch:share.grant.epoch};
      const planned=await client.request("patch/plan",{...revision,summary:"Review answer",edits:{"main.py":"answer = 43\n"}});
      const approved=await client.request("patch/authorize",{...revision,plan_id:planned.plan.plan_id,plan_hash:planned.plan.plan_hash,explicitly_approved:true});
      const patch={planId:approved.plan.plan_id,revision:approved.plan.base_revision,contentHash:approved.plan.workspace_hash,owner:original.owner,explicitlyApproved:true,
        changes:approved.plan.changes.map(change=>({path:change.path,baseHash:change.base_hash,newHash:change.new_hash,text:change.new_text}))};
      const changed=await model.applyReviewedPatch(patch);let replayBlocked=false;
      try{await client.request("patch/authorize",{...revision,plan_id:planned.plan.plan_id,plan_hash:planned.plan.plan_hash,explicitly_approved:true});}catch{replayBlocked=true;}
      const wrong=structuredClone(window.fixturePair);wrong.native_public_key=(await f.createCodevKey(scope)).publicKey;
      let impostorBlocked=false;try{await new f.CodevBrokerClient(window.fixtureKey,wrong,async()=>{}).verifyConnection();}catch{impostorBlocked=true;}
      let privateExportBlocked=false;try{await crypto.subtle.exportKey("jwk",window.fixtureKey.privateKey);}catch{privateExportBlocked=true;}
      window.fixtureAccount=false;let accountBlocked=false;try{await client.verifyConnection();}catch{accountBlocked=true;}
      return {shared:share.shared_files,revision:changed.revision,originalRevision:original.revision,text:changed.files.find(file=>file.path==="main.py").text,
        licenseUnchanged:changed.files.find(file=>file.path==="LICENSE").content_hash===original.files.find(file=>file.path==="LICENSE").content_hash,
        binaryUnchanged:changed.files.find(file=>file.path==="binary.bin").content_hash===original.files.find(file=>file.path==="binary.bin").content_hash,
        replayBlocked,impostorBlocked,privateExportBlocked,accountBlocked};
    });
    assert.deepEqual(result.shared,["main.py"]);assert.equal(result.text,"answer = 43\n");assert.equal(result.revision,result.originalRevision+1);
    for(const flag of ["licenseUnchanged","binaryUnchanged","replayBlocked","impostorBlocked","privateExportBlocked","accountBlocked"])assert(result[flag],flag);
    evidence.push({scenario:scenario.name,permissionName,...result});
  }else evidence.push({scenario:scenario.name,permissionName,brokerRequests:after.requests-before.requests});
  await context.close();
 }
 const result={marker:"actual_browser_signed_codev_broker_ok",browserFamily,browser:browser.version(),syntheticIdentityAndProvider:true,realLoopbackSockets:true,browserSecurityFlagsDisabled:false,evidence};
 if(process.env.ELYSIA_CODEV_BROWSER_EVIDENCE)await writeFile(process.env.ELYSIA_CODEV_BROWSER_EVIDENCE,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser?.close();child.stdin.write('{"op":"stop"}\n');child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},3000);child.once("exit",()=>{clearTimeout(timer);resolve();});});}
