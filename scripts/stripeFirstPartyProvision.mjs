// Dry-run by default. Secrets are read only from the secure execution environment.
// No Connect, seller, hardware or paid-compute object can be provisioned here.
import { pathToFileURL } from 'node:url';
export const catalogPlan = Object.freeze([
 {productKey:'support_one_time',name:'Support Elysia Ecobotics',priceCode:null,amount:null},
 ...[[100,'seed'],[500,'commons'],[1200,'infrastructure'],[2500,'sandbox'],[5000,'50']].map(([amount,tier])=>({productKey:'support_recurring',name:'Monthly Support for Elysia Ecobotics',priceCode:`support_monthly_${tier}_usd`,amount})),
 {productKey:'job_post_fee',name:'EcoSyneva commercial Job Post fee',priceCode:null,amount:null}
]);
const description='EcoSyneva first-party payment. No governance, status, priority, personal compute entitlement, endorsement or publication is purchased.';
export async function provision({mode,account,apiVersion,secret,apply=false,fetcher=fetch}) {
 if(!['test','live'].includes(mode)||!/^acct_[A-Za-z0-9]+$/.test(account??'')||!/^\d{4}-\d{2}-\d{2}[.]\w+$/.test(apiVersion??''))throw new Error('Exact mode, account and pinned API version required.');
 if(!apply)return {dryRun:true,mode,account,catalog:catalogPlan,forbiddenObjects:[],createsWebhookSecret:false};
 if(!new RegExp(`^(sk|rk)_${mode}_`).test(secret??''))throw new Error('Selected environment credential missing or mismatched.');
 async function request(path,method='GET',fields={},idempotency) {
  const headers={authorization:`Bearer ${secret}`,'stripe-version':apiVersion};
  if(method==='POST'){headers['content-type']='application/x-www-form-urlencoded';headers['idempotency-key']=idempotency;}
  const response=await fetcher(`https://api.stripe.com${path}`,{method,headers,body:method==='POST'?new URLSearchParams(fields):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`Provider request failed (${response.status}); no response body retained.`);
  const data=await response.json();if(typeof data.livemode==='boolean'&&data.livemode!==(mode==='live'))throw new Error('Provider environment mismatch.');return data;
 }
 if((await request('/v1/account'))?.id!==account)throw new Error('Provider account mismatch.');
 const rows=[];
 for(const plan of catalogPlan){
  const productId=`prod_elysia${mode}${plan.productKey.replaceAll("_", "")}20260915`;
  let product=await request(`/v1/products/${productId}`);
  if(!product)product=await request('/v1/products','POST',{id:productId,name:plan.name,description,'metadata[economic_product_key]':plan.productKey,'metadata[economic_environment]':mode},`elysia:${mode}:product:${plan.productKey}:20260915`);
  if(product?.id!==productId||product.active!==true||product.livemode!==(mode==='live')||product.metadata?.economic_product_key!==plan.productKey)throw new Error('Existing product conflicts with approved plan.');
  let priceId=null;
  if(plan.priceCode){
   const lookup=`elysia_${mode}_${plan.priceCode}_20260915`;
   const prices=await request(`/v1/prices?lookup_keys[]=${encodeURIComponent(lookup)}&limit=2`);
   if(prices?.data?.length>1)throw new Error('Ambiguous price lookup.');
   let price=prices?.data?.[0];
   if(!price)price=await request('/v1/prices','POST',{product:productId,currency:'usd',unit_amount:String(plan.amount),'recurring[interval]':'month',lookup_key:lookup,'metadata[economic_price_code]':plan.priceCode},`elysia:${mode}:price:${plan.priceCode}:20260915`);
   if(price.active!==true||price.livemode!==(mode==='live')||price.product!==productId||price.unit_amount!==plan.amount||price.currency!=='usd'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)throw new Error('Existing price conflicts with approved plan.');
   priceId=price.id;
  }
  rows.push({productKey:plan.productKey,priceCode:plan.priceCode,providerProductReference:productId,providerPriceReference:priceId,mode});
 }
 return {dryRun:false,mode,account,rows,enabledLanes:[],note:'References require recording in the matching economic database. No feature switch was changed.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.env.BILLING_MODE;const apply=process.argv.includes('--apply');
 const secret=mode==='live'?process.env.STRIPE_SECRET_KEY_LIVE:process.env.STRIPE_SECRET_KEY_TEST;
 try{console.log(JSON.stringify(await provision({mode,account:process.env.STRIPE_ACCOUNT_ID,apiVersion:process.env.STRIPE_API_VERSION,secret,apply}),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
