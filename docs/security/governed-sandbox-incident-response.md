# Governed sandbox incident response

## Immediate containment

1. Set the production Pages `SANDBOX_ENABLED` variable to `false` and deploy that configuration.
2. Set either runner kill switch to `false`, restart the user runner service, and stop it if compromise is suspected.
3. Kill and forcibly remove any `elysia-sandbox-*` container as the unprivileged service account. Confirm none remain.
4. Keep the runner bound to loopback. Do not temporarily expose it or weaken Cloudflare Access/firewall rules while diagnosing.
5. Preserve only bounded audit and service metadata needed for review. Do not copy raw submitted code, full output, tokens, environment files, user JWTs, or Tunnel credentials into tickets or chat.

## Credential response

Rotate only in the system that owns each value, entering replacements directly:

- runner token: Pages production secret and the root-owned, group-readable mode-`0640` runner environment;
- database finalizer token: Pages production secret and its private Supabase hash row;
- Access service token: Cloudflare Access and Pages production secrets;
- Tunnel credential: Cloudflare and the root-readable `cloudflared` credential file.

Revoke the previous credential before re-enabling execution whenever continuity permits. A suspected Supabase user token is handled through the account/session response path; it is never sent to Hetzner.

Pages owns no billing, Stripe, webhook, payout, or Supabase service-role credential. If any such binding is discovered during a sandbox incident, treat that as a separate billing-secret exposure: remove it from Pages, rotate it in the billing provider/control plane, keep billing mutations disabled, and verify the dedicated billing Worker boundary. Never copy a billing credential into the sandbox runtime to diagnose or restore service.

## Investigation checklist

- Identify the affected release ID, image digests, service start time, and bounded run IDs.
- Verify the active release and images against their manifests/digests.
- Confirm rootless engine state, cgroup limits, container removal, loopback listener, service unit hardening, and runtime-state ownership/modes.
- Confirm the origin Access assertion verifier still requires the exact issuer/audience and that the Access JWKS path, Service Auth decision, and direct-origin rejection remain intact.
- Check for unexpected files outside the service account's state root without opening unrelated private data.
- Review Cloudflare Access decisions, Tunnel state, Pages invocation metadata, Supabase lifecycle transitions, quota behavior, and bounded runner audit events.
- Treat raw engine exceptions, internal paths, headers, and secret-like strings as sensitive even if redaction was expected.
- Re-run the local proxy/runner/deployment tests and the live rootless acceptance suite in an isolated state directory.

## Recovery gate

Do not re-enable public execution until the cause is understood or safely bounded, affected credentials and images are replaced, the clean release verifies, every enforcement test passes, database leases are reconciled, preview remains disabled, and an operator explicitly approves reactivation.

Restore in order: verified runner with kill switches off; authenticated private health; Tunnel; Access failure/success proofs; database reservation/finalization proofs; one isolated test run; production Pages switch. Monitor the first runs and confirm successful raw-data cleanup.

## Evidence and communication

Record timestamps, release/image identifiers, safe run IDs, observed behavior, containment actions, rotations by secret name only, verification results, and remaining uncertainty. Execution success is not proof that the incident is resolved. Never include secret values, SSH keys, IP addresses, credential JSON, raw user code/output, or private account/context data in the incident report.
