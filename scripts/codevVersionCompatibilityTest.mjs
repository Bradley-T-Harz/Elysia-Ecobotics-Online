/** Product admission only. Native pairing and transport are covered by broker tests. */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/shared/codev/brokerClient.ts"], bundle: true,
  write: false, format: "esm", platform: "node" });
const { CodevBrokerClient } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
let checks = 0;
for (const surface of ["marketplace", "forge"]) {
  const scope = { accountId: "qa-account", origin: "https://elysiaecobotics.com", surface, browserSessionId: "qa-session" };
  const base = { contract_version: "codev-pairing-1", pairing_id: "qa-pairing",
    actor: { online_account_id: scope.accountId, origin: scope.origin, surface, client_kind: "browser" },
    browser_session_id: scope.browserSessionId,
    installation: { installed: true, usable: true, version: "1.1.0", capabilities: [] }, workspace_grants: [] };
  const verify = value => CodevBrokerClient.prototype.verifyConnection.call({
    request: async () => ({ session: value }), pairing: { pairing_id: "qa-pairing" }, key: { scope },
  });
  for (const version of ["1.0.0", "1.1.0"]) {
    await verify({ ...base, installation: { ...base.installation, version } }); checks++;
  }
  for (const version of ["1.0.1", "1.2.0", "2.0.0", "*", null]) {
    await assert.rejects(verify({ ...base, installation: { ...base.installation, version } }), /could not be verified/); checks++;
  }
  for (const update of [
    { installation: { ...base.installation, installed: false } },
    { installation: { ...base.installation, usable: false } },
    { actor: { ...base.actor, online_account_id: "another-account" } },
    { browser_session_id: "another-session" },
    { workspace_grants: [{ workspace_id: "implicit-workspace" }] },
    { contract_version: "unknown" },
  ]) { await assert.rejects(verify({ ...base, ...update }), /could not be verified/); checks++; }
}
console.log(`Codev product admission: ${checks} checks passed for both website surfaces; account/session/zero-grant boundaries retained.`);
