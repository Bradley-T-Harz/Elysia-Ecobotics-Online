import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");

const [
  authPanel,
  authWidget,
  authConfig,
  signup,
  recoveryRequest,
  recoveryCompletion,
  lifecycleWidget,
  diagnostics,
] = await Promise.all([
  read("src/pages/The-Elysia-Marketplace/components/AuthPanel.tsx"),
  read("src/shared/auth/AuthTurnstile.tsx"),
  read("src/shared/auth/authCaptcha.ts"),
  read("src/pages/The-Elysia-Marketplace/components/authSignup.ts"),
  read("src/pages/Account/AccountForgotPasswordPage.tsx"),
  read("src/pages/Account/AccountRecoveryPage.tsx"),
  read("src/shared/participation/TurnstileWidget.tsx"),
  read("src/pages/The-Elysia-Marketplace/components/authSignupDiagnostics.ts"),
]);

assert.match(authConfig, /VITE_AUTH_CAPTCHA_MODE/);
assert.match(authConfig, /VITE_AUTH_TURNSTILE_SITE_KEY/);
assert.doesNotMatch(authConfig, /VITE_TURNSTILE_SITE_KEY(?!\w)/);
assert.match(authConfig, /"elysiaecobotics\.com", "www\.elysiaecobotics\.com"/);
assert.match(authConfig, /"127\.0\.0\.1"/);
assert.match(authConfig, /candidate\.length >= 10/);

assert.match(lifecycleWidget, /VITE_TURNSTILE_SITE_KEY/);
assert.doesNotMatch(lifecycleWidget, /VITE_AUTH_TURNSTILE_SITE_KEY/);
assert.match(authPanel, /useRef<string \| null>\(null\)/);
assert.match(authPanel, /new FormData\(submittedForm\)/);
assert.match(authPanel, /action=\{authMode === "sign_up" \? "online_signup" : "online_signin"\}/);
assert.match(recoveryRequest, /action="online_recovery"/);
assert.match(signup, /captchaToken\?: string/);
assert.match(signup, /\.\.\.\(input\.captchaToken \? \{ captchaToken: input\.captchaToken \} : \{\}\)/);

for (const source of [authPanel, authWidget, authConfig, signup, recoveryRequest]) {
  assert.doesNotMatch(source, /localStorage|sessionStorage|IndexedDB|console\./);
}
assert.match(authWidget, /"response-field": false/);
assert.match(authWidget, /"refresh-expired": "auto"/);
assert.match(authWidget, /"refresh-timeout": "auto"/);
assert.match(authWidget, /"unsupported-callback"/);
assert.match(authWidget, /replaceChildren\(\)/);
assert.doesNotMatch(authWidget, /cData|response-field-name/);

assert.doesNotMatch(diagnostics, /captchaToken|turnstile/i);
assert.doesNotMatch(recoveryCompletion, /captchaToken|AuthTurnstile/);
assert.match(recoveryCompletion, /updateUser/);

console.log("Online Auth Turnstile source isolation, privacy, and request contract passed.");
