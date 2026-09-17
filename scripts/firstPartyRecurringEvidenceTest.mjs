// Synthetic signed provider fixtures; no actual Stripe acceptance is claimed.
import assert from 'node:assert/strict';
import {StripeProvider} from '../functions/api/billing/_shared/stripe.ts';
import {runtimeReadiness,onRequest} from '../functions/api/billing/provider-readiness.ts';
const env={BILLING_MODE:'test',BILLING_STAGING_ACCESS_CONFIRMED:'true',BILLING_EDGE_RATE_LIMIT_CONFIRMED:'true',STRIPE_ACCOUNT_ID:'acct_synthetic',STRIPE_SECRET_KEY_TEST:'rk_test_SYNTHETIC_ONLY_NEVER_REAL',STRIPE_WEBHOOK_SECRET_TEST:'whsec_SYNTHETIC_ONLY_NEVER_REAL',STRIPE_API_VERSION:'2025-02-24.acacia',STRIPE_WEBHOOK_API_VERSION:'2025-02-24.acacia'};
const now=1800000000000,orderId='22222222-2222-4222-8222-222222222222';
let metadata={};
const fetcher=async url=>Response.json(new URL(url).pathname==='/v1/account'?{id:env.STRIPE_ACCOUNT_ID}:{id:'pi_synthetic',livemode:false,status:'succeeded',currency:'usd',amount_received:500,metadata,latest_charge:{receipt_url:'https://pay.stripe.com/receipts/synthetic',balance_transaction:{id:'txn_synthetic',currency:'usd',amount:500,fee:45,net:455}}});
const provider=new StripeProvider(env,fetcher,()=>now);
async function signed(type,object){
 const body=JSON.stringify({id:'evt_synthetic',type,created:now/1000,livemode:false,api_version:env.STRIPE_API_VERSION,data:{object}});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET_TEST),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${now/1000}.${body}`))).toString('hex');
 return provider.verifyAndNormalizeWebhook(body,`t=${now/1000},v1=${sig}`);
}
const pi=await signed('payment_intent.succeeded',{id:'pi_synthetic',object:'payment_intent',amount_received:500,amount:500,currency:'usd',metadata:{}});
assert.equal(pi.orderId,null);assert.equal(pi.providerPaymentId,'pi_synthetic');
assert.equal((await provider.enrichVerifiedEvent(pi)).processorFeeMinor,45);
const session=await signed('checkout.session.completed',{id:'cs_test_synthetic',object:'checkout.session',amount_total:500,currency:'usd',payment_status:'paid',payment_intent:'pi_synthetic',subscription:'sub_synthetic',metadata:{economic_order_id:orderId}});
assert.equal((await provider.enrichVerifiedEvent(session)).netAmountMinor,455);
const invoice=await signed('invoice.paid',{id:'in_synthetic',object:'invoice',amount_paid:500,currency:'usd',payment_intent:'pi_synthetic',subscription:'sub_synthetic',subscription_details:{metadata:{economic_order_id:orderId}}});
assert.equal((await provider.enrichVerifiedEvent(invoice)).processorFeeMinor,45);
await assert.rejects(provider.enrichVerifiedEvent({...session,providerSubscriptionId:null}),/evidence_mismatch/);
metadata={economic_order_id:'33333333-3333-4333-8333-333333333333'};
for(const event of [session,invoice])await assert.rejects(provider.enrichVerifiedEvent(event),/evidence_mismatch/);
metadata={economic_order_id:orderId};assert.equal((await provider.enrichVerifiedEvent({...session,providerSubscriptionId:null})).processorFeeMinor,45);
const status=runtimeReadiness({...env,BILLING_MODE:'disabled'});
assert.equal(status.credentialPresent,false);assert.equal(status.testCredentialPresent,true);assert.equal(status.liveCredentialPresent,false);assert.equal(status.thirdPartyMoney,false);
assert(!JSON.stringify(status).includes(env.STRIPE_SECRET_KEY_TEST));
const missing=await onRequest({request:new Request('https://example.invalid/api/billing/provider-readiness'),env:{}});
const result=await missing.json();assert.equal(result.ok,false);assert.equal(result.runtime.economicServerConfigured,false);assert.equal(result.runtime.mode,'disabled');
console.log('Recurring metadata, settlement evidence, conflicting ownership rejection and presence-only readiness passed.');
