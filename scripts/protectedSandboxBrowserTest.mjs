// Exercise the real built SPA and Access guard with synthetic signatures/data.
// Every browser request is intercepted locally. No provider acceptance occurs.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {chromium} from 'playwright';
import {handleSandboxUi} from '../services/sandbox-ui-worker/worker.ts';
const origin='https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev',database='https://kdtqyxlrkpmlpupzgmwv.supabase.co';
const team='https://synthetic-browser.cloudflareaccess.com',aud='b'.repeat(64),assetRoot=path.resolve('dist-sandbox');
const keys=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...keys.publicKey.export({format:'jwk'}),kid:'synthetic-browser',alg:'RS256',use:'sig'};
const segments=[{alg:'RS256',kid:jwk.kid},{iss:team,aud:[aud],exp:Math.floor(Date.now()/1000)+600}].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
const assertion=segments+'.'+sign('RSA-SHA256',Buffer.from(segments),keys.privateKey).toString('base64url');
const originalFetch=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(String(url),team+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const env={SANDBOX_UI_ORIGIN:origin,SUPABASE_URL:database,SANDBOX_ACCESS_TEAM_DOMAIN:team,SANDBOX_ACCESS_AUDIENCE:aud,
 ASSETS:{fetch:async request=>{
  let file=path.resolve(assetRoot,'.'+decodeURIComponent(new URL(request.url).pathname));assert(file.startsWith(assetRoot+'/')||file===assetRoot);
  try{if(!(await stat(file)).isFile())file=path.join(assetRoot,'index.html');}catch{file=path.join(assetRoot,'index.html');}
  return new Response(await readFile(file),{headers:{'content-type':mime[path.extname(file)]??'application/octet-stream'}});
 }},
 BILLING_SERVICE:{fetch:async()=>Response.json({ok:false,error:'billing_disabled'},{status:503})},
 IDENTITY_SERVICE:{fetch:async()=>Response.json({ok:false,error:'identity_misconfigured'},{status:503})}
};
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const requests=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push(url.origin);
  if(url.origin===origin){
   const response=await handleSandboxUi(new Request(request.url(),{method:request.method(),headers:{...request.headers(),'cf-access-jwt-assertion':assertion},body:request.postData()??undefined}),env);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  }
  if(url.origin===database){return route.fulfill({status:200,contentType:'application/json',body:'[]'});}
  // External styles/telemetry never leave this synthetic browser test.
  return route.fulfill({status:200,body:'',contentType:'text/css'});
 });
 for(const pathname of ['/','/developer-forge','/marketplace/creator-studio','/commons-circle','/support','/commons-circle/support-billing']){
  await page.goto(origin+pathname,{waitUntil:'networkidle'});
  await page.getByText('Sandbox · Synthetic data only · Payments disabled',{exact:true}).waitFor();
  assert((await page.locator('#root').innerText()).length>150);
  assert.equal(await page.locator('meta[name="elysia-billing-api-publication"]').getAttribute('content'),'disabled');
  assert.equal(new URL(page.url()).origin,origin);
 }
 assert(!requests.some(value=>value.includes('qwmcstyfegvpzjmjrylc')||value.includes('api.stripe.com')));
 assert.deepEqual(errors,[]);
 console.log('Protected sandbox browser: built homepage, Forge, Creator Studio, account, Support and billing routes render behind synthetic signed Access; no production data or Stripe requests.');
}finally{await browser.close();globalThis.fetch=originalFetch;}
