import assert from "node:assert/strict";
import { requestWebsiteAccountSignup } from "../src/pages/The-Elysia-Marketplace/components/authSignup.ts";
import {
  beginAuthSignupDiagnostic,
  finishAuthSignupDiagnostic,
  getAuthSignupDiagnostic,
  safeAuthDiagnosticCode,
  updateAuthSignupDiagnostic,
} from "../src/pages/The-Elysia-Marketplace/components/authSignupDiagnostics.ts";

const emailRedirectTo = "https://elysiaecobotics.com/commons-circle/setup/profile";
const submittedEmail = "member@example.invalid";
const submittedPassword = "fixture-password-123";

function clientReturning(result) {
  const calls = [];
  return {
    calls,
    client: {
      auth: {
        async signUp(input) {
          calls.push(input);
          return result;
        },
      },
    },
  };
}

{
  const fixture = clientReturning({
    data: { session: null, user: { identities: [{ id: "fixture-email-identity" }] } },
    error: null,
  });
  const result = await requestWebsiteAccountSignup({
    client: fixture.client,
    email: `  ${submittedEmail}  `,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, { status: "confirmation_required" });
  assert.equal(fixture.calls.length, 1, "valid signup must call Supabase exactly once");
  assert.deepEqual(fixture.calls[0], {
    email: submittedEmail,
    password: submittedPassword,
    options: { emailRedirectTo },
  });
}

{
  const captchaToken = "synthetic-ephemeral-auth-captcha-token";
  const fixture = clientReturning({
    data: { session: null, user: { identities: [{ id: "fixture-email-identity" }] } },
    error: null,
  });
  const result = await requestWebsiteAccountSignup({
    client: fixture.client,
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
    captchaToken,
  });
  assert.deepEqual(result, { status: "confirmation_required" });
  assert.equal(fixture.calls.length, 1, "captcha-capable signup must still call Supabase exactly once");
  assert.deepEqual(fixture.calls[0], {
    email: submittedEmail,
    password: submittedPassword,
    options: { emailRedirectTo, captchaToken },
  });
}

{
  const fixture = clientReturning({
    data: { session: null, user: { identities: [] } },
    error: null,
  });
  const result = await requestWebsiteAccountSignup({
    client: fixture.client,
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, { status: "confirmation_or_existing" });
  assert.equal(fixture.calls.length, 1, "obfuscated existing-user response must not retry signup");
}

{
  const fixture = clientReturning({
    data: { session: null, user: null },
    error: null,
  });
  const result = await requestWebsiteAccountSignup({
    client: fixture.client,
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, { status: "unexpected_response" });
}

{
  const fixture = clientReturning({
    data: { session: null, user: null },
    error: { message: "fixture provider error", code: "captcha_failed", status: 400 },
  });
  const result = await requestWebsiteAccountSignup({
    client: fixture.client,
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, {
    status: "provider_error",
    message: "fixture provider error",
    code: "captcha_failed",
    providerStatus: 400,
  });
  assert.equal(fixture.calls.length, 1);
}

{
  const result = await requestWebsiteAccountSignup({
    client: null,
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, { status: "configuration_unavailable" });
}

{
  const fixtureSession = {
    access_token: "fixture-access-token",
    refresh_token: "fixture-refresh-token",
    expires_in: 3_600,
    token_type: "bearer",
    user: { email: submittedEmail },
  };
  const fixture = clientReturning({ data: { session: fixtureSession, user: fixtureSession.user }, error: null });
  const result = await requestWebsiteAccountSignup({
    client: fixture.client,
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.equal(result.status, "signed_in");
  assert.equal(result.status === "signed_in" ? result.session : null, fixtureSession);
}

{
  let calls = 0;
  const result = await requestWebsiteAccountSignup({
    client: {
      auth: {
        async signUp() {
          calls += 1;
          throw new Error("synthetic pre-network failure");
        },
      },
    },
    email: submittedEmail,
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, { status: "unexpected_error" });
  assert.equal(calls, 1);
}

{
  let calls = 0;
  const result = await requestWebsiteAccountSignup({
    client: {
      auth: {
        async signUp() {
          calls += 1;
          return { data: { session: null, user: null }, error: null };
        },
      },
    },
    email: "",
    password: submittedPassword,
    emailRedirectTo,
  });
  assert.deepEqual(result, { status: "invalid_input" });
  assert.equal(calls, 0);
}

{
  const diagnostic = beginAuthSignupDiagnostic();
  updateAuthSignupDiagnostic(diagnostic.attemptId, {
    validationPassed: true,
    signupCalled: true,
    requestStarted: true,
    requestCompleted: true,
    httpStatus: 429,
    safeCode: safeAuthDiagnosticCode("OVER_EMAIL_SEND_RATE_LIMIT"),
    resultCategory: "provider_error",
    renderedMessageCategory: "provider_error",
  });
  finishAuthSignupDiagnostic(diagnostic.attemptId);
  const stored = getAuthSignupDiagnostic();
  assert(stored);
  assert(Number.isFinite(stored.startedAtEpochMs));
  assert.match(stored.documentGeneration, /^[a-z0-9-]{3,32}$/);
  assert.equal(stored.pendingState, "settled");
  assert.equal(stored.submitEventReceived, false);
  assert.equal(stored.preventDefaultCalled, false);
  assert.equal(stored.pagehideFired, false);
  assert.equal(stored.beforeunloadFired, false);
  assert.equal(stored.navigationDetected, false);
  assert.equal(stored.safeCode, "over_email_send_rate_limit");
  assert.equal(safeAuthDiagnosticCode("unsafe code with private detail"), "unclassified");
  const serialized = JSON.stringify(stored);
  assert.equal(serialized.includes(submittedEmail), false);
  assert.equal(serialized.includes(submittedPassword), false);
  assert.equal(/access_token|refresh_token|authorization|apikey|user_id/i.test(serialized), false);
}

console.log("Mocked Website Account signup request and privacy-safe diagnostic contract tests passed.");
