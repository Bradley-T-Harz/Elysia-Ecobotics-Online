import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

assert.equal(process.env.ELYSIA_ISOLATED_TEST, "1", "Use runReadinessChecks.mjs ownerBrowser");
const root = process.cwd(), dist = path.join(root, "dist");
const output = process.env.ELYSIA_READINESS_EVIDENCE_DIR || "/tmp/elysia-owner-browser";
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
const uid='f8100000-0000-4000-8000-000000000001',other='f8100000-0000-4000-8000-000000000002',rid='f8200000-0000-4000-8000-000000000001',reviewId='f8300000-0000-4000-8000-000000000001';
const results=[],forbidden=[],errors=[];
const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'};
let activePage;
async function fixture(role,{mobile=false,unavailable=false}={}) {
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'});
 const signed=role!=='visitor',roles={reviewer:['work_with_reviewer'],steward:['stewardship_reviewer'],market:['marketplace_reviewer'],admin:['administrator']}[role]??[];
 const user={id:role==='member'?uid:other,email:'synthetic-owner-check@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-09-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-09-01T00:00:00Z'};
 const token=Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
 if(signed)await context.addInitScript(session=>localStorage.setItem('sb-readiness-fixture-auth-token',JSON.stringify(session)),{access_token:token,refresh_token:'synthetic-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user});
 const application={id:rid,user_id:uid,status:'needs_information',revision:1,attachment_state:'not_requested',request_type:'Volunteer',created_at:'2026-09-10T00:00:00Z',updated_at:'2026-09-10T00:00:00Z',areas_of_interest:['Testing'],name:'Synthetic applicant',preferred_contact:'example.invalid only',message:'Full private application contents',skills_experience:'Synthetic accessibility experience'};
 const profile={id:user.id,username:'synthetic-commons',display_name:'Commons Name',bio:'Commons preserved biography',headline:'Commons preserved headline',featured_public_links:[{label:'Commons link',url:'https://example.invalid'}],is_admin:role==='admin',commons_onboarding_completed_at:'2026-09-01T00:00:00Z'};
 const market={user_id:user.id,username:'synthetic-market',display_name:'Marketplace Name',bio:'Marketplace private biography',interests:'Creator interests',website_url:'',github_url:'',organization:'',is_developer:false};
 const history=[{id:'f8400000-0000-4000-8000-000000000001',event_type:'work_with_request_information',to_status:'needs_information',note:'Please clarify your availability.',created_at:'2026-09-10T00:00:00Z'}],writes=[];
 const canRead=role==='member'||role==='reviewer';
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').at(-1),obj=req.headers().accept?.includes('vnd.pgrst.object');
  if(/\/api\/(billing|economic-preparation)(\/|$)|stripe\.com/.test(url.href)){forbidden.push(url.href);return route.abort();}
  if(url.origin===origin)return route.continue();
  if(url.origin!=='https://readiness-fixture.supabase.co')return route.fulfill({status:200,body:''});
  const ok=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const one=v=>ok(obj?v:v?[v]:[]);
  if(name==='user')return ok(signed?user:null);
  if(name==='profiles')return one(profile);
  if(name==='user_roles')return ok(roles.map(role=>({role,revoked_at:null})));
  if(name==='marketplace_account_profiles'){if(req.method()==='POST'){const b=req.postDataJSON();writes.push({name,body:b});Object.assign(market,b);}return one(market);}
  if(name==='current_user_can_review_domain')return ok(req.postDataJSON()?.p_domain==='work_with'?role==='reviewer':role==='steward');
  if(name==='current_user_economic_operator_overview')return ok({authorized:role==='operator',capabilities:role==='operator'?['economic_audit_view']:[],test_mode:true});
  if(name==='current_user_publisher_workspace')return ok({publishers:[],commonsDisplayName:profile.display_name,releaseReferences:[],listings:[]});
  if(name==='work_with_requests')return unavailable?ok({message:'Synthetic unavailable'},503):ok(canRead?[application]:[]);
  if(name==='work_with_request_files')return ok([]);
  if(name==='review_items')return one(canRead?{id:reviewId,domain:'work_with',source_table:'work_with_requests',source_id:rid,submitted_by:uid,status:application.status,title:'Synthetic Work With application',submitted_at:application.created_at,summary:'Private source-backed application'}:null);
  if(name==='review_events')return ok(canRead?history:[]);
  if(name==='submit_own_work_with_request'){const b=req.postDataJSON();writes.push({name,body:b});Object.assign(application,b.p_application,{id:b.p_request_id,status:'pending_review',attachment_state:b.p_attachment_expected?'pending':'not_requested'});return ok(b.p_request_id);}
  if(name==='work_with_request_command'){const b=req.postDataJSON();writes.push({name,body:b});assert.equal(b.p_revision,application.revision);application.revision++;application.status={respond:'pending_review',withdraw:'withdrawn',approve:'approved',decline:'rejected',close:'archived',request_information:'needs_information',begin_review:'in_review'}[b.p_action];history.push({id:crypto.randomUUID(),event_type:'work_with_'+b.p_action,to_status:application.status,note:b.p_note,created_at:new Date().toISOString()});return ok(true);}
  if(name==='stewardship_retention_workspace')return ok({items:role==='member'?[{requestId:rid,organization:'Synthetic independent charity',status:'approved',owner:true,revision:1,finalReviewAt:'2026-09-10T00:00:00Z',appealOpen:false,appealClosedAt:null,holdActive:false,holdReviewOverdue:false,deleteAfter:'2026-10-10T00:00:00Z',deletionState:'retained',deletedAt:null,proofAttached:true}]:[]});
  if(name==='stewardship_retention_command'){writes.push({name,body:req.postDataJSON()});return ok(true);}
  return ok(obj?null:[]);
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));activePage=page;
 return {context,page,writes,application,profile,market};
}
async function capture(f,name,locator){if(locator)await locator.scrollIntoViewIfNeeded();await f.page.waitForTimeout(180);const overflow=await f.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(overflow<=1,`${name} overflow ${overflow}`);await f.page.screenshot({path:path.join(output,name+'.png')});results.push({name,route:new URL(f.page.url()).pathname,overflow,screenshot:name+'.png'});}
try {
 for(const mobile of [false,true]){
  const s=mobile?'mobile':'desktop',f=await fixture('member',{mobile});
  await f.page.goto(origin+'/work-with-elysia-ecobotics');await f.page.getByRole('link',{name:'My Work With requests',exact:true}).first().waitFor();
  await f.page.getByLabel('Short message / why you want to help').fill('Synthetic work-with application; test fixture only.');
  await capture(f,`work-with-start-${s}`,f.page.getByRole('button',{name:'Submit for Work With review',exact:true}));
  await f.page.getByRole('button',{name:'Submit for Work With review',exact:true}).click();await f.page.getByText('Application submitted for Work With review.',{exact:false}).waitFor();
  assert.equal(f.writes[0].name,'submit_own_work_with_request');assert.equal(f.writes[0].body.p_application.status,undefined);
  await f.page.getByRole('link',{name:'My Work With requests',exact:true}).first().click();await f.page.getByRole('link',{name:'View application and follow-up'}).click();await f.page.getByText('Review and follow-up history',{exact:true}).waitFor();
  assert.equal(await f.page.getByRole('button',{name:'Approve',exact:true}).count(),0);await capture(f,`work-with-own-status-${s}`,f.page.getByRole('heading',{name:'Private CV / supporting documents'}));
  await f.page.getByRole('button',{name:'Withdraw application',exact:true}).click();await f.page.getByText('Status: withdrawn',{exact:false}).waitFor();assert.equal(f.writes.at(-1).body.p_action,'withdraw');
  await f.page.goto(origin+'/marketplace/account');await f.page.waitForFunction(()=>[...document.querySelectorAll('input')].some(e=>e.value==='synthetic-market'));await f.page.getByRole('textbox',{name:/^Bio/}).fill('Changed Marketplace biography only');await Promise.all([f.page.waitForResponse(r=>r.url().includes('/marketplace_account_profiles')&&r.request().method()==='POST'),f.page.getByRole('button',{name:'Update Marketplace Profile',exact:true}).click()]);assert.equal(f.market.bio,'Changed Marketplace biography only');assert.equal(f.profile.bio,'Commons preserved biography');assert.equal(f.profile.headline,'Commons preserved headline');const write=f.writes.find(w=>w.name==='marketplace_account_profiles');assert(write);assert(!('headline'in write.body));assert(!('featured_public_links'in write.body));await capture(f,`marketplace-profile-${s}`,f.page.getByRole('textbox',{name:/^Bio/}));
  await f.page.getByRole('link',{name:'Edit Commons identity, headline and featured links'}).click();await f.page.waitForURL(/setup\/profile/);await capture(f,`commons-profile-door-${s}`);
  await f.page.goto(origin+'/commons-circle/signals/requests-reviews#stewardship-proof');await f.page.getByText('Synthetic independent charity',{exact:true}).waitFor();await f.page.getByText('Appeal this review',{exact:true}).click();await f.page.getByLabel('Short explanation',{exact:true}).fill('Synthetic appeal; please reconsider.');const appeal=f.page.getByRole('button',{name:'Request appeal and pause deletion'});await appeal.focus();await Promise.all([f.page.waitForResponse(r=>r.url().endsWith('/stewardship_retention_command')),f.page.keyboard.press('Enter')]);assert.equal(f.writes.at(-1).body.p_action,'appeal');await capture(f,`stewardship-appeal-${s}`,f.page.getByRole('heading',{name:'My stewardship requests & proof'}));await f.context.close();
  const r=await fixture('reviewer',{mobile});await r.page.goto(origin+'/admin/review/work-with');await r.page.getByRole('heading',{name:'Private application',exact:true}).waitFor();await r.page.getByText('Full private application contents',{exact:true}).waitFor();await capture(r,`scoped-reviewer-private-detail-${s}`,r.page.getByRole('heading',{name:'Private application',exact:true}));await Promise.all([r.page.waitForResponse(x=>x.url().endsWith('/work_with_request_command')),r.page.getByRole('button',{name:'Approve',exact:true}).click()]);assert.equal(r.writes.at(-1).body.p_action,'approve');await r.context.close();
 }
 for(const role of ['visitor','member','admin','market','steward','operator']){
  const f=await fixture(role);await f.page.goto(origin+'/admin/review/work-with');await f.page.waitForTimeout(500);assert.equal(await f.page.getByText('Full private application contents',{exact:true}).count(),0);assert.equal(await f.page.getByRole('button',{name:'Approve',exact:true}).count(),0);await capture(f,`work-with-role-denied-${role}`);assert.equal(f.writes.length,0);await f.context.close();
 }
 const retry=await fixture('member',{unavailable:true});await retry.page.goto(origin+'/commons-circle/signals/work-with');await retry.page.getByText('Private applications could not be loaded. Reload to retry.',{exact:true}).waitFor();await capture(retry,'work-with-network-failure');await retry.context.close();
 const follow=await fixture('member');await follow.page.goto(origin+'/commons-circle/signals/work-with?request='+rid);await follow.page.getByLabel('Follow-up response').fill('Synthetic response to requested information.');await follow.page.getByRole('button',{name:'Send requested information'}).click();await follow.page.getByText('Status: pending review',{exact:false}).waitFor();assert.equal(follow.writes.at(-1).body.p_action,'respond');await capture(follow,'work-with-follow-up');await follow.context.close();
 for(const mobile of [false,true]){const f=await fixture('visitor',{mobile});for(const slug of ['job-post-fee-terms','marketplace-commerce-terms','privacy-policy','donation-recognition-terms','refund-and-cancellation-policy','community-guidelines']){await f.page.goto(origin+'/legal/'+slug);await f.page.getByText('2026-09-10-owner-decisions',{exact:false}).first().waitFor();await capture(f,`legal-${slug}-${mobile?'mobile':'desktop'}`);}await f.context.close();}
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({syntheticOnly:true,results,forbidden,errors,databaseProof:'Separate disposable PostgreSQL RLS tests'},null,2));console.log(`Owner decisions browser passed: ${results.length} views, applicant/reviewer lifecycle, scoped roles, privacy, desktop/mobile and keyboard; no provider requests.`);
} catch(error){if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(output,'failure.png')});await fs.writeFile(path.join(output,'failure.txt'),await activePage.locator('body').innerText());}throw error;} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
