import { useState } from "react";
import { Link } from "react-router-dom";
import { ownerEconomicPolicy, refundPolicyDisposition, type RefundLane, type RefundReason } from "./ownerDecisions";
const reasons: Record<RefundLane, RefundReason[]> = {
 support: ["duplicate", "mistaken_amount", "unauthorized", "cancel_future_renewal", "prolonged_material_failure", "mandatory_right", "other"],
 marketplace: ["non_delivery", "misrepresentation", "security_defect", "duplicate", "unauthorized", "mandatory_right", "other"],
 job_post: ["rejected_before_publication", "failed_to_publish_after_payment", "withdrawn_after_publication", "platform_error_removal", "poster_misconduct", "mandatory_right", "other"],
 organization_services: ["other"]
};
const label = (value: string) => value.replace(/_/g, " ");
export default function RefundPolicyGuide() {
 const [lane, setLane] = useState<RefundLane>("support"), [reason, setReason] = useState<RefundReason>("duplicate");
 return <section className="section-card"><h2>Refund policy guidance</h2><p>Adopted {ownerEconomicPolicy.version}. Apply the relevant lane and record the evidence and reason in the existing governed case or refund review. This guide does not create a decision, cancel a subscription, refund money or confirm a creator payout.</p>
 <label><span>Financial lane</span><select value={lane} onChange={event => {const next=event.target.value as RefundLane;setLane(next);setReason(reasons[next][0]);}}>{Object.keys(reasons).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
 <label><span>Refund review circumstance</span><select value={reason} onChange={event => setReason(event.target.value as RefundReason)}>{reasons[lane].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
 <p role="status"><strong>Policy direction: {label(refundPolicyDisposition(lane,reason))}.</strong> Applicable mandatory rights and verified transaction facts still require review.</p>
 <Link to="/legal/refund-and-cancellation-policy">Current refund and cancellation policy</Link></section>;
}
