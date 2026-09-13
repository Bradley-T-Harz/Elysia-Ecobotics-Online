import assert from "node:assert/strict";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

assert.equal(process.env.ELYSIA_ISOLATED_TEST, "1", "Use runReadinessChecks.mjs publisherBrowser");
const root = process.cwd(), dist = path.join(root, "dist");
const output = process.env.ELYSIA_READINESS_EVIDENCE_DIR || "/tmp/elysia-workspace-integration-browser";
await fs.mkdir(output, { recursive: true });
const index = await fs.readFile(path.join(dist, "index.html"));
const sources = await Promise.all((await fs.readdir(path.join(dist, "assets"))).filter(n => n.endsWith(".js")).map(n => fs.readFile(path.join(dist, "assets", n), "utf8")));
assert(sources.some(s => s.includes("https://readiness-fixture.supabase.co")), "Synthetic build required");
assert(!sources.some(s => /https:\/\/(?!readiness-fixture\.)[a-z0-9-]+\.supabase\.co/.test(s)), "Refuse any production Supabase origin");
assert(index.includes('name="elysia-billing-api-publication" content="disabled"'));
assert(index.includes('name="elysia-economic-preparation-publication" content="disabled"'));
const mime = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".html": "text/html" };
const csp = (await fs.readFile("public/_headers", "utf8")).match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
const server = http.createServer(async (request, response) => {
  try {
    const file = path.resolve(dist, "." + new URL(request.url, "http://localhost").pathname);
    if (!file.startsWith(dist + path.sep) && file !== dist) throw Error("Invalid path");
    let body = index, type = "text/html";
    try { if ((await fs.stat(file)).isFile()) { body = await fs.readFile(file); type = mime[path.extname(file)] || "application/octet-stream"; } } catch { /* SPA */ }
    response.writeHead(200, { "content-type": type, "cache-control": "no-store", "content-security-policy": csp }); response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
// All accounts, publisher UUIDs and responses below are synthetic UI fixtures.
// Real PostgreSQL authorization is tested separately by publisherOwnershipBehavior.sql.
const ids={manager:"f5100000-0000-4000-8000-000000000001",other:"f5100000-0000-4000-8000-000000000002",publisher:"f5200000-0000-4000-8000-000000000001",individual:"f5200000-0000-4000-8000-000000000002",profile:"f5300000-0000-4000-8000-000000000001",reference:"f5400000-0000-4000-8000-000000000001"};
const results=[],forbidden=[],pageErrors=[];
const headers={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,PATCH,DELETE,OPTIONS","content-range":"0-0/*"};
async function fixture(role,{mobile=false,noProfile=false,unavailable=false}={}){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:"block"});
 const manager=role==="manager",signedIn=role!=="visitor";
 const user={id:manager?ids.manager:ids.other,aud:"authenticated",role:"authenticated",email:"synthetic-publisher@example.invalid",email_confirmed_at:"2026-09-01T00:00:00Z",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},created_at:"2026-08-01T00:00:00Z"};
 const token=Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,role:"authenticated",aud:"authenticated",session_id:"fixture-login-A",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")+".synthetic";
 const session={access_token:token,refresh_token:"synthetic-only",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:"bearer",user};
 if(signedIn)await context.addInitScript(s=>localStorage.getItem("sb-readiness-fixture-auth-token") || localStorage.setItem("sb-readiness-fixture-auth-token",JSON.stringify(s)),session);
 const publisher={id:manager?ids.publisher:ids.individual,displayName:manager?"Synthetic Official Publisher":"Synthetic Independent Publisher",entityKind:manager?"organization":"individual",legalName:manager?"Synthetic Organization":null,verified:false};
 const publishers=manager||role==="creator"?[publisher]:[];
 const reference={id:ids.reference,addonKey:"elysia-codev",version:"1.0.0",creatorAttribution:"Synthetic Organization",publisherId:ids.publisher,publisherDisplayName:"Synthetic Official Publisher",packageUrl:"https://example.invalid/release.vsix",packageSha256:"5cbb9298e0d9f56797b95854e4cf07db84fe2d7fc00deb7bc3364d503451f6ff",releaseReferenceUrl:"https://example.invalid/release/v1.0.0",official:true,distributionKind:"free",recordedAt:"2026-09-09T00:00:00Z",kind:"external_release_reference"};
 const profile=!noProfile&&(manager||role==="creator")?{id:ids.profile,user_id:user.id,developer_slug:"synthetic-developer",display_name:"Synthetic Developer",status:"requested"}:null;
 const drafts=[],writes=[],packages=[],storedBytes=[],submissions=[],snapshots=[],permissions=[]; const controls={failUpload:false,otherAccount:false,delayDraftRead:null};
 await context.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());
  if(/\/api\/(billing|economic-preparation)(\/|$)|stripe\.com|connect\.stripe/.test(url.href)){forbidden.push(url.href);return route.abort();}
  if(url.origin!==origin&&/^(localhost|127\.|\[::1\])/.test(url.hostname)){forbidden.push(url.origin);return route.abort();}
  if(url.origin===origin)return route.continue();
  if(url.origin!=="https://readiness-fixture.supabase.co")return route.fulfill({status:200,body:""});
  const fulfill=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
  if(request.method()==="OPTIONS")return route.fulfill({status:204,headers});
  const name=url.pathname.split("/").at(-1),obj=request.headers().accept?.includes("vnd.pgrst.object");
  if(name==="user")return fulfill(signedIn?{...user,id:controls.otherAccount?ids.other:user.id}:null);
  if(name==="logout")return fulfill({});
  if(name==="profiles")return fulfill(obj?{id:user.id,username:"synthetic-publisher",display_name:"Synthetic Commons Name",is_admin:role==="admin",commons_onboarding_completed_at:"2026-09-01T00:00:00Z"}:[]);
  if(name==="user_roles")return fulfill(role==="admin"?[{role:"administrator",revoked_at:null}]:role==="reviewer"?[{role:"marketplace_reviewer",revoked_at:null}]:[]);
  if(name==="current_user_can_review_domain")return fulfill(role==="reviewer"||role==="admin");
  if(name==="current_user_economic_operator_overview")return fulfill({authorized:role==="operator",capabilities:role==="operator"?["marketplace_payout_manage"]:[],test_mode:true});
  if(name==="current_user_publisher_workspace")return unavailable?fulfill({code:"PGRST202"},404):fulfill({publishers,commonsDisplayName:"Synthetic Commons Name",releaseReferences:manager?[reference]:[],listings:[]});
  if(name==="save_own_marketplace_publisher"){
   const args=request.postDataJSON();writes.push({table:"publisher_rpc",method:"POST",body:args});
   if(!signedIn||args.p_publisher_id!==null)return fulfill({code:"42501"},403);
   publishers.push({...publisher,displayName:args.p_display_name});return fulfill(publisher.id);
  }
  if(name==="get_addon_publisher_provenance"){
   const args=request.postDataJSON();return fulfill(args.p_addon_key==="elysia-codev"&&args.p_version==="1.0.0"&&args.p_package_sha256===reference.packageSha256?{publisherId:ids.publisher,creatorAttribution:reference.creatorAttribution,publisherDisplayName:reference.publisherDisplayName,version:reference.version,packageSha256:reference.packageSha256,recordedAt:reference.recordedAt,kind:reference.kind}:null);
  }
  if(name==="developer_profiles")return fulfill(obj?profile:profile?[profile]:[]);
  if(url.pathname.includes("/storage/v1/object/addon-packages/")) {
   writes.push({table:"storage",method:request.method()});
   if(controls.failUpload)return fulfill({message:"Synthetic storage unavailable"},503);
   const form=await new Response(request.postDataBuffer(),{headers:{"content-type":request.headers()["content-type"]}}).formData();
   for(const value of form.values())if(value instanceof File)storedBytes.push(Buffer.from(await value.arrayBuffer()));
   return fulfill({Key:url.pathname.split("/object/")[1]});
  }
  if(name==="addon_draft_permissions") {
   const draftId=url.searchParams.get("addon_draft_id")?.replace("eq.","");
   if(request.method()==="DELETE"){for(let i=permissions.length-1;i>=0;i--)if(permissions[i].addon_draft_id===draftId)permissions.splice(i,1);return fulfill([]);}
   if(request.method()==="POST"){permissions.push(...request.postDataJSON());return fulfill([]);}
   return fulfill(permissions.filter(item=>item.addon_draft_id===draftId));
  }
  if(name==="addon_submission_snapshots"&&request.method()==="POST"){snapshots.push(request.postDataJSON());return fulfill([]);}
  if(name==="addon_packages") {
   if(request.method()==="POST"){const row={id:`fixture-package-${packages.length+1}`,...request.postDataJSON()};packages.push(row);writes.push({table:name,method:"POST",body:row});return fulfill(obj?row:[row]);}
   if(controls.delayDraftRead&&request.method()==="GET"&&url.searchParams.has("id")){const delay=controls.delayDraftRead;controls.delayDraftRead=null;await delay;}
   const id=url.searchParams.get("id")?.replace("eq.","");return fulfill(id?packages.filter(item=>item.id===id):packages);
  }
  if(name==="addon_submissions"&&request.method()==="POST") {const row={id:`fixture-submission-${submissions.length+1}`,...request.postDataJSON()};submissions.push(row);writes.push({table:name,method:"POST",body:row});return fulfill(obj?row:[row]);}
  if(name==="addon_drafts"){
   if(request.method()==="POST"){
    const body=request.postDataJSON();writes.push({table:name,method:request.method(),body});
    if(!publishers.some(p=>p.id===body.publisher_id)||!body.creator_attribution)return fulfill({code:"42501"},403);
    const draft={id:`f5500000-0000-4000-8000-${String(drafts.length+1).padStart(12,"0")}`,submission_status:"draft",review_status:"not_submitted",risk_level:"unknown",validation_status:"not_validated",package_status:"not_uploaded",created_at:new Date().toISOString(),...body};drafts.push(draft);return fulfill(obj?draft:[draft]);
   }
   if(controls.delayDraftRead&&request.method()==="GET"&&url.searchParams.has("id")){const delay=controls.delayDraftRead;controls.delayDraftRead=null;await delay;}
   const id=url.searchParams.get("id")?.replace("eq.",""),draft=drafts.find(d=>d.id===id);
   if(request.method()==="PATCH"){const body=request.postDataJSON();writes.push({table:name,method:"PATCH",body});const expected=url.searchParams.get("updated_at")?.replace("eq.",""); if(expected&&draft?.updated_at!==expected)return fulfill([]); if(draft)Object.assign(draft,body);return fulfill(obj?draft??null:draft?[draft]:[]);}
   const owner=url.searchParams.get("owner_user_id")?.replace("eq.","");const visible=drafts.filter(item=>!owner||item.owner_user_id===owner);return fulfill(obj?draft??null:id?visible.filter(item=>item.id===id):visible);
  }
  if(!["GET","HEAD"].includes(request.method())&&!url.pathname.includes("/rpc/"))writes.push({table:name,method:request.method()});
  return fulfill(obj?null:[]);
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on("pageerror",e=>pageErrors.push(e.message));
 return {context,page,drafts,writes,publishers,packages,storedBytes,submissions,snapshots,controls,session};
}
async function capture(f,name,selector){
 activePage=f.page;await f.page.waitForTimeout(250);
 if(selector)await f.page.locator(selector).first().scrollIntoViewIfNeeded();
 await f.page.evaluate(()=>scrollBy(0,-140));
 const overflow=await f.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(overflow<=1,`${name}: overflow ${overflow}`);
 await f.page.screenshot({path:path.join(output,name+".png"),fullPage:false});
 results.push({name,route:new URL(f.page.url()).pathname,overflow,writes:f.writes.length,screenshot:name+".png"});
}
async function selectOwnership(f,publisherId=ids.publisher){
 activePage=f.page;
 await f.page.getByLabel("Publisher account",{exact:true}).selectOption(publisherId);
 await f.page.getByRole("button",{name:"Use my Commons Profile display name"}).click();
 assert.equal(await f.page.getByLabel("Creator / Organization",{exact:true}).inputValue(),"Synthetic Commons Name");
 await f.page.getByLabel("Creator / Organization",{exact:true}).fill("Synthetic Organization");
}
let activePage;
async function editFile(page, name, text) {
 await page.locator('.forge-editor-tabs').getByRole('button',{name,exact:true}).click();
 const editor=page.locator('.monaco-editor [role="textbox"]').first();await editor.waitFor({state:'attached'});await editor.focus();await editor.press('ControlOrMeta+A');await page.keyboard.insertText(text);await page.waitForTimeout(100);
}
async function download(page) {
 const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export current inert .elysia-addon',exact:true}).click()]);
 const location=await file.path();return fs.readFile(location);
}
async function switchSession(f, session) {
 await f.page.evaluate(session=>{localStorage.setItem('sb-readiness-fixture-auth-token',JSON.stringify(session));const channel=new BroadcastChannel('sb-readiness-fixture-auth-token');channel.postMessage({event:'TOKEN_REFRESHED',session});setTimeout(()=>channel.close(),50);},session);
 await f.page.waitForTimeout(200);
}
try {
 const f=await fixture('manager');activePage=f.page;
 await f.page.goto(origin+'/developer-forge/drafts/new');await selectOwnership(f);await f.page.getByRole('button',{name:'Create blank manifest draft'}).click();await f.page.getByText('Blank draft created.',{exact:true}).waitFor();
 await f.page.getByRole('link',{name:'Drafts',exact:true}).click();await f.page.getByRole('heading',{name:'Package and repository intake'}).waitFor();
 await editFile(f.page,'LICENSE','Synthetic starter license edited before import.\n');
 assert(await f.page.getByRole('button',{name:'Transfer selected package privately',exact:true}).isVisible(),'Editing starter source must expose the existing private-transfer flow');
 const initialManifest=structuredClone(f.drafts[0].manifest_json);initialManifest.name='Current source fixture';
 const license='Copyright Fixture Contributors\n\nPermission is granted to use this synthetic fixture.\n\nTHE MATERIAL IS PROVIDED WITHOUT WARRANTY.\n';
 const zip=new JSZip();zip.file('manifest.json',JSON.stringify(initialManifest,null,2));zip.file('LICENSE',license);zip.file('src/main.ts','export const answer = 1;\n');zip.file('assets/data.bin',new Uint8Array([0,255,128,11]));
 const bytes=await zip.generateAsync({type:'nodebuffer'});
 await f.page.getByLabel('Import .elysia-addon').last().setInputFiles({name:'workspace-fixture.elysia-addon',mimeType:'application/zip',buffer:bytes});
 await f.page.getByText('4 files selected locally',{exact:false}).first().waitFor();
 const editedLicense=license+'\nAdditional exact retained line.\n';await editFile(f.page,'LICENSE',editedLicense);
 await f.page.getByRole('button',{name:'Save draft',exact:true}).click();await f.page.getByText('Current files are saved in this browser',{exact:false}).waitFor();
 assert.equal(f.drafts[0].license,'MIT','Full LICENSE edits must not overwrite SPDX metadata');
 await f.page.reload();await f.page.getByRole('heading',{name:'Package and repository intake'}).waitFor();
 const exported=await download(f.page);const archive=await JSZip.loadAsync(exported);
 assert.equal(await archive.file('LICENSE').async('string'),editedLicense);assert.deepEqual([...await archive.file('assets/data.bin').async('uint8array')],[0,255,128,11]);assert.equal(await archive.file('src/main.ts').async('string'),'export const answer = 1;\n');
 const refreshed={...f.session,access_token:f.session.access_token.replace('.synthetic','.refreshed')};await switchSession(f,refreshed);
 await editFile(f.page,'LICENSE',editedLicense+'After token refresh.\n');
 await f.page.getByRole('link',{name:'Docs',exact:true}).click();await f.page.getByRole('link',{name:'Drafts',exact:true}).click();
 const afterNavigation=await JSZip.loadAsync(await download(f.page));assert.equal(await afterNavigation.file('LICENSE').async('string'),editedLicense+'After token refresh.\n');
 // A late successful save advances only the remote baseline; newer local edits survive.
 let releaseSave;f.controls.delayDraftRead=new Promise(resolve=>{releaseSave=resolve});
 await f.page.getByRole('button',{name:'Save draft',exact:true}).click();
 const saveDeadline=Date.now()+10000;while(f.controls.delayDraftRead&&Date.now()<saveDeadline)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(f.controls.delayDraftRead,null);
 const duringSave=editedLicense+'Typed while metadata save was pending.\n';await editFile(f.page,'LICENSE',duringSave);releaseSave();
 await f.page.getByText('Newer browser edits were preserved and still need Save draft.',{exact:false}).waitFor();
 const lateSavedArchive=await JSZip.loadAsync(await download(f.page));assert.equal(await lateSavedArchive.file('LICENSE').async('string'),duringSave);
 const savesBeforeRetry=f.writes.filter(item=>item.table==='addon_drafts'&&item.method==='PATCH').length;
 await f.page.getByRole('button',{name:'Save draft',exact:true}).click();
 const retryDeadline=Date.now()+10000;while(f.writes.filter(item=>item.table==='addon_drafts'&&item.method==='PATCH').length===savesBeforeRetry&&Date.now()<retryDeadline)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(f.writes.filter(item=>item.table==='addon_drafts'&&item.method==='PATCH').length,savesBeforeRetry+1);await f.page.waitForTimeout(200);
 // Concurrent remote metadata edits must not be overwritten by a stale browser draft.
 f.drafts[0].short_summary='Changed in another tab';f.drafts[0].updated_at=new Date(Date.now()+1000).toISOString();
 const previousWrites=f.writes.filter(item=>item.table==='addon_drafts'&&item.method==='PATCH').length;
 await f.page.getByRole('button',{name:'Save draft',exact:true}).click();await f.page.getByText('The remote draft metadata changed.',{exact:false}).waitFor();
 assert.equal(f.writes.filter(item=>item.table==='addon_drafts'&&item.method==='PATCH').length,previousWrites);
 await capture(f,'forge-current-source-recovery-and-conflict','#forge-workbench');
 // Switching to another account cannot attach the preceding account's browser files.
 f.controls.otherAccount=true;
 const accountB={...refreshed,user:{...refreshed.user,id:ids.other},access_token:Buffer.from('{"alg":"none"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:ids.other,role:'authenticated',aud:'authenticated',session_id:'fixture-login-B',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic'};
 await switchSession(f,accountB);await f.page.getByRole('heading',{name:'Safe starter add-ons',exact:true}).waitFor();
 assert.equal((await f.page.locator('body').innerText()).includes('After token refresh.'),false);
 await f.context.close();
 // Marketplace transfer must use the edited manifest and original binary/source bytes.
 const m=await fixture('manager');activePage=m.page;await m.page.goto(origin+'/marketplace/submit');await selectOwnership(m);
 await m.page.getByLabel('Import .elysia-addon').setInputFiles({name:'workspace-fixture.elysia-addon',mimeType:'application/zip',buffer:bytes});
 await m.page.getByText('Included file tree',{exact:false}).waitFor();await m.page.getByLabel('Add-on name',{exact:true}).fill('Edited before private transfer');
 await m.page.locator('label.checkbox-line').filter({hasText:'manifest and any selected package files will leave my computer'}).locator('input').check();
 m.controls.failUpload=true;await m.page.getByRole('button',{name:'Submit private pending review',exact:true}).click();await m.page.getByText('Package transfer was not fully confirmed.',{exact:false}).first().waitFor();
 assert.equal(m.submissions.length,0);assert.equal(m.packages.length,0);assert.equal(m.storedBytes.length,0);
 m.controls.failUpload=false;await m.page.locator('label.checkbox-line').filter({hasText:'manifest and any selected package files will leave my computer'}).locator('input').check();
 await m.page.getByRole('button',{name:'Submit private pending review',exact:true}).click();await m.page.waitForFunction(()=>document.body.textContent.includes('private Developer Forge review queue')||document.body.textContent.includes('private submission record was created'));
 assert.equal(m.storedBytes.length,1);assert.equal(m.submissions.length,1);assert.equal(m.packages.length,1);
 const uploaded=await JSZip.loadAsync(m.storedBytes[0]);assert.equal(JSON.parse(await uploaded.file('manifest.json').async('string')).name,'Edited before private transfer');assert.equal(await uploaded.file('LICENSE').async('string'),license);assert.deepEqual([...await uploaded.file('assets/data.bin').async('uint8array')],[0,255,128,11]);
 assert.equal(createHash('sha256').update(m.storedBytes[0]).digest('hex'),m.packages[0].sha256);assert.equal(m.packages[0].archive_inspection_json.workspace_receipt.package_hash,m.packages[0].sha256);
 assert.equal(m.snapshots[0].package_snapshot.id,m.packages[0].id);assert.equal(m.snapshots[0].package_sha256,m.packages[0].sha256);
 await capture(m,'marketplace-current-byte-private-transfer','.submission-card');await m.context.close();
 const delayed=await fixture('manager');activePage=delayed.page;await delayed.page.goto(origin+'/marketplace/submit');await selectOwnership(delayed);
 await delayed.page.getByLabel('Import .elysia-addon').setInputFiles({name:'workspace-fixture.elysia-addon',mimeType:'application/zip',buffer:bytes});
 await delayed.page.getByText('Included file tree',{exact:false}).waitFor();
 await delayed.page.locator('label.checkbox-line').filter({hasText:'manifest and any selected package files will leave my computer'}).locator('input').check();
 let release;delayed.controls.delayDraftRead=new Promise(resolve=>{release=resolve});
 await delayed.page.getByRole('button',{name:'Submit private pending review',exact:true}).click();
 const deadline=Date.now()+10000;while(delayed.controls.delayDraftRead&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(delayed.controls.delayDraftRead,null,'Transfer must reach the paused owned-draft check');
 delayed.controls.otherAccount=true;await switchSession(delayed,accountB);release();
 await delayed.page.waitForTimeout(300);
 assert.equal(delayed.storedBytes.length,0,'An account change during a pending API response must withhold all source bytes');assert.equal(delayed.submissions.length,0);
 assert.equal(await delayed.page.getByLabel('Add-on name',{exact:true}).inputValue(),'My Add-on');
 await delayed.context.close();
 assert.deepEqual(pageErrors,[]);assert.deepEqual(forbidden,[]);
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({syntheticOnly:true,results,pageErrors,forbidden,checks:['full LICENSE and binary recovery/export','token refresh and route continuity','remote metadata conflict refuses overwrite','account boundary','failed upload stops submission','current-byte upload and receipt']},null,2));
 console.log('PASS: canonical browser page recovery, exact files/exports/transfers, stable token refresh, stale saves, and failed-upload submission refusal. Synthetic responses only.');
} catch(error) {if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(output,'failure.png')});await fs.writeFile(path.join(output,'failure.txt'),await activePage.locator('body').innerText());await fs.writeFile(path.join(output,'failure-editor.html'),await activePage.locator('.forge-monaco-shell').first().innerHTML().catch(()=>''));}throw error;} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
