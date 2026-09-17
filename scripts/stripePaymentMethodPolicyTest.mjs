import assert from 'node:assert/strict';
import {paymentMethodsFixture} from './fixtures/paymentMethodConfiguration.mjs';
import {assertPaymentMethodPolicy,desiredPaymentMethods,STRIPE_EXCLUDED_METHODS} from '../functions/api/billing/_shared/stripePaymentMethods.ts';
import {StripeProvider} from '../functions/api/billing/_shared/stripe.ts';
const config=paymentMethodsFixture();
assertPaymentMethodPolicy(config,'test');
const desired=desiredPaymentMethods(paymentMethodsFixture('test',true),'test');
assert.equal(desired.ideal,'on');assert.equal(desired.sepa_debit,'on');assert.equal(desired.giropay,'off');
assert.equal(desired.klarna,'off');assert.equal(desired.oxxo,'off');assert.equal(desired.crypto,undefined);
for(const method of [...STRIPE_EXCLUDED_METHODS,'future_unreviewed_method']) {
 const unsafe=structuredClone(config);unsafe[method]={available:true,display_preference:{value:'on',preference:'on'}};
 assert.throws(()=>assertPaymentMethodPolicy(unsafe,'test'),/policy_violation/);
}
for(const patch of [{livemode:true},{active:false},{parent:'pmc_connected'},{application:'ca_connected'},{is_default:true},{name:'Default'}]) {
 assert.throws(()=>assertPaymentMethodPolicy({...config,...patch},'test'));
}
const unavailable=structuredClone(config);unavailable.ideal.available=false;
assert.throws(()=>assertPaymentMethodPolicy(unavailable,'test'),/policy_violation/);
let calls=0;
const provider=new StripeProvider({},async()=>{calls++;throw new Error('No provider call should occur.');});
await assert.rejects(provider.createCheckout({flow:'support_one_time',amountMinor:500,currency:'usd'}),/payment_method_configuration_required/);
assert.equal(calls,0);
console.log('Dynamic payment methods: eligible non-card preferences, unavailable/BNPL/crypto/OXXO/future exclusions, own-account mode, default rejection and no missing-config fallback passed.');
