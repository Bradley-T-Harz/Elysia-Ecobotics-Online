/** Real workerd semantics, synthetic upstream only; never loads operator env. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ stdin: {
  contents: 'import { handleCodevPairing } from "./functions/api/codev/[[path]].ts"; export default { fetch: handleCodevPairing };',
  resolveDir: root, loader: 'ts',
}, bundle: true, write: false, format: 'esm', platform: 'browser' });
const origin = 'https://elysiaecobotics.com';
const project = 'https://synthetic-fixture.supabase.co';
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
const key = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
const id = crypto.randomUUID();
const view = { pairing_id: id, native_public_key: null, workspace_grants: [], intent: {
  contract_version: 'codev-pairing-1', intent_id: id, online_account_id: crypto.randomUUID(),
  account_label: 'fixture@example.invalid', origin, surface: 'marketplace', browser_session_id: 'b'.repeat(32),
  browser_public_key: key, expires_at: new Date(Date.now() + 300000).toISOString(), status: 'pending',
} };
const jwt = 'synthetic.bounded.' + 'a'.repeat(64);
const mock = `
const requests = [];
export default { async fetch(request, env) {
  if (request.url === 'https://audit.invalid/') return Response.json(requests);
  requests.push({ url: request.url, authorization: request.headers.get('authorization') });
  if (request.url !== '${project}/rest/v1/rpc/codev_create_pairing_intent') return new Response('unexpected destination', { status: 500 });
  const input = await request.json();
  const mode = input.p_browser_session_id[0];
  if (mode === 'c') return new Response('', { status: 302, headers: { location: 'https://attacker.invalid/credential-sink' } });
  if (mode === 'd') return new Response('', { status: 307, headers: { location: '${project}/unexpected-path' } });
  if (mode === 'e') return Response.json({ ...env.VIEW, unexpected_secret: 'synthetic-canary' });
  return Response.json(env.VIEW);
} };`;
// Match the deployed Pages compatibility date. The second worker receives ALL
// outbound requests, including a redirect if a regression accidentally follows it.
const runtime = new Miniflare(convertV4MiniflareOptions({ cf: false, workers: [
  { name: 'pairing', modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-06-09',
    bindings: { SUPABASE_URL: project, SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-binding' }, outboundService: 'synthetic-upstream' },
  { name: 'synthetic-upstream', modules: true, script: mock, compatibilityDate: '2026-06-09', bindings: { VIEW: view },
    outboundService: async () => { throw new Error('External network is forbidden in this test'); } },
] }));
try {
  for (const [mode, expected] of [['b', 200], ['c', 409], ['d', 409], ['e', 503]]) {
    const response = await runtime.dispatchFetch(origin + '/api/codev/create', { method: 'POST', headers: {
      origin, authorization: 'Bearer ' + jwt, 'content-type': 'application/json',
    }, body: JSON.stringify({ surface: 'marketplace', browser_session_id: mode.repeat(32), browser_public_key: key }) });
    assert.equal(response.status, expected, `workerd response for ${mode}`);
    const output = await response.json();
    if (expected === 200) { assert.deepEqual(output.pairing, view); assert.match(output.manual_code, /^EC1\.A\.[A-Za-z0-9_-]{43}$/); }
    else assert.deepEqual(output, { ok: false, error: 'codev_pairing_unavailable' });
  }
  const upstream = await runtime.getWorker('synthetic-upstream');
  const requests = await (await upstream.fetch('https://audit.invalid/')).json();
  assert.equal(requests.length, 4, 'Redirect forwarded credentials to another request');
  for (const request of requests) {
    assert.equal(request.url, project + '/rest/v1/rpc/codev_create_pairing_intent');
    assert.equal(request.authorization, 'Bearer ' + jwt);
  }
  console.log('Codev workerd runtime: success, cross-origin and same-origin redirect refusal, bounded output validation passed; no external network.');
} finally { await runtime.dispose(); }
