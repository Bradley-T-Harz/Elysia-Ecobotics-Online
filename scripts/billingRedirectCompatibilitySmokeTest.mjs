import assert from "node:assert/strict";

import {
  BillingHttpError,
  fetchWithTimeout
} from "../functions/api/billing/_shared/http.ts";

const originalInit = {
  method: "GET",
  redirect: "error"
};

let successfulForwardedInit;

const successfulResponse = await fetchWithTimeout(
  new URL("https://billing.example.invalid/success"),
  originalInit,
  1_000,
  async (_input, init) => {
    successfulForwardedInit = init;
    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  }
);

assert.equal(successfulResponse.status, 200);
assert.equal(successfulForwardedInit?.redirect, "manual");
assert.ok(successfulForwardedInit?.signal instanceof AbortSignal);
assert.equal(originalInit.redirect, "error");

let redirectForwardedInit;

await assert.rejects(
  fetchWithTimeout(
    new URL("https://billing.example.invalid/redirect"),
    { method: "GET", redirect: "error" },
    1_000,
    async (_input, init) => {
      redirectForwardedInit = init;
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://billing.example.invalid/elsewhere"
        }
      });
    }
  ),
  (error) => {
    assert.ok(error instanceof BillingHttpError);
    assert.equal(error.status, 502);
    assert.equal(error.code, "billing_upstream_redirect_denied");
    return true;
  }
);

assert.equal(redirectForwardedInit?.redirect, "manual");

await assert.rejects(
  fetchWithTimeout(
    new URL("https://billing.example.invalid/network-failure"),
    { method: "GET", redirect: "follow" },
    1_000,
    async () => {
      throw new TypeError("synthetic network failure");
    }
  ),
  (error) => {
    assert.ok(error instanceof BillingHttpError);
    assert.equal(error.status, 504);
    assert.equal(error.code, "billing_upstream_timeout");
    return true;
  }
);

console.log("Billing Cloudflare redirect compatibility smoke test ok.");
