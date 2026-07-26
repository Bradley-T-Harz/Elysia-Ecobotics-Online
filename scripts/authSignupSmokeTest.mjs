import assert from "node:assert/strict";
import { requestWebsiteAccountSignup } from "../src/pages/The-Elysia-Marketplace/components/authSignup.ts";

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

console.log("Mocked Website Account signup request contract test passed.");
