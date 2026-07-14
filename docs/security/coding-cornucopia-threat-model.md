# Coding Cornucopia threat model

## Primary threats

- malicious code, shell, package-manager, native-process, or host-execution attempts;
- secret, user-token, Cloudflare credential, Supabase credential, private-path, or Local Elysia data exfiltration;
- container escape, engine/socket access, mount abuse, filesystem probing, or orphan containers;
- network scanning, third-party attacks, dependency supply-chain activity, or repository clone/run;
- CPU/memory/PID exhaustion, infinite loops, crypto mining, output floods, request floods, and queue growth;
- forged execution results, quota races, duplicate retries, stale reservations, invalid lifecycle changes, and public evidence leakage;
- bypass of user authentication, source RLS, account authorization, Cloudflare Access, or runner authentication;
- preview deployments acquiring production reachability or secrets;
- social engineering and false “safe,” “trusted,” “approved,” or “verified” claims.

## Layered controls

The browser uses only same-origin `/api/sandbox/*`, sends the current short-lived Supabase access token, and cannot choose a service URL. Cloudflare verifies the user with Supabase, derives authorization server-side, reloads canonical sources through RLS, rejects stale snapshot IDs, bounds schemas and responses, reserves quota/idempotency/leases atomically, and attaches Access plus runner credentials. Preview is disabled.

The Access-protected Tunnel is outbound-only and terminates at a loopback runner. The VPS exposes no runner, HTTP, or HTTPS application port. The runner independently authenticates, rejects browser origins and unknown fields, selects one configured rootless engine, requires immutable preloaded image digests, and has two execution kill switches.

Only one rootless Podman container runs at a time; there is no queue or automatic Docker fallback. It has no network, shell, package manager/install, writable root, capabilities, privilege escalation, root user, host/repository/home/vault/socket mount, or secret-bearing environment. CPU, memory, swap, PID, file-descriptor, temporary-space, wall-clock, request, and output limits are fixed. Timeout/output termination forcibly removes and then verifies absence of the container before releasing the slot.

Supabase prevents ordinary users from directly creating/updating results or diagnostics. The old result-recording RPC is revoked. Governed start/finalize requires the authenticated user, matching run, matching non-null idempotency key, valid lifecycle, and private finalizer token; only its hash is stored privately. Stale leases are recovered during reservation or by an administrator-only reconciliation RPC.

Responses and logs are bounded and sanitized. User JWTs, emails, roles, private notes, source context, internal paths, engine details, and private credentials do not go to Hetzner or back to the browser. Successful raw code/output is deleted synchronously; interrupted data and bounded audit metadata are subject to startup/timer retention cleanup.

## Residual risk and operating controls

Containers reduce risk but are not a proof against kernel/runtime vulnerabilities. Image builds, Podman/Node/OS patches, Access/Tunnel policy, Supabase grants, Cloudflare variables, service logs, quotas, and cgroup behavior require continuing review. The full live acceptance suite must run after runtime/image/system changes. Docker remains stopped cold standby until separately tested.

Operators must use the kill switches and incident runbook at the first sign of isolation, cleanup, credential, or result-integrity failure. Shell, native binaries, package installation, repository execution, and network access remain disabled.

Execution is evidence only, never trust or approval.
