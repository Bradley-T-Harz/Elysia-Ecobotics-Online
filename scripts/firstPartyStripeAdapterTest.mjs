// Synthetic in-process provider fixtures. This is not Stripe sandbox/live acceptance.
import assert from 'node:assert/strict';
import {StripeProvider} from '../functions/api/billing/_shared/stripe.ts';
import {assertBillingMode,stripeConfig,assertBillingFeatureEnabled} from '../functions/api/billing/_shared/config.ts';
import {handleStripeWebhook} from '../functions/api/billing/webhook.ts';
const env={BILLING_MODE:'live',STRIPE_LIVE_ENABLED:'true',BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED:'true',BILLING_EDGE_RATE_LIMIT_CONFIRMED:'true',BILLING_PUBLIC_ORIGIN:'https://elysiaecobotics.com',STRIPE_ACCOUNT_ID:'acct_synthetic',STRIPE_SECRET_KEY_LIVE:'sk_live_SYNTHETIC_ONLY_NEVER_REAL',STRIPE_WEBHOOK_SECRET_LIVE:'whsec_SYNTHETIC_ONLY_NEVER_REAL',STRIPE_API_VERSION:'2025-02-24.acacia',STRIPE_WEBHOOK_API_VERSION:'2025-02-24.acacia',BILLING_WEBHOOK_FULFILLMENT_ENABLED:'true'};
const now=1800000000000,calls=[];let responseMode=true;
const fetcher=async(input,init)=>{
 const url=new URL(input);const body=new URLSearchParams(init.body);calls.push({path:url.pathname,body:body.toString(),idempotency:new Headers(init.headers).get('idempotency-key')});
 const data=url.pathname==='/v1/account'?{id:'acct_synthetic'}:url.pathname==='/v1/prices/price_synthetic'?{id:'price_synthetic',active:true,livemode:responseMode,unit_amount:500,currency:'usd',recurring:{interval:'month',interval_count:1}}:{id:'cs_live_synthetic',livemode:responseMode,url:'https://checkout.stripe.com/c/pay/synthetic',customer:null};
 return Response.json(data);
};
const provider=new StripeProvider(env,fetcher,()=>now);
const input={orderId:'22222222-2222-4222-8222-222222222222',publicReference:'opaque_order_reference_synthetic',idempotencyKey:'checkout:11111111-1111-4111-8111-111111111111',amountMinor:500,currency:'usd',providerProductReference:'prod_synthetic',providerPriceReference:null,providerCustomerReference:null,flow:'support_one_time',accountLinked:false,successUrl:'https://elysiaecobotics.com/support/thank-you',cancelUrl:'https://elysiaecobotics.com/support',checkoutExpiresAt:new Date(now+40*60000).toISOString()};
for(const flow of ['support_one_time','job_post_fee','organization_service','sponsorship']) {
 await provider.createCheckout({...input,flow});const first=calls.at(-1);await provider.createCheckout({...input,flow});assert.deepEqual(calls.at(-1),first);
 assert.equal(new URLSearchParams(first.body).get('line_items[0][price_data][unit_amount]'),'500');
}
await provider.createCheckout({...input,flow:'support_recurring',providerPriceReference:'price_synthetic'});
assert.equal(new URLSearchParams(calls.at(-1).body).get('line_items[0][price]'),'price_synthetic');
responseMode=false;await assert.rejects(provider.createCheckout(input),/provider_environment_mismatch/);
assert.throws(()=>stripeConfig({...env,STRIPE_SECRET_KEY_LIVE:undefined,STRIPE_SECRET_KEY_TEST:'sk_test_SYNTHETIC_ONLY_NEVER_REAL'}));
assert.throws(()=>assertBillingMode({...env,STRIPE_CONNECT_ENABLED:'true'}));
assert.throws(()=>assertBillingFeatureEnabled({...env,BILLING_MARKETPLACE_COMMERCE_ENABLED:'true'},'BILLING_MARKETPLACE_COMMERCE_ENABLED','off'),/third_party_money_hard_off/);
assert.throws(()=>assertBillingMode({...env,BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED:'false'}));
const order=[];
const request=()=>new Request('https://elysiaecobotics.com/api/billing/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':'synthetic'},body:'{}'});
const event={orderId:input.orderId,eventType:'payment_intent.succeeded'};
const deps={provider:()=>({verifyAndNormalizeWebhook:async()=>{order.push('verified');return event;},enrichVerifiedEvent:async e=>{order.push('fetch-settlement');return {...e,processorFeeMinor:35};}}),process:async()=>{order.push('durable-inbox');return order.filter(v=>v==='durable-inbox').length===1?'processed':'duplicate';},logger:()=>{}};
assert.equal((await handleStripeWebhook(request(),env,deps)).status,200);
assert.deepEqual(order,['verified','durable-inbox','fetch-settlement','durable-inbox']);
console.log('First-party adapter: stable outbound retries, authoritative amounts, all five lanes, environment isolation, immutable hard-off, durable-before-enrichment passed.');
