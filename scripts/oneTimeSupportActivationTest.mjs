import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadConfigFromFile} from 'vite';
const config=JSON.parse(fs.readFileSync('wrangler.billing.production.jsonc','utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n'));
const on=['BILLING_ENABLED','BILLING_SUPPORT_CHECKOUT_ENABLED','BILLING_WEBHOOK_FULFILLMENT_ENABLED','BILLING_NOTIFICATION_RETRY_ENABLED','BILLING_TEST_REFUNDS_ENABLED','BILLING_EDGE_RATE_LIMIT_CONFIRMED','BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED','STRIPE_LIVE_ENABLED'];
assert.equal(config.vars.BILLING_MODE,'live');
for(const [k,v] of Object.entries(config.vars)) if(k.endsWith('_ENABLED')||k.endsWith('_CONFIRMED'))assert.equal(v,on.includes(k)?'true':'false',k);
assert.deepEqual(config.triggers.crons,['*/5 * * * *']);
const html=fs.readFileSync('index.html','utf8');
const original={...process.env};
try {
 process.env.ELYSIA_ISOLATED_TEST='1';
 for(const [mode,publish,url,sandbox,expected] of [
 ['production','live',config.vars.SUPABASE_URL,'','live'],
 ['production','',config.vars.SUPABASE_URL,'','disabled'],
 ['sandbox','live','https://kdtqyxlrkpmlpupzgmwv.supabase.co','sandbox','disabled'],
 ['development','live',config.vars.SUPABASE_URL,'','disabled'],
 ['production','live','https://kdtqyxlrkpmlpupzgmwv.supabase.co','','reject'],
 ['production','live',config.vars.SUPABASE_URL,'sandbox','reject']]) {
  Object.assign(process.env,{VITE_BILLING_API_PUBLICATION:publish,VITE_SUPABASE_URL:url,VITE_ELYSIA_ENVIRONMENT:sandbox});
  const {config:c}=await loadConfigFromFile({command:'build',mode},'vite.config.ts');
  const transform=c.plugins.find(p=>p.name==='production-billing-publication').transformIndexHtml;
  if(expected==='reject')assert.throws(()=>transform(html),/environment_mismatch/);
  else assert.ok(transform(html).includes(`name="elysia-billing-api-publication" content="${expected}"`));
 }
} finally {for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];Object.assign(process.env,original);}
console.log('One-time-only gates, processing schedule, explicit live publication and sandbox publication isolation passed.');
