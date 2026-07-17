import { useCallback, useEffect, useRef, useState } from "react";
import { loadBillingOrder, type BillingOrderFlow, type BillingOrderSummary } from "./billingClient";

type CheckoutReturnStatusProps = {
  accessToken: string;
  orderReference: string;
  returnState: "complete" | "canceled";
  expectedFlow: BillingOrderFlow;
  serviceLabel: string;
  boundary: string;
  onRefresh: () => Promise<void>;
};

export default function CheckoutReturnStatus({
  accessToken,
  orderReference,
  returnState,
  expectedFlow,
  serviceLabel,
  boundary,
  onRefresh
}: CheckoutReturnStatusProps) {
  const [order, setOrder] = useState<BillingOrderSummary | null>(null);
  const [checking, setChecking] = useState(true);
  const sequenceRef = useRef(0);

  const refresh = useCallback(async (refreshAccountProjection = true) => {
    const sequence = ++sequenceRef.current;
    setChecking(true);
    const [orderResult] = await Promise.allSettled([
      orderReference
        ? loadBillingOrder(orderReference, accessToken)
        : Promise.resolve<BillingOrderSummary>({
            flow: null,
            status: "unknown",
            cadence: null,
            createdAt: null,
            verifiedAt: null,
            message: "No private order reference was supplied."
          }),
      refreshAccountProjection ? onRefresh() : Promise.resolve()
    ]);
    if (sequence !== sequenceRef.current) return;
    setOrder(orderResult.status === "fulfilled" ? orderResult.value : {
      flow: null,
      status: "unavailable",
      cadence: null,
      createdAt: null,
      verifiedAt: null,
      message: "The private order status is temporarily unavailable."
    });
    setChecking(false);
  }, [accessToken, onRefresh, orderReference]);

  useEffect(() => {
    void refresh(false);
    return () => { sequenceRef.current += 1; };
  }, [refresh]);

  const flowMatches = order?.flow === expectedFlow;

  return <div className="boundary-note checkout-return-status" role="status" aria-live="polite" aria-busy={checking}>
    <p>{returnState === "complete"
      ? "A Stripe test checkout return parameter reached this private account surface."
      : "A canceled or left Stripe test checkout return parameter reached this private account surface."} Browser return alone is not proof of payment or fulfillment.</p>
    {checking ? <p>Checking the private server order and account projections…</p> : flowMatches ? <>
      <p>The private server order is verified as the expected {serviceLabel} flow. Server order state: {order.status.replace(/_/g, " ")}.</p>
      <p>{boundary}</p>
    </> : order?.flow ? <p>The private order belongs to a different economic flow. It is not being labeled as {serviceLabel}, and no service-specific payment or fulfillment is being claimed. Generic server order state: {order.status.replace(/_/g, " ")}.</p> : <p>The private server order flow could not be verified, so this reference is not being labeled as {serviceLabel}. No service-specific payment or fulfillment is being claimed.</p>}
    <div className="button-row"><button type="button" disabled={checking} onClick={() => void refresh()}>{checking ? "Checking verified status…" : "Check verified status again"}</button></div>
  </div>;
}
