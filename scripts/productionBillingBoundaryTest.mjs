// Synthetic configuration checks only. No provider calls or credentials.
import assert from 'node:assert/strict';
import {economicServerClientConfigured,createEconomicServerClient} from '../functions/api/billing/_shared/auth.ts';
import {stripeConfig} from '../functions/api/billing/_shared/config.ts';
const production='https://qwmcstyfegvpzjmjrylc.supabase.co',sandbox='https://kdtqyxlrkpmlpupzgmwv.supabase.co';
const db={BILLING_MODE:'live',BILLING_PUBLIC_ORIGIN:'https://elysiaecobotics.com',SUPABASE_URL:production,SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_ONLY_NEVER_REAL'};
assert(economicServerClientConfigured(db));
for(const patch of [{SUPABASE_URL:sandbox},{SUPABASE_URL:'https://other.supabase.co'},{BILLING_MODE:'test'},{SUPABASE_SERVICE_ROLE_KEY:undefined}]){
 assert.equal(economicServerClientConfigured({...db,...patch}),false);
 assert.throws(()=>createEconomicServerClient({...db,...patch}));
}
const live={BILLING_MODE:'live',STRIPE_LIVE_ENABLED:'true',BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED:'true',BILLING_EDGE_RATE_LIMIT_CONFIRMED:'true',BILLING_PUBLIC_ORIGIN:'https://elysiaecobotics.com',STRIPE_ACCOUNT_ID:'acct_synthetic',STRIPE_API_VERSION:'2025-02-24.acacia',STRIPE_WEBHOOK_API_VERSION:'2025-02-24.acacia',STRIPE_SECRET_KEY_TEST:'rk_test_SYNTHETIC_ONLY_NEVER_REAL',STRIPE_WEBHOOK_SECRET_TEST:'whsec_SYNTHETIC_ONLY_NEVER_REAL'};
assert.throws(()=>stripeConfig(live),'live must never fall back to test bindings');
assert.throws(()=>stripeConfig({...live,STRIPE_SECRET_KEY_LIVE:live.STRIPE_SECRET_KEY_TEST,STRIPE_WEBHOOK_SECRET_LIVE:live.STRIPE_WEBHOOK_SECRET_TEST}));
assert.throws(()=>stripeConfig({...live,STRIPE_LIVE_ENABLED:'false'}));
console.log('Production database/mode pinning, missing backend binding, no test fallback, and live kill switch passed.');
