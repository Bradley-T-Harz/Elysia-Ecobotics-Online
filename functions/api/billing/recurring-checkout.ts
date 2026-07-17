import { handleCheckout, type CheckoutDependencies } from "./_shared/checkout.ts";
import type { BillingEnv } from "./_shared/types.ts";

export function handleRecurringCheckout(request: Request, env: BillingEnv, dependencies?: CheckoutDependencies): Promise<Response> {
  return handleCheckout(request, env, "support_recurring", dependencies);
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleRecurringCheckout(context.request, context.env);
