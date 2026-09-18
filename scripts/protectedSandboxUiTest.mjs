// Local cryptographic and routing tests only; never calls Stripe/Supabase.
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {handleSandboxUi} from '../services/sandbox-ui-worker/worker.ts';
import {sandboxAccessAllowed} from '../services/sandbox-ui-worker/access.ts';
import billingWorker from '../services/billing-worker/worker.ts';
import {clearAccessJwksCacheForTests} from '../services/sandbox-runner/accessValidator.mjs';
const origin='https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev';
const database='https://kdtqyxlrkpmlpupzgmwv.supabase.co',team='https://synthetic-team.cloudflareaccess.com',audience='a'.repeat(64);
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-key',alg:'RS256',use:'sig'};
const originalFetch=globalThis.fetch;let assetReads=0,billingCalls=0,identityCalls=0,lastWebhook;
const originalLog=console.log,logs=[];
console.log=(...args)=>logs.push(args);
globalThis.fetch=async url=>{assert.equal(String(url),team+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
const token=claims=>{
 const head=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:team,aud:[audience],exp:Math.floor(Date.now()/1000)+60,iat:Math.floor(Date.now()/1000),...claims})).toString('base64url');
 return `${head}.${body}.${sign('RSA-SHA256',Buffer.from(`${head}.${body}`),privateKey).toString('base64url')}`;
};
const env={SANDBOX_UI_ORIGIN:origin,SUPABASE_URL:database,SANDBOX_ACCESS_TEAM_DOMAIN:team,SANDBOX_ACCESS_AUDIENCE:audience,
 ASSETS:{fetch:async()=>{assetReads++;return new Response('synthetic private UI',{headers:{'content-type':'text/html','cache-control':'public,max-age=31536000'}});}},
 BILLING_SERVICE:{fetch:async request=>{billingCalls++;lastWebhook={body:await request.text(),signature:request.headers.get('stripe-signature')};return Response.json({ok:false,error:'billing_disabled'},{status:503});}},
 IDENTITY_SERVICE:{fetch:async request=>{identityCalls++;assert.equal(new URL(request.url).hostname,'identity-service.internal');assert.equal(request.headers.get('cookie'),null);return Response.json({ok:true});}}
};
try {
 for(const path of ['/','/assets/app.js','/index.html','/robots.txt','/commons-circle','/support/thank-you','/api/billing/provider-readiness','/api/billing/webhook/extra']){
  assert.equal((await handleSandboxUi(new Request(origin+path),env)).status,403);
  assert.equal((await handleSandboxUi(new Request(origin+path,{headers:{'cf-access-jwt-assertion':'forged','cf-access-authenticated-user-email':'bradley@example.invalid',cookie:'SENSITIVE_COOKIE_CANARY',authorization:'SENSITIVE_AUTHORIZATION_CANARY'}}),env)).status,403);
 }
 assert.equal(assetReads,0);assert.equal(billingCalls,0);
 for(const claims of [{aud:['b'.repeat(64)]},{iss:'https://attacker.invalid'},{exp:0},{nbf:Math.floor(Date.now()/1000)+999}]){
  assert.equal(await sandboxAccessAllowed(new Request(origin,{headers:{'cf-access-jwt-assertion':token(claims)}}),env),false);
 }
 const headers={'cf-access-jwt-assertion':token({})};
 assert.equal((await handleSandboxUi(new Request(origin,{headers}),{...env,SANDBOX_ACCESS_AUDIENCE:''})).status,403);
 assert.equal((await handleSandboxUi(new Request(origin,{headers}),{...env,SUPABASE_URL:'https://production.invalid'})).status,403);
 assert.equal((await handleSandboxUi(new Request('https://other.invalid/',{headers}),env)).status,403);
 const allowed=await handleSandboxUi(new Request(origin+'/developer-forge',{headers}),env);
 assert.equal(allowed.status,200);assert.match(allowed.headers.get('cache-control'),/no-store/);assert.match(allowed.headers.get('x-robots-tag'),/noindex/);
 assert(!allowed.headers.get('content-security-policy').includes('*.supabase.co'));
 assert.equal((await handleSandboxUi(new Request(origin+'/api/identity/v1/bootstrap',{headers}),env)).status,200);assert.equal(identityCalls,1);
 const raw='{"synthetic": "unchanged bytes"}';
 assert.equal((await handleSandboxUi(new Request(origin+'/api/billing/webhook',{method:'POST',headers:{'stripe-signature':'synthetic-signature'},body:raw}),env)).status,503);
 assert.deepEqual(lastWebhook,{body:raw,signature:'synthetic-signature'});
 for(const path of ['/api/billing/webhook/','/api/billing/webhook/extra','/api/billing/webhook?bypass=1','/api/billing/%77ebhook']){
  assert.equal((await handleSandboxUi(new Request(origin+path,{method:'POST',body:raw}),env)).status,403);
 }
 const backend={BILLING_SANDBOX_ACCESS_REQUIRED:'true',BILLING_MODE:'disabled',SUPABASE_URL:database,SANDBOX_ACCESS_TEAM_DOMAIN:team,SANDBOX_ACCESS_AUDIENCE:audience};
 assert.equal((await billingWorker.fetch(new Request('https://billing.invalid/api/billing/capabilities'),backend)).status,403);
 assert.equal((await billingWorker.fetch(new Request('https://billing.invalid/api/billing/capabilities',{headers}),backend)).status,200);
 assert.equal((await billingWorker.fetch(new Request('https://billing.invalid/api/billing/webhook',{method:'POST',body:'{}'}),backend)).status,503);
 clearAccessJwksCacheForTests();
 globalThis.fetch=async()=>{throw new Error('SENSITIVE_EXCEPTION_CANARY');};
 const unavailable=await handleSandboxUi(new Request(origin,{headers}),env);
 assert.equal(unavailable.status,403);
 assert.equal(await unavailable.text(),'Sandbox authentication is required. Access setup may still be pending.');
 assert.deepEqual(logs,[], 'Access success and failure paths must not emit temporary diagnostics');
 const serialized=JSON.stringify(logs);
 assert(!serialized.includes('SENSITIVE_'));assert(!serialized.includes('bradley@example.invalid'));assert(!serialized.includes(headers['cf-access-jwt-assertion']));assert(!serialized.includes(jwk.n));
 originalLog('Protected sandbox: Access verification, generic denial, no Access diagnostic logging, webhook exemption and closed billing gates passed.');
} finally {globalThis.fetch=originalFetch;console.log=originalLog;clearAccessJwksCacheForTests();}
