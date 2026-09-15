// Emit reviewable SQL only. No credentials, network requests or implicit activation.
import { readFileSync } from 'node:fs';
const [action,file]=process.argv.slice(2);
const plan=JSON.parse(readFileSync(file,'utf8'));
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const lanes=['support_checkout','recurring_support','job_post_fee_enforcement','organization_billing','sponsorship_checkout'];
const requireValue=(value,expression,label)=>{if(typeof value!=='string'||!expression.test(value))throw new Error(`Invalid ${label}`);return value;};
const mode=requireValue(plan.mode,/^(test|live)$/,'mode');
const account=requireValue(plan.account,/^acct_[A-Za-z0-9]+$/,'account');
const reference=value=>requireValue(value,/^[A-Za-z0-9][A-Za-z0-9_./:#-]{7,250}$/,'evidence reference');
const stamp=value=>requireValue(value,/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/,'verified time');
let sql=`begin;\nset local request.jwt.claim.role='service_role';\nselect set_config('request.headers',${quote(JSON.stringify({'x-elysia-billing-mode':mode,'x-elysia-stripe-account':account}))},true);\n`;
if(action==='qualify'){
 if(mode!=='live')throw new Error('Qualification plan must target live after separate sandbox acceptance.');
 const evidence=reference(plan.evidenceRef);if(!/^[a-f0-9]{64}$/.test(plan.evidenceSha256))throw new Error('Evidence SHA-256 required.');
 sql+=`update private.economic_provider_readiness set runtime_mode='live',account_reference=${quote(account)},webhook_verified_at=${quote(stamp(plan.webhookVerifiedAt))},event_coverage_verified_at=${quote(stamp(plan.eventCoverageVerifiedAt))},receipt_configuration_verified_at=${quote(stamp(plan.receiptVerifiedAt))},portal_configuration_verified_at=${plan.portalVerifiedAt?quote(stamp(plan.portalVerifiedAt)):'null'},last_preflight_at=${quote(stamp(plan.preflightAt))},updated_at=now() where provider='stripe';\n`;
 if(!Array.isArray(plan.lanes)||!plan.lanes.length)throw new Error('Qualified lanes required.');
 for(const lane of plan.lanes){
  if(!lanes.includes(lane.key)||lane.taxBehavior!=='disabled')throw new Error('Lane or tax behavior requires separate implementation/qualification.');
  sql+=`update private.economic_feature_flags set sandbox_qualified_at=${quote(stamp(lane.sandboxQualifiedAt))},sandbox_evidence_ref=${quote(reference(lane.sandboxEvidenceRef))},tax_decision_ref=${quote(reference(lane.taxDecisionRef))},tax_behavior='disabled',legal_qualified_at=${quote(stamp(lane.legalQualifiedAt))},rollout_authorized_at=${quote(stamp(lane.rolloutAuthorizedAt))} where feature_key=${quote(lane.key)};\n`;
 }
 sql+=`insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata) values('system','first_party_qualification_recorded','economic_provider',${quote(evidence)},${quote(JSON.stringify({evidenceRef:evidence,evidenceSha256:plan.evidenceSha256,activationPerformed:false}))}::jsonb);\n`;
}else if(action==='catalog'){
 for(const row of plan.rows){
  if(!['support_one_time','support_recurring','job_post_fee','organization_service','sponsorship'].includes(row.productKey)||row.mode!==mode)throw new Error('Forbidden catalog scope.');
  const product=requireValue(row.providerProductReference,/^prod_[A-Za-z0-9]+$/,'product');
  const price=row.providerPriceReference?quote(requireValue(row.providerPriceReference,/^price_[A-Za-z0-9]+$/,'price')):'null';
  sql+=`select public.record_economic_test_catalog_reference(${quote(row.productKey)},${row.priceCode?quote(requireValue(row.priceCode,/^[a-z0-9_]{1,120}$/,'price code')):'null'},'stripe',${quote(product)},${price});\n`;
 }
}else if(action==='lane'){
 const actor=requireValue(plan.actor,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/,'operator');
 if(!lanes.includes(plan.lane)||typeof plan.enabled!=='boolean')throw new Error('First-party lane and boolean required.');
 const reason=reference(plan.reason);
 // A capability check precedes the global permission. Each lane has its own gate.
 sql+=`select private.require_economic_operator_capability(${quote(actor)}::uuid,'economic_feature_flags_manage');\n`;
 if(plan.enabled&&mode==='live')sql+="update private.economic_feature_flags set enabled=true,updated_at=now() where feature_key='live_stripe';\n";
 sql+=`select public.operator_set_first_party_lane(${quote(actor)}::uuid,${quote(plan.lane)},${plan.enabled},${quote(reason)});\n`;
}else throw new Error('Usage: stripeFirstPartyControl.mjs <qualify|catalog|lane> reviewed-plan.json');
sql+='commit;\n';process.stdout.write(sql);
