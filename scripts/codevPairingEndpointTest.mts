import assert from "node:assert/strict";
import { handleCodevPairing } from "../functions/api/codev/[[path]].ts";
const origin = "https://elysiaecobotics.com";
const env = { SUPABASE_URL: "https://synthetic-fixture.supabase.co", SUPABASE_PUBLISHABLE_KEY: "synthetic-public-binding" };
const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
const key = { kty: "EC", crv: "P-256", x: jwk.x!, y: jwk.y! };
const browserId = "b".repeat(32); const userId = crypto.randomUUID(); const pairingId = crypto.randomUUID();
const jwt = "synthetic.bounded." + "a".repeat(64);
const value = { surface: "forge", browser_session_id: browserId, browser_public_key: key };
const view = { pairing_id: pairingId, native_public_key: null, workspace_grants: [], intent: {
  contract_version: "codev-pairing-1", intent_id: pairingId, online_account_id: userId, account_label: "fixture@example.invalid",
  origin, surface: "forge", browser_session_id: browserId, browser_public_key: key, expires_at: new Date(Date.now()+300000).toISOString(), status: "pending" } };
let calls: Array<{ url: string; headers: Headers; body: Record<string, unknown>; redirect: RequestRedirect | undefined }> = [];
let responseData: unknown = view; let status = 200;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
  assert.match(String(url), /^https:\/\/synthetic-fixture\.supabase\.co\/rest\/v1\/rpc\/codev_/);
  calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)), redirect: init?.redirect });
  return new Response(JSON.stringify(responseData), { status });
};
function request(route: string, body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return new Request(origin + "/api/codev/" + route, { method, headers: {
    "content-type": "application/json", origin, authorization: `Bearer ${jwt}`, ...headers,
  }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
}
try {
  const created = await handleCodevPairing(request("create", value), env);
  assert.equal(created.status, 200); const output = await created.json() as {manual_code: string;pairing: unknown};
  assert.match(output.manual_code, /^EC1\.A\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(output.pairing, view);
  assert.equal(calls.length, 1); assert.equal(calls[0].redirect, "manual");
  assert.equal(calls[0].headers.get("apikey"), env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(calls[0].headers.get("authorization"), `Bearer ${jwt}`);
  assert(!JSON.stringify(calls).includes(output.manual_code));
  assert.match(String(calls[0].body.p_code_hash), /^[a-f0-9]{64}$/);
  const before = calls.length;
  for (const req of [request("create", {...value, workspace: "private source"}), request("create", {...value, browser_public_key: {...key,d:"private-key"}}),
    request("create", {...value, browser_public_key:{...key, x:"A".repeat(43),y:"A".repeat(43)}}), request("create", value,{origin:"null"}),
    request("create", value,{origin:"https://attacker.invalid"}), request("create", value,{authorization:""}),
    request("create", value,{"content-type":"text/plain"}), request("create",value,{"content-length":"9000"}),
    request("create?token=secret",value), request("proxy",value), request("create",value,{},"GET"),
    request("native",{pairing_id:pairingId,native_secret:"a".repeat(43),action:"lease"}),
    new Request("https://preview.pages.dev/api/codev/create",{method:"POST",headers:{origin:"https://preview.pages.dev"}})]) {
    assert((await handleCodevPairing(req,env)).status>=400);
  }
  assert.equal(calls.length,before,"invalid input reached database");
  const nativeSecret="a".repeat(43);
  const claimed=await handleCodevPairing(new Request(origin+"/api/codev/claim",{method:"POST",headers:{"content-type":"application/json","x-codev-native":"pairing-1"},body:JSON.stringify({code:output.manual_code,native_public_key:key,native_secret:nativeSecret})}),env);
  assert.equal(claimed.status,200);
  const call=calls[calls.length-1];assert.equal(call.headers.get("authorization"),null);
  assert(!JSON.stringify(call.body).includes(nativeSecret));assert(!JSON.stringify(call.body).includes(output.manual_code));
  assert.match(String(call.body.p_native_secret_hash),/^[a-f0-9]{64}$/);
  responseData={...view,native_secret_hash:"secret"};
  assert.equal((await handleCodevPairing(request("browser",{pairing_id:pairingId,surface:"forge",browser_session_id:browserId,action:"status"}),env)).status,503);
  responseData=null;
  assert.equal((await handleCodevPairing(request("create",value),env)).status,403);
  responseData=view;status=403;
  assert.equal((await handleCodevPairing(request("create",value),env)).status,403);
  for (const redirect of [301, 302, 303, 307, 308]) {
    status=redirect; const size=calls.length;
    assert.equal((await handleCodevPairing(request("create",value),env)).status,409);
    assert.equal(calls.length,size+1,"redirect caused a second upstream request");
  }
  for(const invalid of ["http://127.0.0.1:54321","https://attacker.invalid","https://name:password@synthetic-fixture.supabase.co","https://synthetic-fixture.supabase.co?destination=evil"]){
    const size=calls.length;assert.equal((await handleCodevPairing(request("create",value),{...env,SUPABASE_URL:invalid})).status,503);assert.equal(calls.length,size);
  }
  console.log("Codev endpoint origin, account token, key curve, input/output bounds, secret hashing and destination isolation checks passed.");
} finally {globalThis.fetch=realFetch;}
// Node-only fetch mocks cannot qualify Cloudflare's redirect/runtime semantics.
await import("./codevPairingRuntimeTest.mjs");
