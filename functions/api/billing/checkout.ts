import { handleCheckout, type CheckoutDependencies } from "./_shared/checkout.ts";
import type { BillingEnv } from "./_shared/types.ts";

export function handleOneTimeCheckout(request: Request, env: BillingEnv, dependencies?: CheckoutDependencies): Promise<Response> {
  return handleCheckout(request, env, "support_one_time", dependencies);
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOneTimeCheckout(context.request, context.env);
