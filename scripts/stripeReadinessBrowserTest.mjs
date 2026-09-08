import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { build } from "esbuild";
import { readinessEvidenceDirectory } from "./readinessPaths.mjs";
const root = process.cwd();
const evidence = await readinessEvidenceDirectory();
const publicationOnly = process.argv.includes("--publication");
const screenshots = path.join(evidence,publicationOnly ? "publication-screenshots" : "screenshots");
await fs.mkdir(screenshots,{recursive:true});
const baseline = JSON.parse(await fs.readFile(path.join(evidence,"baseline-preview-location.json"),"utf8"));
const compiled = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import PaymentRecordCard from './src/shared/billing/PaymentRecordCard.tsx';const common={id:'synthetic-record',publicReference:'synthetic-elysia-reference-0001',flow:'support_recurring',status:'succeeded',payee:'EcoSyneva Commons LLC',cadence:'monthly',orderStatus:'partially_refunded',refundedAmountCents:100,label:'Recurring support · succeeded',amountCents:500,currency:'USD',createdAt:'2026-09-08T00:00:00Z',receiptAvailable:false};createRoot(document.getElementById('root')).render(<main style={{padding:24,maxWidth:900,margin:'auto'}}><h1>Synthetic payment records — local preview</h1><PaymentRecordCard receipt={common}/><PaymentRecordCard receipt={{...common,id:'synthetic-marketplace',flow:'marketplace_purchase',cadence:'one_time',label:'Marketplace purchase · succeeded',payee:null,refundedAmountCents:null}}/></main>);`,resolveDir:root,loader:"tsx"},bundle:true,write:false,format:"esm",jsx:"automatic",define:{"process.env.NODE_ENV":"\"production\""}});
const fixtureJs = compiled.outputFiles[0].text;
const csp = (await fs.readFile(path.join(root,"public/_headers"),"utf8")).match(/^\s*Content-Security-Policy:\s*(.+)$/m)[1].trim();
const mime = {".js":"text/javascript",".css":"text/css",".html":"text/html",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".ico":"image/x-icon",".txt":"text/plain"};
async function serve(dist) {
 const css = (await fs.readdir(path.join(dist,"assets"))).filter(n=>n.endsWith(".css"));
 const server=http.createServer(async(req,res)=>{
  try {
   const pathname=new URL(req.url,"http://127.0.0.1").pathname;
   if(req.method!=="GET") {res.writeHead(405);res.end();return;}
   if(pathname==="/readiness-fixture.js") {res.writeHead(200,{"Content-Type":"text/javascript"});res.end(fixtureJs);return;}
   if(pathname==="/readiness-receipts") {res.writeHead(200,{"Content-Type":"text/html","Referrer-Policy":"no-referrer","Content-Security-Policy":csp});res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic records</title>${css.map(c=>`<link rel="stylesheet" href="/assets/${c}">`).join("")}</head><body><div id="root"></div><script type="module" src="/readiness-fixture.js"></script></body></html>`);return;}
   const candidate=path.resolve(dist,"."+decodeURIComponent(pathname));
   if(candidate!==dist&&!candidate.startsWith(dist+path.sep)) throw Error("invalid path");
   let file=candidate;
   try {if(!(await fs.stat(file)).isFile()) file=path.join(dist,"index.html");}catch {file=path.join(dist,"index.html");}
   res.writeHead(200,{"Content-Type":mime[path.extname(file)]??"application/octet-stream","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":csp});res.end(await fs.readFile(file));
  }catch {res.writeHead(404);res.end("Not found");}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {server,origin:`http://127.0.0.1:${server.address().port}`};
}
const afterRoot=publicationOnly ? JSON.parse(await fs.readFile(path.join(evidence,"publication-candidate.json"),"utf8")).directory : root;
const before=await serve(path.join(baseline.directory,"dist")), after=await serve(path.join(afterRoot,"dist"));
const browser=await chromium.launch({headless:true,args:["--disable-background-networking","--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"]});
const rows=[], unexpected=[], pageErrors=[], billingRequests=[], proofMutations=[];
const user={id:"e8000000-0000-4000-8000-000000000001",aud:"authenticated",role:"authenticated",email:"synthetic-member@example.invalid",email_confirmed_at:"2026-09-08T00:00:00Z",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},created_at:"2026-09-08T00:00:00Z"};
async function contextFor(signed=false, attachmentResult=null) {
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:"block"});
 if(signed) await context.addInitScript(({user})=>{ if(location.hostname!=="127.0.0.1") return; sessionStorage.setItem(`commonsCircle.profileSetupDraft.v2.${user.id}`,JSON.stringify({username:"readiness-member",display_name:"Synthetic Member",bio:"",is_developer:false,featured_public_links:[]})); localStorage.setItem("sb-readiness-fixture-auth-token",JSON.stringify({access_token:"synthetic-readiness-token",refresh_token:"synthetic-refresh",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})); },{user});
 await context.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname.startsWith("/api/billing/")) {billingRequests.push(url.pathname);return route.fulfill({status:503,contentType:"application/json",body:'{"error":"billing_disabled"}'});}
  if(url.origin===before.origin||url.origin===after.origin) {
   if(url.pathname.startsWith("/api/")) return route.fulfill({status:503,contentType:"application/json",body:'{"error":"synthetic_service_unavailable"}'});
   assert.equal(request.method(),"GET");return route.continue();
  }
  if(url.hostname==="readiness-fixture.supabase.co") {
   const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
   if(request.method()==="OPTIONS") return route.fulfill({status:204,headers,body:""});
   let body=[];
   if(attachmentResult!==null && request.method()==="POST" && url.pathname.startsWith("/storage/v1/object/stewardship-receipts/")) {
    assert.ok(!url.pathname.includes("private-person-name"));proofMutations.push({kind:"object",path:url.pathname});
    return route.fulfill({status:200,headers,contentType:"application/json",body:JSON.stringify({Key:url.pathname.split("/object/")[1]})});
   }
   if(attachmentResult!==null && request.method()==="POST" && url.pathname==="/rest/v1/stewardship_receipt_files") {
    const metadata=request.postDataJSON();assert.equal(metadata.original_filename,"redacted-proof.txt");assert.equal(metadata.mime_type,"text/plain");assert.match(metadata.sha256_hash,/^[a-f0-9]{64}$/);proofMutations.push({kind:"metadata",id:metadata.id,requestId:metadata.request_id});
   }
   if(attachmentResult!==null && request.method()==="POST" && url.pathname==="/rest/v1/rpc/attach_own_stewardship_receipt") {
    const input=request.postDataJSON(),metadata=proofMutations.filter(v=>v.kind==="metadata").at(-1);assert.equal(input.p_file_id,metadata.id);assert.equal(input.p_request_id,metadata.requestId);proofMutations.push({kind:"attachment",confirmed:attachmentResult});
    return route.fulfill({status:200,headers,contentType:"application/json",body:JSON.stringify(attachmentResult)});
   }
   if(attachmentResult!==null && request.method()==="POST" && url.pathname==="/rest/v1/review_items") body={id:"e8500000-0000-4000-8000-000000000001"};
   else if(url.pathname==="/auth/v1/user") body=user;
   else if(url.pathname==="/rest/v1/profiles" && request.headers().accept?.includes("vnd.pgrst.object")) body=null;
   else if(!url.pathname.startsWith("/rest/v1/")) unexpected.push({kind:"unknown_fixture_request",path:url.pathname,method:request.method()});
   // This preview never submits remote data, even to the fixture hostname.
   return route.fulfill({status:200,headers,contentType:"application/json",body:JSON.stringify(body)});
  }
  // All external assets/services are refused. Record host only, never URL tokens.
  return route.abort("blockedbyclient");
 });
 context.on("page",page=>page.on("pageerror",err=>pageErrors.push(err.message)));
 return context;
}
try {
 const context=await contextFor(),page=await context.newPage();
 const comparison=["/support","/marketplace","/legal/privacy-policy","/legal/donation-recognition-terms"];
 for(const [phase,site] of [["before",before],["after",after]]) for(const route of comparison) {
  await page.goto(site.origin+route);await page.locator("h1").first().waitFor();
  const text=await page.locator("body").innerText();
  assert.ok(!text.includes("Policy Not Found"));
  if(phase==="after"&&route==="/support") {await page.getByRole("heading",{name:"How EcoSyneva Is Funded",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Support checkout unavailable",exact:true}).isDisabled(),true);}
  if(phase==="after"&&route==="/legal/donation-recognition-terms") assert.ok(text.includes("Hosted proof handling")&&!text.includes("At launch, proof handling may be local metadata/hash only"));
  await page.screenshot({path:path.join(screenshots,`${phase}-${route.slice(1).replaceAll("/","-")}.png`),fullPage:true});
  rows.push({phase,route,viewport:"1440x1000",heading:await page.locator("h1").first().innerText(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)});
 }
 const routes=["/","/products","/archive","/support/thank-you","/commons-circle/support-billing","/commons-circle/settings/hosted-execution","/marketplace/account","/commune","/legal/support-and-billing-terms","/legal/refund-and-cancellation-policy","/legal/marketplace-commerce-terms","/legal/sandbox-credit-terms","/legal/organization-services-terms","/legal/sponsorship-independence-policy","/legal/job-post-fee-terms","/legal/terms-of-use","/legal/account-closure-financial-retention","/legal/support-and-billing-terms?version=2026-07-16","/legal/support-and-billing-terms?version=unrecognized"];
 for(const route of routes) {console.log(`Checking local route ${route}`);await page.goto(after.origin+route);await page.locator("h1,h2").first().waitFor();const heading=await page.locator("h1,h2").first().innerText();if(route.endsWith("unrecognized"))assert.equal(heading,"Policy Not Found");else assert.ok(!/not found/i.test(heading),route);rows.push({phase:"after",route,viewport:"1440x1000",heading});}
 await page.goto(after.origin+"/support");await page.getByRole("heading",{name:"How EcoSyneva Is Funded",exact:true}).waitFor();
 for(const href of await page.locator('#how-ecosyneva-is-funded a').evaluateAll(links=>links.map(a=>a.getAttribute("href")))) {assert.ok(href.startsWith("/")||href.startsWith("mailto:"));}
 await page.keyboard.press("Tab");assert.ok(await page.evaluate(()=>document.activeElement!==document.body),"Keyboard focus unavailable");
 await page.setViewportSize({width:390,height:844});
 for(const route of ["/support","/marketplace","/legal/donation-recognition-terms","/readiness-receipts"]) {
  await page.goto(after.origin+route);await page.locator("h1").first().waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,`Mobile overflow: ${route}`);
  if(route==="/readiness-receipts") {assert.equal(await page.getByText("$5.00",{exact:true}).count(),2);assert.ok((await page.locator("body").innerText()).includes("$1.00"));assert.equal(await page.locator("a[href^='mailto:support@']").count(),2);}
  await page.screenshot({path:path.join(screenshots,`after-mobile-${route.slice(1).replaceAll("/","-")}.png`),fullPage:true});rows.push({phase:"after",route,viewport:"390x844",horizontalOverflow:overflow});
 }
 await context.close();
 const signed=await contextFor(true),member=await signed.newPage();
 await member.goto(after.origin+"/commons-circle/setup/stewardship");await member.getByRole("heading",{name:"Optional stewardship support",exact:true}).waitFor();
 assert.equal(await member.getByRole("link",{name:"Visit organization site",exact:true}).count(),23);
 await member.locator('input[type="file"][accept*=".pdf"]').setInputFiles({name:"invalid-proof.html",mimeType:"text/html",buffer:Buffer.from("synthetic rejected proof")});
 assert.ok((await member.locator("body").innerText()).includes("Receipt/proof must be a PDF"));
 await member.screenshot({path:path.join(screenshots,"after-stewardship-synthetic-validation.png"),fullPage:true});
 rows.push({phase:"after",route:"/commons-circle/setup/stewardship",signedIn:"synthetic",organizations:23,invalidUpload:"refused before submission"});
 await signed.close();
 if(!publicationOnly) for(const attached of [true,false]) {
  const proofContext=await contextFor(true,attached),proofPage=await proofContext.newPage();
  await proofPage.goto(after.origin+"/commons-circle/setup/stewardship");await proofPage.getByRole("heading",{name:"Optional stewardship support",exact:true}).waitFor();
  await proofPage.getByRole("button",{name:"Choose for recognition draft",exact:true}).first().click();
  await proofPage.locator('input[type="file"][accept*=".pdf"]').setInputFiles({name:"private-person-name.txt",mimeType:"text/plain",buffer:Buffer.from("Synthetic redacted proof. No identifiers.")});
  await proofPage.getByRole("checkbox",{name:/I understand this file will be stored privately/}).check();
  await proofPage.getByRole("button",{name:"4. Final confirmation"}).click();
  await proofPage.getByRole("button",{name:"Create Commons Profile",exact:true}).click();
  if(attached) await proofPage.waitForURL(after.origin+"/commons-circle");
  else {await proofPage.getByText(/proof attachment was not confirmed/).waitFor();assert.ok(proofPage.url().endsWith("/commons-circle/setup/confirm"));}
  rows.push({phase:"after",route:"/commons-circle/setup/confirm",signedIn:"synthetic",proofAttachment:attached?"confirmed":"failure shown without false completion"});
  await proofContext.close();
 }
 assert.deepEqual(billingRequests,[],"Disabled browser dispatched billing requests");assert.deepEqual(unexpected,[]);assert.deepEqual(pageErrors,[]);
 await fs.writeFile(path.join(evidence,publicationOnly ? "publication-browser-route-evidence.json" : "browser-route-evidence.json"),JSON.stringify({localOnly:true,externalRequests:"blocked or fixture-fulfilled",rows,billingRequests,pageErrors},null,2)+"\n");
 console.log(`Local browser readiness checks passed: ${rows.length} route/viewport observations, before/after screenshots, mobile layout, keyboard focus, immutable versions, synthetic payment records and rejected proof format. No billing dispatch.`);
} finally {await browser.close();await Promise.all([new Promise(r=>before.server.close(r)),new Promise(r=>after.server.close(r))]);}
