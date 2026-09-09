import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

assert.equal(process.env.ELYSIA_ISOLATED_TEST, "1", "Use runReadinessChecks.mjs publisherBrowser");
const root = process.cwd(), dist = path.join(root, "dist");
const output = process.env.ELYSIA_READINESS_EVIDENCE_DIR || "/tmp/elysia-publisher-browser";
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
 const token=Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,role:"authenticated",aud:"authenticated",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")+".synthetic";
 const session={access_token:token,refresh_token:"synthetic-only",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:"bearer",user};
 if(signedIn)await context.addInitScript(s=>localStorage.setItem("sb-readiness-fixture-auth-token",JSON.stringify(s)),session);
 const publisher={id:manager?ids.publisher:ids.individual,displayName:manager?"Synthetic Official Publisher":"Synthetic Independent Publisher",entityKind:manager?"organization":"individual",legalName:manager?"Synthetic Organization":null,verified:false};
 const publishers=manager||role==="creator"?[publisher]:[];
 const reference={id:ids.reference,addonKey:"elysia-codev",version:"1.0.0",creatorAttribution:"Synthetic Organization",publisherId:ids.publisher,publisherDisplayName:"Synthetic Official Publisher",packageUrl:"https://example.invalid/release.vsix",packageSha256:"5cbb9298e0d9f56797b95854e4cf07db84fe2d7fc00deb7bc3364d503451f6ff",releaseReferenceUrl:"https://example.invalid/release/v1.0.0",official:true,distributionKind:"free",recordedAt:"2026-09-09T00:00:00Z",kind:"external_release_reference"};
 const profile=!noProfile&&(manager||role==="creator")?{id:ids.profile,user_id:user.id,developer_slug:"synthetic-developer",display_name:"Synthetic Developer",status:"requested"}:null;
 const drafts=[],writes=[];
 await context.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());
  if(/\/api\/(billing|economic-preparation)(\/|$)|stripe\.com|connect\.stripe/.test(url.href)){forbidden.push(url.href);return route.abort();}
  if(url.origin===origin)return route.continue();
  if(url.origin!=="https://readiness-fixture.supabase.co")return route.fulfill({status:200,body:""});
  const fulfill=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
  if(request.method()==="OPTIONS")return route.fulfill({status:204,headers});
  const name=url.pathname.split("/").at(-1),obj=request.headers().accept?.includes("vnd.pgrst.object");
  if(name==="user")return fulfill(signedIn?user:null);
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
  if(name==="addon_drafts"){
   if(request.method()==="POST"){
    const body=request.postDataJSON();writes.push({table:name,method:request.method(),body});
    if(!publishers.some(p=>p.id===body.publisher_id)||!body.creator_attribution)return fulfill({code:"42501"},403);
    const draft={id:`f5500000-0000-4000-8000-${String(drafts.length+1).padStart(12,"0")}`,submission_status:"draft",review_status:"not_submitted",risk_level:"unknown",validation_status:"not_validated",package_status:"not_uploaded",created_at:new Date().toISOString(),...body};drafts.push(draft);return fulfill(obj?draft:[draft]);
   }
   const id=url.searchParams.get("id")?.replace("eq.",""),draft=drafts.find(d=>d.id===id);
   if(request.method()==="PATCH"){const body=request.postDataJSON();writes.push({table:name,method:"PATCH",body});if(draft)Object.assign(draft,body);return fulfill(obj?draft??null:[]);}
   return fulfill(obj?draft??null:id?draft?[draft]:[]:drafts);
  }
  if(!["GET","HEAD"].includes(request.method())&&!url.pathname.includes("/rpc/"))writes.push({table:name,method:request.method()});
  return fulfill(obj?null:[]);
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on("pageerror",e=>pageErrors.push(e.message));
 return {context,page,drafts,writes,publishers};
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
try{
 for(const mobile of [false,true]){
  const suffix=mobile?"mobile":"desktop",f=await fixture("manager",{mobile});
  await f.page.goto(origin+"/marketplace/submit");await selectOwnership(f);await capture(f,`marketplace-submit-${suffix}`,".ownership-attribution");
  await f.page.goto(origin+"/developer-forge");await selectOwnership(f);await capture(f,`forge-home-${suffix}`,".ownership-attribution");
  await f.page.getByRole("link",{name:"New Draft",exact:true}).click();await selectOwnership(f);await capture(f,`forge-new-${suffix}`,".ownership-attribution");
  const create=f.page.getByRole("button",{name:"Create blank manifest draft"});await create.click();
  await f.page.getByText("Blank draft created.",{exact:true}).waitFor();
  await f.page.getByRole("link",{name:"Drafts",exact:true}).click();
  await f.page.locator(`a[href="/developer-forge/drafts/${f.drafts[0].id}"]`).first().click();
  await f.page.waitForURL(/drafts\/f550/);assert.equal(f.drafts[0].publisher_id,ids.publisher);assert.equal(f.drafts[0].creator_attribution,"Synthetic Organization");
  await capture(f,`forge-edit-${suffix}`,".ownership-attribution");
  await f.page.getByLabel("Creator / Organization",{exact:true}).fill("Synthetic revised attribution");
  await f.page.getByRole("button",{name:"Save draft",exact:true}).click();
  await f.page.waitForFunction(()=>document.body.textContent.includes("Draft saved")||document.body.textContent.includes("saved"));
  assert.equal(f.drafts[0].creator_attribution,"Synthetic revised attribution");
  await f.page.getByRole("button",{name:"Duplicate draft for revision"}).click();
  await f.page.getByText("Revision draft created as an editable duplicate. Submit it when changes are ready.",{exact:true}).waitFor();
  await f.page.getByRole("link",{name:"Drafts",exact:true}).click();
  await f.page.locator(`a[href="/developer-forge/drafts/${f.drafts[1].id}"]`).first().click();
  assert.equal(f.drafts[1].revision_of_draft_id,f.drafts[0].id);assert.equal(f.drafts[1].version,f.drafts[0].version);assert.equal(f.drafts[1].manifest_json.addon_id,f.drafts[0].manifest_json.addon_id);
  await capture(f,`forge-revision-${suffix}`,".ownership-attribution");
  await f.page.goto(origin+"/marketplace/creator-studio");await f.page.getByText("Official external release reference · Free",{exact:true}).waitFor();
  assert((await f.page.locator("body").innerText()).includes("does not establish a reviewed Marketplace listing"));
  await capture(f,`creator-studio-manager-${suffix}`,".publisher-provenance");await f.context.close();
 }
 for(const role of ["creator","reviewer","admin","operator","member","visitor"]){
  const f=await fixture(role);await f.page.goto(origin+"/marketplace/creator-studio");
  await f.page.getByRole("heading",{name:"Creator Studio",exact:true}).waitFor();
  if(role!=="visitor")await f.page.waitForFunction(()=>!document.body.textContent.includes("Checking publisher records…"));
  assert.equal(await f.page.getByText("Official external release reference · Free",{exact:true}).count(),0);
  await capture(f,`creator-studio-${role}`);
  await f.page.goto(origin+"/marketplace/submit");await f.page.getByLabel("Publisher account",{exact:true}).waitFor();
  if(role==="creator")await selectOwnership(f,ids.individual);
  assert.equal(await f.page.getByLabel("Publisher account",{exact:true}).locator(`option[value="${ids.publisher}"]`).count(),0);
  assert.equal(f.writes.length,0);await f.context.close();
 }
 const reviewer=await fixture("reviewer");activePage=reviewer.page;await reviewer.page.goto(origin+"/admin/review/marketplace");
 await reviewer.page.getByRole("heading",{name:/Marketplace.*Review Queue/}).waitFor();
 await reviewer.page.getByText("No active review items need action.",{exact:true}).waitFor();
 await capture(reviewer,"independent-non-admin-review-center");await reviewer.context.close();
 const individual=await fixture("member");await individual.page.goto(origin+"/marketplace/submit");
 await individual.page.getByText("Create my individual publisher identity",{exact:true}).click();
 await individual.page.getByLabel("New publisher display name",{exact:true}).fill("My Synthetic Publisher");await individual.page.getByRole("button",{name:"Create my publisher",exact:true}).click();
 await individual.page.getByLabel("Publisher account",{exact:true}).selectOption(ids.individual);assert.equal(individual.writes[0].body.p_publisher_id,null);await capture(individual,"individual-publisher-self-service",".ownership-attribution");await individual.context.close();
 const noProfile=await fixture("manager",{noProfile:true});await noProfile.page.goto(origin+"/marketplace/creator-studio");await noProfile.page.getByText("Official external release reference · Free",{exact:true}).waitFor();await capture(noProfile,"creator-studio-manager-without-developer-profile",".publisher-provenance");await noProfile.context.close();
 const unavailable=await fixture("manager",{unavailable:true});await unavailable.page.goto(origin+"/marketplace/submit");await unavailable.page.getByText("Publisher records are unavailable.",{exact:false}).first().waitFor();assert(await unavailable.page.getByLabel("Publisher account",{exact:true}).isDisabled());await capture(unavailable,"publisher-unavailable-fails-closed",".ownership-attribution");await unavailable.context.close();
 for(const mobile of [false,true]){const f=await fixture("visitor",{mobile});await f.page.goto(origin+"/marketplace/addons/elysia-codev");await f.page.getByText("External release provenance; this does not claim Marketplace review approval.",{exact:true}).waitFor();await capture(f,`public-codev-synthetic-provenance-${mobile?"mobile":"desktop"}`,".publisher-provenance");assert.equal(f.writes.length,0);await f.context.close();}
 assert.deepEqual(forbidden,[]);assert.deepEqual(pageErrors,[]);
 await fs.writeFile(path.join(output,"results.json"),JSON.stringify({syntheticOnly:true,realDatabaseAuthorization:"separate publisherOwnershipBehavior.sql",results,forbidden,pageErrors},null,2));
 console.log(`Publisher browser checks passed: ${results.length} desktop/mobile/role views; no provider requests or browser exceptions.`);
}catch(error){if(activePage){await activePage.screenshot({path:path.join(output,"failure.png")});await fs.writeFile(path.join(output,"failure.txt"),await activePage.locator("body").innerText());}throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
