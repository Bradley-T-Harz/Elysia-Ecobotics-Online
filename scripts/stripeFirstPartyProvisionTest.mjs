import assert from 'node:assert/strict';
import {provision} from './stripeFirstPartyProvision.mjs';
const products=new Map(),prices=[],portals=[],paths=[];const mode='test';
const config={mode,account:'acct_synthetic',apiVersion:'2025-02-24.acacia',secret:'sk_test_SYNTHETIC_ONLY_NEVER_REAL'};
const fetcher=async(input,init)=>{
 const url=new URL(input),f=new URLSearchParams(init.body);paths.push(url.pathname);
 if(url.pathname==='/v1/account')return Response.json({id:config.account});
 if(url.pathname.startsWith('/v1/products/'))return products.has(url.pathname.split('/').at(-1))?Response.json(products.get(url.pathname.split('/').at(-1))):new Response('',{status:404});
 if(url.pathname==='/v1/products'){const p={id:f.get('id'),active:true,livemode:false,metadata:{economic_product_key:f.get('metadata[economic_product_key]')}};products.set(p.id,p);return Response.json(p);}
 if(url.pathname==='/v1/prices'&&init.method==='GET')return Response.json({data:prices.filter(p=>p.lookup_key===url.searchParams.get('lookup_keys[]'))});
 if(url.pathname==='/v1/prices'){const p={id:`price_synthetic${prices.length}`,product:f.get('product'),lookup_key:f.get('lookup_key'),active:true,livemode:false,currency:f.get('currency'),unit_amount:Number(f.get('unit_amount')),recurring:{interval:'month',interval_count:1}};prices.push(p);return Response.json(p);}
 if(url.pathname==='/v1/billing_portal/configurations'&&init.method==='GET')return Response.json({data:portals,has_more:false});
 if(url.pathname==='/v1/billing_portal/configurations'){const p={id:'bpc_synthetic',active:true,livemode:false,metadata:{elysia_configuration:f.get('metadata[elysia_configuration]')},features:{subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false}}};portals.push(p);return Response.json(p);}
 throw new Error('Unexpected provider operation');
};
assert.equal((await provision({...config,fetcher})).dryRun,true);assert.equal(paths.length,0);
const first=await provision({...config,apply:true,fetcher});const second=await provision({...config,apply:true,fetcher});
assert.deepEqual(first,second);assert.equal(products.size,3);assert.equal(prices.length,5);assert.equal(portals.length,1);
assert(paths.every(p=>!/(accounts|transfers|payouts|payment_intents|checkout)/.test(p)));
await assert.rejects(provision({...config,secret:'sk_live_SYNTHETIC_ONLY_NEVER_REAL',apply:true,fetcher}),/mismatched/);
console.log('Catalog and cancellation provisioning: dry-run, idempotent retries, mode checks and no money/Connect operations passed.');
