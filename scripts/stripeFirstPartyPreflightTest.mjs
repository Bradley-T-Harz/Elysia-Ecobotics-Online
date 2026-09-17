import assert from 'node:assert/strict';
import {preflight} from './stripeFirstPartyPreflight.mjs';
import {catalogPlan} from './stripeFirstPartyProvision.mjs';
import {STRIPE_ECONOMIC_MUTATION_EVENT_TYPES as events,STRIPE_FIRST_PARTY_WEBHOOK_URLS as urls} from '../functions/api/billing/_shared/stripeContract.ts';
const mode='test',account='acct_synthetic',publicOrigin='https://sandbox.example.com';
const refs={mode,account,dryRun:false,portalConfigurationId:'bpc_synthetic',rows:catalogPlan.map((row,i)=>({productKey:row.productKey,priceCode:row.priceCode,mode,providerProductReference:`prod_elysiatest${row.productKey.replaceAll('_','')}20260915`,providerPriceReference:row.priceCode?`price_synthetic${i}`:null}))};
const objects=new Map();
objects.set('/v1/account',{id:account,charges_enabled:true,payouts_enabled:true,details_submitted:true});
objects.set('/v1/webhook_endpoints',{has_more:false,data:[{id:'we_synthetic',url:urls.test,status:'enabled',livemode:false,api_version:'2025-02-24.acacia',enabled_events:[...events]}]});
for(const [i,row] of catalogPlan.entries()){
 const ref=refs.rows[i];objects.set(`/v1/products/${ref.providerProductReference}`,{id:ref.providerProductReference,active:true,livemode:false,metadata:{economic_product_key:row.productKey,economic_environment:mode}});
 if(row.priceCode)objects.set(`/v1/prices/${ref.providerPriceReference}`,{id:ref.providerPriceReference,active:true,livemode:false,product:ref.providerProductReference,currency:'usd',unit_amount:row.amount,recurring:{interval:'month',interval_count:1}});
}
objects.set('/v1/billing_portal/configurations/bpc_synthetic',{active:true,livemode:false,default_return_url:publicOrigin+'/commons-circle/support-billing',business_profile:{privacy_policy_url:'https://elysiaecobotics.com/legal/privacy-policy',terms_of_service_url:'https://elysiaecobotics.com/legal/support-and-billing-terms'},features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'},subscription_update:{enabled:false}}});
let requests=0;
const fetcher=async(url,init)=>{requests++;assert.equal(init.method,'GET');assert.equal(init.body,undefined);return Response.json(objects.get(new URL(url).pathname));};
const config={mode,account,apiVersion:'2025-02-24.acacia',publicOrigin,secret:'rk_test_SYNTHETIC_ONLY_NEVER_REAL',references:refs,fetcher};
assert.equal((await preflight(config)).dryRun,true);assert.equal(requests,0);
const result=await preflight({...config,check:true});assert.equal(result.configurationChecksPassed,true);assert.equal(result.paymentAcceptance,'NOT_RUN');assert.deepEqual(result.enabledLanes,[]);assert(!JSON.stringify(result).includes(config.secret));
for(const [path,change,error] of [
 ['/v1/account',o=>{o.id='acct_other'},/account_mismatch/],
 ['/v1/webhook_endpoints',o=>{o.data[0].enabled_events=['*']},/webhook_contract/],
 ['/v1/webhook_endpoints',o=>{o.data[0].api_version='2026-01-01.invalid'},/webhook_contract/],
 ['/v1/webhook_endpoints',o=>{o.data[0].url=urls.live},/one_webhook/],
 ['/v1/webhook_endpoints',o=>{o.data.push({...o.data[0]})},/one_webhook/],
 ['/v1/prices/price_synthetic1',o=>{o.livemode=true},/mode_mismatch/],
 ['/v1/prices/price_synthetic1',o=>{o.unit_amount=101},/price_mismatch/],
 ['/v1/billing_portal/configurations/bpc_synthetic',o=>{o.features.subscription_cancel.proration_behavior='create_prorations'},/cancellation_policy|cancellation policy/]
]){const saved=structuredClone(objects.get(path));change(objects.get(path));await assert.rejects(preflight({...config,check:true}),error);objects.set(path,saved);}
await assert.rejects(preflight({...config,secret:'rk_live_SYNTHETIC_ONLY_NEVER_REAL',check:true}),/credential_required/);
console.log('Read-only Stripe preflight: exact account/mode/events/version, catalog arithmetic, Portal policy, dry run and no gate changes passed.');
