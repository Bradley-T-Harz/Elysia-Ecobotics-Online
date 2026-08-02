import assert from "node:assert/strict";
import { getSandboxExecutionLanguageCompatibility } from "../src/pages/The-Elysia-Commune/codeLanguagePolicies.ts";
import { requestSandboxRun } from "../src/pages/The-Elysia-Commune/codingSandboxClient.ts";

const fixtureToken = "synthetic-user-token-that-is-never-a-production-credential";
const baseRequest = {
  clientRequestId: "a9100000-0000-4000-8000-000000000001",
  snapshotId: "a9200000-0000-4000-8000-000000000001",
  sourceType: "commune_post_snippet",
  sourceId: "a9300000-0000-4000-8000-000000000001",
  fileName: "fixture.txt",
  code: "Never share secrets or tokens in public text."
};

const plainText = getSandboxExecutionLanguageCompatibility("text");
assert.equal(plainText.knownLanguage, true);
assert.equal(plainText.policy.label, "Plain text");
assert.equal(plainText.policy.status, "static_diagnostics", "Plain text must retain local static diagnostics.");
assert.equal(plainText.executable, false);
assert.equal(plainText.requestLanguage, null);
assert.match(plainText.message ?? "", /not an executable language/i);

const unknown = getSandboxExecutionLanguageCompatibility("made-up-language");
assert.equal(unknown.knownLanguage, false);
assert.equal(unknown.executable, false);
assert.equal(unknown.requestLanguage, null);
assert.match(unknown.message ?? "", /unsupported language/i);

for (const language of ["text", "plaintext", "made-up-language"]) {
  let fetches = 0;
  const result = await requestSandboxRun({ ...baseRequest, language }, fixtureToken, async () => {
    fetches += 1;
    throw new Error("Unsupported languages must never reach fetch.");
  });
  assert.equal(fetches, 0, `${language} must emit no /api/sandbox/run request.`);
  assert.equal(result.ok, false);
  assert.equal(result.status, "policy_blocked");
  assert.equal(result.errorCode, "sandbox_language_unsupported");
  assert(result.diagnostics.every((item) => item.category === "unsupported_language"));
  assert.doesNotMatch(result.message, /internal|temporarily unavailable/i);
}

const supportedLanguages = new Map([
  ["python", "python"],
  ["py", "python"],
  ["javascript", "javascript"],
  ["js", "javascript"],
  ["node", "javascript"],
  ["typescript", "typescript"],
  ["ts", "typescript"],
  ["json", "json"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["markdown", "markdown"],
  ["md", "markdown"],
  ["html", "html"],
  ["htm", "html"],
  ["css", "css"]
]);

for (const [language, canonical] of supportedLanguages) {
  const compatibility = getSandboxExecutionLanguageCompatibility(language);
  assert.equal(compatibility.executable, true, `${language} must remain requestable.`);
  assert.equal(compatibility.requestLanguage, canonical, `${language} must normalize to ${canonical}.`);
  let fetches = 0;
  let requestBody;
  const result = await requestSandboxRun({ ...baseRequest, language }, fixtureToken, async (input, init) => {
    fetches += 1;
    assert.equal(input, "/api/sandbox/run");
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      ok: true,
      status: "completed",
      language: canonical,
      file: baseRequest.fileName,
      snapshotId: baseRequest.snapshotId,
      diagnostics: [],
      message: "Synthetic governed run completed."
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(fetches, 1);
  assert.equal(requestBody.language, canonical);
  assert.equal(result.ok, true);
}

const invalidFromServer = await requestSandboxRun(
  { ...baseRequest, language: "javascript" },
  fixtureToken,
  async () => new Response(JSON.stringify({ ok: false, error: "language_invalid" }), {
    status: 400,
    headers: { "content-type": "application/json" }
  })
);
assert.equal(invalidFromServer.status, "policy_blocked");
assert.equal(invalidFromServer.errorCode, "sandbox_language_unsupported");
assert(invalidFromServer.diagnostics.every((item) => item.category === "unsupported_language"));
assert.match(invalidFromServer.message, /language is not supported for execution/i);
assert.doesNotMatch(invalidFromServer.message, /internal|temporarily unavailable/i);

console.log("Sandbox client execution-language contract test ok.");
