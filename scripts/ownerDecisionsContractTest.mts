import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ownerEconomicPolicy as policy,marketplaceFeeAllocation,refundPolicyDisposition} from '../src/shared/economics/ownerDecisions.ts';
import {processStewardshipRetention} from '../services/identity-worker/_shared/stewardshipRetention.ts';
assert.equal(policy.marketplaceFeeBps,500);assert.equal(policy.commercialJobPostFeeMinor,1000);assert.equal(policy.financialActivation,false);assert.equal(policy.providerModelApproved,false);assert.equal(policy.supportGrantsPersonalCompute,false);
for(const [gross,fee] of [[0,0],[1,0],[10,1],[1000,50],[1999,100],[100000000000,5000000000]]){
 const full=marketplaceFeeAllocation(gross);assert.equal(full.platformFeeMinor,fee);assert.equal(full.creatorPriceMinor,gross);assert.equal(full.creatorPayableBeforeProcessorAndTaxMinor+full.platformFeeMinor,gross);assert.equal(full.processorFeeMinor,null);assert.equal(full.payoutCompleted,false);
 const waived=marketplaceFeeAllocation(gross,fee);assert.equal(waived.creatorPriceMinor,gross);assert.equal(waived.creatorPayableBeforeProcessorAndTaxMinor,gross);assert.equal(waived.platformFeeMinor,0);assert.equal(waived.waivedValueMinor,fee);
 assert.throws(()=>marketplaceFeeAllocation(gross,fee+1));
}
for(const invalid of [-1,NaN,Infinity,1.2,100000000001])assert.throws(()=>marketplaceFeeAllocation(invalid));
for(const [lane,reason,expected] of [
 ['support','duplicate','refund'],['support','mistaken_amount','review_refund'],['support','unauthorized','refund_and_investigate'],['support','cancel_future_renewal','cancel_future_renewal'],['support','prolonged_material_failure','notice_and_refund_or_cancellation_offer'],
 ...['non_delivery','misrepresentation','security_defect','duplicate','unauthorized','mandatory_right'].map(r=>['marketplace',r,'review_refund']),
 ['job_post','rejected_before_publication','no_charge'],['job_post','failed_to_publish_after_payment','full_refund'],['job_post','withdrawn_after_publication','normally_no_refund'],['job_post','platform_error_removal','fair_refund_or_credit'],['job_post','poster_misconduct','normally_no_refund'],['organization_services','other','contract_specific']
])assert.equal(refundPolicyDisposition(lane as any,reason as any),expected);
const requestId='f7100000-0000-4000-8000-000000000001',leaseToken='f7200000-0000-4000-8000-000000000001';
const job={requestId,leaseToken,objects:[{objectId:'f7300000-0000-4000-8000-000000000001',bucket:'stewardship-receipts',name:`f7400000-0000-4000-8000-000000000001/${requestId}/proof.pdf`}]};
for(const mode of ['success','storage_error','completion_error','wrong_path','wrong_bucket','claim_error','no_jobs']){
 const calls:string[]=[];const record=structuredClone(job);if(mode==='wrong_path')record.objects[0].name='other/record/proof.pdf';if(mode==='wrong_bucket')record.objects[0].bucket='public';
 const client:any={rpc:async(name:string,args:any)=>{calls.push(name);if(name==='claim_stewardship_proof_deletions')return {data:mode==='no_jobs'?[]:[record],error:mode==='claim_error'?{}:null};assert.equal(args.p_request_id,requestId);assert.equal(args.p_lease_token,leaseToken);return {data:mode!=='completion_error',error:null};},storage:{from:(bucket:string)=>{assert.equal(bucket,'stewardship-receipts');return {remove:async(names:string[])=>{calls.push('remove');assert.deepEqual(names,job.objects.map(o=>o.name));return {error:mode==='storage_error'?{}:null};}}}}};
 if(['wrong_bucket','claim_error'].includes(mode)){await assert.rejects(()=>processStewardshipRetention(client));assert.deepEqual(calls,['claim_stewardship_proof_deletions']);continue;}
 const result=await processStewardshipRetention(client);assert.equal(result.completed,mode==='success'?1:0);
 if(['storage_error','wrong_path'].includes(mode))assert(!calls.includes('complete_stewardship_proof_deletion'));
 if(mode==='completion_error')assert.equal(result.failed,1);
}
const graph=JSON.parse(await fs.readFile('docs/navigation/route-preservation-contract.json','utf8')).routes;
const workflows=JSON.parse(await fs.readFile('docs/navigation/three-door-workflows.json','utf8')).workflows;
for(const w of workflows)for(const door of ['start','myStatus','operator']){const value=w[door];if(!value){assert.equal(door,'operator');assert(w.operatorException);continue;}const pathname=value.split(/[?#]/)[0];assert(graph.some((r:any)=>r.resolvedPattern&&r.resolvedPattern!=='*'&&new RegExp('^'+r.resolvedPattern.replace(/:[^/]+/g,'[^/]+')+'$').test(pathname)),`${w.name}: missing ${door} ${pathname}`);}
const pages=JSON.parse(await fs.readFile('public/_routes.json','utf8'));assert(!pages.include.some((r:string)=>/billing|economic-preparation/.test(r)));
console.log(`Owner policy, fee/creator boundaries, 18 refund cases, retention worker fault isolation and ${workflows.length} Three-Door contracts passed.`);
