import assert from 'node:assert/strict';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const provider={provider:'stripe',scope:'first_party_account',reviewStatus:'passed',reviewedAt:'2026-09-15',mode:'live',webhookVerified:false,eventCoverageVerified:false,lastPreflightAt:null,thirdPartyStatus:'hard_off',lanes:[{key:'support_one_time',enabled:false,sandboxQualified:false,taxDecisionRecorded:false,taxBehavior:'disabled',legalQualified:false,rolloutAuthorized:false}]};
const runtime={mode:'disabled',testCredentialPresent:false,testWebhookSecretPresent:false,liveCredentialPresent:false,liveWebhookSecretPresent:false,economicServerConfigured:false,providerConfigured:false};
const compiled=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import Readiness from './src/shared/economics/FirstPartyProviderReadiness.tsx';createRoot(document.getElementById('root')).render(<Readiness/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-db',setup(b){b.onLoad({filter:/The-Elysia-Marketplace\/lib\/supabase\.ts$/},()=>({contents:`export const supabase={rpc:()=>({abortSignal:async()=>({data:${JSON.stringify(provider)},error:null})})};`,loader:'js'}));}}]});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?compiled.outputFiles[0].text:'<!doctype html><html><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();let unavailable=false;
 await page.route('**/api/billing/provider-readiness',route=>route.fulfill({status:unavailable?503:200,contentType:'application/json',body:JSON.stringify({runtime})}));
 await page.goto(origin);await page.getByText('Missing / Missing',{exact:true}).first().waitFor();
 assert.equal(await page.getByText('Missing / Missing',{exact:true}).count(),2);await page.getByText('Not recorded',{exact:true}).waitFor();await page.getByText('OFF',{exact:true}).waitFor();
 runtime.testCredentialPresent=true;await page.reload();await page.getByText('Present / Missing',{exact:true}).waitFor();assert.equal(await page.getByText('Missing / Missing',{exact:true}).count(),1);
 unavailable=true;await page.reload();await page.getByText('Runtime configuration is unknown until the billing endpoint responds.').waitFor();assert.equal(await page.getByText('Missing / Missing',{exact:true}).count(),0);
 console.log('Readiness browser: independent modes, missing/present/unknown distinction, last preflight and OFF lane passed.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
