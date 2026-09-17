// Read-only provider configuration checks. Does not qualify payments or enable gates.
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {catalogPlan,assertPortalPolicy,validatedProvisionOrigin} from './stripeFirstPartyProvision.mjs';
import {STRIPE_FIRST_PARTY_API_VERSION,STRIPE_FIRST_PARTY_WEBHOOK_URLS,STRIPE_ECONOMIC_MUTATION_EVENT_TYPES} from '../functions/api/billing/_shared/stripeContract.ts';
import {readBoundedResponseJson} from '../functions/api/billing/_shared/http.ts';
export async function preflight({mode,account,apiVersion,publicOrigin,secret,references,check=false,fetcher=fetch}) {
 if(!['test','live'].includes(mode)||!/^acct_[A-Za-z0-9]+$/.test(account??'')||apiVersion!==STRIPE_FIRST_PARTY_API_VERSION)throw new Error('preflight_contract_invalid');
 const plan={mode,account,apiVersion,webhookUrl:STRIPE_FIRST_PARTY_WEBHOOK_URLS[mode],events:[...STRIPE_ECONOMIC_MUTATION_EVENT_TYPES],methods:['card'],liveActivationAuthorized:false};
 if(!check)return {...plan,dryRun:true};
 publicOrigin=validatedProvisionOrigin(mode,publicOrigin);
 if(!new RegExp(`^rk_${mode}_`).test(secret??''))throw new Error('restricted_preflight_credential_required');
 if(references?.mode!==mode||references?.account!==account||references?.dryRun!==false||!Array.isArray(references.rows)||references.rows.length!==catalogPlan.length)throw new Error('catalog_reference_file_invalid');
 const get=async path=>{
  const response=await fetcher(`https://api.stripe.com${path}`,{method:'GET',headers:{authorization:`Bearer ${secret}`,'stripe-version':apiVersion},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('provider_read_failed');
  const data=await readBoundedResponseJson(response);
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('provider_response_invalid');
  if(typeof data.livemode==='boolean'&&data.livemode!==(mode==='live'))throw new Error('provider_mode_mismatch');
  return data;
 };
 const identity=await get('/v1/account');
 if(identity.id!==account)throw new Error('provider_account_mismatch');
 if(mode==='live'&&(identity.charges_enabled!==true||identity.payouts_enabled!==true||identity.details_submitted!==true))throw new Error('live_account_not_ready');
 const endpoints=[];let cursor='';
 for(let page=0;page<10;page++){
  const result=await get(`/v1/webhook_endpoints?limit=100${cursor?'&starting_after='+encodeURIComponent(cursor):''}`);
  if(!Array.isArray(result.data))throw new Error('endpoint_list_invalid');
  endpoints.push(...result.data.filter(item=>item.url===plan.webhookUrl));
  if(!result.has_more)break;
  if(page===9||!result.data.at(-1)?.id)throw new Error('endpoint_search_limit');
  cursor=result.data.at(-1).id;
 }
 if(endpoints.length!==1)throw new Error('exactly_one_webhook_endpoint_required');
 const endpoint=endpoints[0];
 if(endpoint.status!=='enabled'||endpoint.livemode!==(mode==='live')||endpoint.api_version!==apiVersion
  ||JSON.stringify([...(endpoint.enabled_events??[])].sort())!==JSON.stringify([...plan.events].sort()))throw new Error('webhook_contract_mismatch');
 const checkedProducts=new Set();
 for(const row of catalogPlan){
  const matches=references.rows.filter(item=>item.productKey===row.productKey&&item.priceCode===row.priceCode&&item.mode===mode);
  if(matches.length!==1)throw new Error('catalog_reference_mismatch');
  const ref=matches[0];const expectedId=`prod_elysia${mode}${row.productKey.replaceAll('_','')}20260915`;
  if(ref.providerProductReference!==expectedId)throw new Error('catalog_product_mismatch');
  if(!checkedProducts.has(expectedId)){
   const product=await get(`/v1/products/${expectedId}`);
   if(product.id!==expectedId||product.active!==true||product.livemode!==(mode==='live')||product.metadata?.economic_product_key!==row.productKey||product.metadata?.economic_environment!==mode)throw new Error('catalog_product_mismatch');
   checkedProducts.add(expectedId);
  }
  if(row.priceCode){
   if(!/^price_[A-Za-z0-9]+$/.test(ref.providerPriceReference??''))throw new Error('catalog_price_reference_invalid');
   const price=await get(`/v1/prices/${ref.providerPriceReference}`);
   if(price.id!==ref.providerPriceReference||price.active!==true||price.livemode!==(mode==='live')||price.product!==expectedId||price.currency!=='usd'||price.unit_amount!==row.amount||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)throw new Error('catalog_price_mismatch');
  }
 }
 if(!/^bpc_[A-Za-z0-9]+$/.test(references.portalConfigurationId??''))throw new Error('portal_reference_invalid');
 assertPortalPolicy(await get(`/v1/billing_portal/configurations/${references.portalConfigurationId}`),mode,publicOrigin);
 return {...plan,dryRun:false,configurationChecksPassed:true,webhookEndpointId:endpoint.id,portalConfigurationId:references.portalConfigurationId,chargesEnabled:identity.charges_enabled===true,payoutsEnabled:identity.payouts_enabled===true,checkedProducts:checkedProducts.size,checkedPrices:5,paymentAcceptance:'NOT_RUN',enabledLanes:[],requiredNextEvidence:['restricted-runtime-key API operations','signed webhook delivery and retries','complete sandbox acceptance','lane tax/legal/rollout decisions','database and Worker gates']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const mode=process.env.BILLING_MODE,check=process.argv.includes('--check');
  const references=check?JSON.parse(await readFile(process.env.STRIPE_CATALOG_REFERENCES_FILE,'utf8')):undefined;
  const secret=mode==='live'?process.env.STRIPE_PROVISIONING_KEY_LIVE:process.env.STRIPE_PROVISIONING_KEY_TEST;
  console.log(JSON.stringify(await preflight({mode,account:process.env.STRIPE_ACCOUNT_ID,apiVersion:process.env.STRIPE_API_VERSION,publicOrigin:process.env.BILLING_PUBLIC_ORIGIN,secret,references,check}),null,2));
 }catch{console.error('Stripe configuration preflight FAILED. Verify mode/account, restricted read permissions, exact webhook contract, catalog references and Portal policy. No secret or provider body retained.');process.exitCode=1;}
}
