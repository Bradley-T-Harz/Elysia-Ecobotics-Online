// Dry-run by default. Secrets are read only from the secure execution environment.
// No Connect, seller, hardware or paid-compute object can be provisioned here.
import { pathToFileURL } from 'node:url';
import {createHash} from 'node:crypto';
import {readBoundedResponseJson} from '../functions/api/billing/_shared/http.ts';
import {STRIPE_FIRST_PARTY_API_VERSION} from '../functions/api/billing/_shared/stripeContract.ts';
import {paymentMethodConfigurationName,desiredPaymentMethods,assertPaymentMethodPolicy,STRIPE_EXCLUDED_METHODS} from '../functions/api/billing/_shared/stripePaymentMethods.ts';
export const catalogPlan = Object.freeze([
 {productKey:'support_one_time',name:'Support Elysia Ecobotics',priceCode:null,amount:null},
 ...[[100,'seed'],[500,'commons'],[1200,'infrastructure'],[2500,'sandbox'],[5000,'50']].map(([amount,tier])=>({productKey:'support_recurring',name:'Monthly Support for Elysia Ecobotics',priceCode:`support_monthly_${tier}_usd`,amount})),
 {productKey:'job_post_fee',name:'EcoSyneva commercial Job Post fee',priceCode:null,amount:null}
]);
const description='EcoSyneva first-party payment. No governance, status, priority, personal compute entitlement, endorsement or publication is purchased.';
export function validatedProvisionOrigin(mode, origin) {
 let url;try{url=new URL(origin);}catch{throw new Error('Exact public return origin required.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||url.hostname.endsWith('.invalid')
   || (mode==='live' ? url.origin!=='https://elysiaecobotics.com' : ['elysiaecobotics.com','www.elysiaecobotics.com'].includes(url.hostname)))throw new Error('Return origin does not match selected environment.');
 return url.origin;
}
export function assertPortalPolicy(portal, mode, publicOrigin) {
 if(!portal?.active||portal.livemode!==(mode==='live')||portal.features?.subscription_cancel?.enabled!==true
  ||portal.features.subscription_cancel.mode!=='at_period_end'||portal.features.subscription_cancel.proration_behavior!=='none'
  ||portal.features.subscription_update?.enabled!==false||portal.features.invoice_history?.enabled!==true
  ||portal.features.payment_method_update?.enabled!==true||portal.default_return_url!==`${publicOrigin}/commons-circle/support-billing`
  ||portal.business_profile?.privacy_policy_url!=='https://elysiaecobotics.com/legal/privacy-policy'
  ||portal.business_profile?.terms_of_service_url!=='https://elysiaecobotics.com/legal/support-and-billing-terms')throw new Error('Portal configuration does not match the approved cancellation policy.');
}
export async function provisionPaymentMethods(request, mode) {
 const configurations=[];let cursor='';
 for(let page=0;page<10;page++){
  const listing=await request(`/v1/payment_method_configurations?limit=100${cursor?'&starting_after='+encodeURIComponent(cursor):''}`);
  if(!Array.isArray(listing?.data))throw new Error('Payment method configuration list invalid.');
  configurations.push(...listing.data);
  if(!listing.has_more)break;
  if(page===9||!listing.data.at(-1)?.id)throw new Error('Payment method configuration search exceeded safe page limit.');
  cursor=listing.data.at(-1).id;
 }
 const defaults=configurations.filter(c=>c.is_default===true&&c.parent==null&&c.application==null);
 if(defaults.length!==1)throw new Error('Exactly one own-account default payment method configuration required.');
 const preferences=desiredPaymentMethods(defaults[0],mode),name=paymentMethodConfigurationName(mode);
 const matches=configurations.filter(c=>c.name===name);
 if(matches.length>1)throw new Error('Ambiguous managed payment method configuration.');
 let configuration=matches[0];
 if(configuration&&(configuration.parent!=null||configuration.application!=null||configuration.is_default!==false||configuration.livemode!==(mode==='live')||configuration.active!==true))throw new Error('Managed payment method scope conflicts with approved plan.');
 let matchesPlan=false;
 if(configuration){try{assertPaymentMethodPolicy(configuration,mode,preferences);matchesPlan=true;}catch{/* Reconcile this dedicated configuration only. */}}
 if(!matchesPlan){
  const fields={name};
  for(const [method,preference] of Object.entries(preferences))fields[`${method}[display_preference][preference]`]=preference;
  const hash=createHash('sha256').update(JSON.stringify(Object.entries(preferences).sort())).digest('hex').slice(0,24);
  configuration=await request(`/v1/payment_method_configurations${configuration?'/'+configuration.id:''}`,'POST',fields,`elysia:${mode}:pmc:${configuration?.id??'create'}:20260917:${hash}`);
 }
 assertPaymentMethodPolicy(configuration,mode,preferences);
 return {paymentMethodConfigurationId:configuration.id,paymentMethodDefaultConfigurationId:defaults[0].id,paymentMethodPreferences:preferences};
}
export async function provision({mode,account,apiVersion,secret,publicOrigin,apply=false,fetcher=fetch}) {
 if(!['test','live'].includes(mode)||!/^acct_[A-Za-z0-9]+$/.test(account??'')||apiVersion!==STRIPE_FIRST_PARTY_API_VERSION)throw new Error('Exact mode, account and pinned API version required.');
 if(!apply)return {dryRun:true,mode,account,catalog:catalogPlan,paymentMethods:{strategy:'dynamic_configuration',name:paymentMethodConfigurationName(mode),source:'own-account default; available and enabled only',excluded:STRIPE_EXCLUDED_METHODS},forbiddenObjects:[],createsWebhookSecret:false};
 publicOrigin=validatedProvisionOrigin(mode,publicOrigin);
 if(!new RegExp(`^rk_${mode}_`).test(secret??''))throw new Error('Selected environment credential missing or mismatched.');
 async function request(path,method='GET',fields={},idempotency) {
  const headers={authorization:`Bearer ${secret}`,'stripe-version':apiVersion};
  if(method==='POST'){headers['content-type']='application/x-www-form-urlencoded';headers['idempotency-key']=idempotency;}
  const response=await fetcher(`https://api.stripe.com${path}`,{method,headers,body:method==='POST'?new URLSearchParams(fields):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`Provider request failed (${response.status}); no response body retained.`);
  const data=await readBoundedResponseJson(response);if(typeof data.livemode==='boolean'&&data.livemode!==(mode==='live'))throw new Error('Provider environment mismatch.');return data;
 }
 if((await request('/v1/account'))?.id!==account)throw new Error('Provider account mismatch.');
 const paymentMethods=await provisionPaymentMethods(request,mode);
 const rows=[];
 for(const plan of catalogPlan){
  const productId=`prod_elysia${mode}${plan.productKey.replaceAll("_", "")}20260915`;
  let product=await request(`/v1/products/${productId}`);
  if(!product)product=await request('/v1/products','POST',{id:productId,name:plan.name,description,'metadata[economic_product_key]':plan.productKey,'metadata[economic_environment]':mode},`elysia:${mode}:product:${plan.productKey}:20260915`);
  if(product?.id!==productId||product.active!==true||product.livemode!==(mode==='live')||product.metadata?.economic_product_key!==plan.productKey||product.metadata?.economic_environment!==mode)throw new Error('Existing product conflicts with approved plan.');
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
 const configurations=[];let cursor='';
 for(let page=0;page<10;page++){
  const listing=await request(`/v1/billing_portal/configurations?limit=100${cursor?'&starting_after='+encodeURIComponent(cursor):''}`);
  configurations.push(...listing.data.filter(value=>value.metadata?.elysia_configuration===`first_party_${mode}_20260915`));
  if(!listing.has_more)break;
  if(page===9)throw new Error('Portal configuration search exceeded safe page limit.');
  cursor=listing.data.at(-1).id;
 }
 if(configurations.length>1)throw new Error('Ambiguous portal configuration.');
 let portal=configurations[0];
 if(!portal)portal=await request('/v1/billing_portal/configurations','POST',{
  'business_profile[headline]':'EcoSyneva Commons LLC · Support billing',
  'business_profile[privacy_policy_url]':'https://elysiaecobotics.com/legal/privacy-policy',
  'business_profile[terms_of_service_url]':'https://elysiaecobotics.com/legal/support-and-billing-terms',
  'features[invoice_history][enabled]':'true','features[payment_method_update][enabled]':'true',
  'features[subscription_cancel][enabled]':'true','features[subscription_cancel][mode]':'at_period_end',
  'features[subscription_cancel][proration_behavior]':'none','features[subscription_update][enabled]':'false',
  'default_return_url':`${publicOrigin}/commons-circle/support-billing`,
  'metadata[elysia_configuration]':`first_party_${mode}_20260915`
 },`elysia:${mode}:portal:20260915`);
 assertPortalPolicy(portal,mode,publicOrigin);
 return {dryRun:false,mode,account,rows,portalConfigurationId:portal.id,...paymentMethods,enabledLanes:[],note:'References require recording in the matching economic database and non-secret Worker bindings. No feature switch was changed.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.env.BILLING_MODE;const apply=process.argv.includes('--apply');
 const secret=mode==='live'?process.env.STRIPE_PROVISIONING_KEY_LIVE:process.env.STRIPE_PROVISIONING_KEY_TEST;
 try{console.log(JSON.stringify(await provision({mode,account:process.env.STRIPE_ACCOUNT_ID,apiVersion:process.env.STRIPE_API_VERSION,secret,publicOrigin:process.env.BILLING_PUBLIC_ORIGIN,apply}),null,2));}catch{console.error('Provisioning failed; check mode, account, permissions, return origin and existing catalog/Portal policy. No provider response or credential retained.');process.exitCode=1;}
}
