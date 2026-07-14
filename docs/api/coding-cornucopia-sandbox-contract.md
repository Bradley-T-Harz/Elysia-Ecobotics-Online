# Coding Cornucopia governed sandbox API

The browser has one execution boundary: the same-origin Cloudflare Pages Functions routes. It never discovers or calls the Hetzner hostname and it never receives a runner or database-finalizer secret.

## Browser authentication

The signed-in client sends the current short-lived Supabase access token:

```http
Authorization: Bearer <Supabase access token>
```

The Pages Function validates that token with Supabase, derives the user from the verified token, loads the current member/reviewer/administrator quota tier from server-side roles, checks current sandbox access, and resolves the requested source through the caller's RLS-scoped Supabase client. A `user_id`, email, role, quota tier, or authorization assertion in a request body is rejected by the strict schema and never trusted. Higher tiers affect quota only; isolation is identical for everyone.

## `GET /api/sandbox/health`

Requires a valid Supabase access token. The response is intentionally small:

```json
{ "ok": true, "status": "available" }
```

Failures return only a safe public status. Engine name, images, internal paths, host details, and raw runner errors stay private.

## `POST /api/sandbox/run`

Requires JSON, a valid access token, and an `Origin` exactly equal to `SANDBOX_PUBLIC_ORIGIN`. The request is capped before parsing and permits only these keys:

```json
{
  "clientRequestId": "a UUID generated once and reused for retries",
  "snapshotId": "an immutable or explicit snapshot identifier",
  "sourceType": "commune_code_version",
  "sourceId": "the RLS-authorized source identifier",
  "language": "javascript",
  "fileName": "main.js",
  "code": "only used for explicitly permitted snapshot source types"
}
```

For canonical post snippets, code documents, code versions, and revision proposals, the Function reloads the code and metadata from Supabase through RLS and rejects a mismatched snapshot. Repository and iteration showcase records authorize an explicitly selected artifact snapshot because their tables contain metadata but not an executable canonical file. `manual_snapshot` is limited to unsaved proposal/editor content. Unsupported source mappings are rejected rather than guessed.

The Function hashes the authorized code, atomically reserves quota and a lease, marks the reservation running through the finalizer-token RPC, and calls the runner with Cloudflare Access Service Auth plus runner authentication. It never forwards the user JWT or account/source context to Hetzner.

Public results contain only:

```json
{
  "ok": true,
  "runId": "reservation UUID",
  "status": "completed",
  "language": "javascript",
  "file": "main.js",
  "snapshotId": "selected snapshot",
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "durationMs": 120,
  "outputTruncated": false,
  "diagnostics": [],
  "message": "Sandbox run completed. This is evidence only, not approval or trust.",
  "recordingStatus": "recorded",
  "idempotentReplay": false
}
```

The response and diagnostic arrays are bounded and sanitized. Database finalization failure is represented by `recordingStatus: "failed"`; it is not misreported as execution failure. A completed idempotent retry returns the recorded bounded result with `idempotentReplay: true`. Active duplicate, quota, and runner contention responses use `429` and `Retry-After`.

Preview and development deployments remain fail-closed. Production requires all environment gates, exact production origin, and every required binding.
