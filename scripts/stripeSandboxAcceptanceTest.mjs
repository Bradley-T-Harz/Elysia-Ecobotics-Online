import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const bundle = await build({entryPoints:['services/billing-worker/sandboxAcceptance.ts'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{name:'worker-base-fixture',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'worker-base',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export class WorkerEntrypoint { constructor(ctx,env){this.env=env;} }'}));}}]});
const {SandboxAcceptance,assertAcceptanceSandbox}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const env={SUPABASE_URL:'https://kdtqyxlrkpmlpupzgmwv.supabase.co',STRIPE_ACCOUNT_ID:'acct_1UGdHORrIWWoUVPh',BILLING_PUBLIC_ORIGIN:'https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev',BILLING_MODE:'disabled',STRIPE_API_VERSION:'2025-02-24.acacia',STRIPE_SECRET_KEY_TEST:'rk_test_SYNTHETIC_NEVER_REAL'};
assert.doesNotThrow(()=>assertAcceptanceSandbox(env));
for(const patch of [{BILLING_MODE:'live'},{SUPABASE_URL:'https://production.example.invalid'},{STRIPE_ACCOUNT_ID:'acct_other'},{STRIPE_SECRET_KEY_LIVE:'SYNTHETIC'},{STRIPE_CONNECT_ENABLED:'true'},{BILLING_MARKETPLACE_COMMERCE_ENABLED:'true'},{BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED:'true'},{BILLING_SANDBOX_PURCHASES_ENABLED:'true'},{STRIPE_SECRET_KEY_TEST:'sk_test_SYNTHETIC'}]) assert.throws(()=>assertAcceptanceSandbox({...env,...patch}));
const previous=globalThis.fetch;
try {
 globalThis.fetch=async()=>{throw new Error('SYNTHETIC_SENSITIVE_EXCEPTION_DO_NOT_RETURN');};
 const failure=await new SandboxAcceptance({},env).inspect();
 assert(!JSON.stringify(failure).includes('SENSITIVE'));
 assert.equal(failure.account,'fetch_unavailable');
 let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({id:'acct_wrong'});};
 const wrong=await new SandboxAcceptance({},env).inspect();assert.equal(wrong.account,'mismatch');assert.equal(calls,1);
 globalThis.fetch=async()=>new Response('SYNTHETIC_PRIVATE_BODY',{status:403});
 const denied=await new SandboxAcceptance({},env).inspect();assert.equal(denied.account,'http_403');assert(!JSON.stringify(denied).includes('PRIVATE'));
 globalThis.fetch=async()=>Response.json({id:env.STRIPE_ACCOUNT_ID,livemode:true});
 assert.equal((await new SandboxAcceptance({},env).inspect()).account,'mode_mismatch');
 assert.deepEqual(await new SandboxAcceptance({},{...env,BILLING_MODE:'live'}).inspect(),{scope:'invalid'});
} finally {globalThis.fetch=previous;}
const {default:driver}=await import('./stripe-sandbox-acceptance/driver.mjs');
for(const request of [new Request('http://external.invalid/inspect',{method:'POST'}),new Request('http://127.0.0.1/inspect',{method:'POST',headers:{origin:'https://evil.invalid'}}),new Request('http://127.0.0.1/inspect')])assert.equal((await driver.fetch(request,{})).status,404);
assert(!(await readFile('services/billing-worker/worker.ts','utf8')).includes('sandboxAcceptance'));
console.log('Sandbox acceptance private boundary, exact environment, safe failures, and loopback origin guards passed.');
