# Governed sandbox deployment runbook

This is the canonical repository, deployment, operations, and incident-entry contract for the governed public sandbox. It implements the existing production path without exposing an application port and without placing a Supabase service-role key anywhere in the browser, Pages Functions, or VPS. Perform production actions only after the repository is clean, every local check passes, the release bundle verifies, and an operator explicitly approves the deployment checkpoint.

Never paste a secret into source control, command history, chat, logs, or a deployment transcript. Enter values directly in the relevant masked dashboard field or root-owned mode-`0640` server file. The required secret names are listed at the end of this runbook; their values are deliberately absent.

## Current production checkpoint and release-preservation rule

As of 2026-07-14, the four governed database migration versions are installed and aligned locally and remotely. The reaction-count, Repository Showcase, and sandbox database layers were verified after their individual installation gates. Do not reapply or edit those migrations, and **never execute the baseline SQL against existing production**.

The externally operated production sandbox has since completed its separate infrastructure and activation process. Its normal Pages control-plane state is `SANDBOX_ENABLED=true`; preview remains disabled. An anonymous health request must fail authentication and an authorized signed-in request may reach the governed runner. HTTP 503 with `{"ok":false,"error":"sandbox_disabled"}` is reserved for a deliberate emergency or maintenance shutdown, not a routine release baseline.

A routine application release must preserve the current production variable and binding inventory. Never infer that a live `SANDBOX_ENABLED=true` value is drift merely because an older repository-readiness report, example file, or deployment transcript recorded a pre-activation `false` value. Before a release, compare the active production configuration with the immediately preceding known-good production deployment. If live state differs from the operator-approved release expectation, stop and reconcile it; do not automatically change a feature switch, binding, or secret. Changing `SANDBOX_ENABLED` is a separate control-plane action requiring an explicit activation or incident-response decision.

## Architecture, trust boundaries, and exact routes

```text
signed-in browser
  -> /api/sandbox/health or POST /api/sandbox/run (Supabase access JWT)
  -> Cloudflare Pages Function (JWT verification, source authorization, quota,
     idempotency, reservation/start/finalize RPCs, response sanitization)
  -> Cloudflare Access Service Auth (dedicated client ID/secret)
  -> Cloudflare Tunnel (outbound connector only)
  -> https://sandbox.elysiaecobotics.com
  -> 127.0.0.1:8788 on Hetzner
  -> authenticated runner GET /health or POST /v1/runs
  -> one ephemeral rootless Podman container
```

The browser receives only the two same-origin Pages routes and never the runner origin or any private credential. The Pages proxy derives identity from the verified Supabase access token, resolves the source through RLS, and calls the installed database RPCs. It never forwards the user JWT, user ID, email, role, source ownership state, private notes, or finalizer token to Hetzner. The runner receives only the reservation ID, client request ID, lease expiry, code hash, UTF-8 byte count, opaque reservation snapshot ID, language/file, selected code, and fixed policies.

The Pages proxy accepts only the canonical HTTPS `*.supabase.co` project origin with no credentials, port, path, query, or redirect. This prevents a configuration mistake from forwarding a user JWT to an arbitrary origin. A future Supabase custom domain would require a separately reviewed code/config change; it must not be added as a permissive wildcard or browser-controlled destination.

The runner requires two independent request boundaries: its constant-time bearer service-token check and a verified `Cf-Access-Jwt-Assertion`. It validates RS256, exact Access team issuer, exact application audience, time claims, and a signing key retrieved only from the configured team-domain `/cdn-cgi/access/certs` endpoint. Missing, malformed, expired, not-yet-valid, wrong-issuer, wrong-audience, unknown-key, or unverifiable assertions fail closed. The Pages Function supplies `CF-Access-Client-Id` and `CF-Access-Client-Secret` only to Access; these values are never runner configuration and are never returned to the browser.

`GET /health` on Pages requires a valid Supabase session and consults `current_user_sandbox_access()` before contacting the runner. Its public contract is deliberately small: `authentication_required`, `authentication_invalid`, `profile_required`, `account_inactive`, `sandbox_not_authorized`, `sandbox_disabled`, `sandbox_service_unavailable`, `runner_unavailable`, or sanitized `available`. A signed-in account without its established Commons Profile is intentionally denied with `profile_required`; the browser must present that prerequisite and the canonical `/commons-circle/setup/profile` action rather than claiming an internal failure. `source_unauthorized` and `origin_denied` remain request-specific run errors. UUIDs, user/profile content, credentials, internal paths, and stack details never enter these error envelopes.

`GET /health` on the runner is private and may expose bounded engine/image readiness only to the authenticated proxy/operator path. `POST /v1/runs` is the runner's only mutation route. Every other runner path or method is rejected; browser `Origin` requests are rejected.

## Fixed execution policy

Executable languages are Python, JavaScript, and TypeScript. JSON, YAML, Markdown, HTML, CSS, and text use static diagnostics only; shell and arbitrary command execution are disabled. Each live job is limited to 0.5 CPU, 256 MiB memory with no additional swap, 32 PIDs, 64 file descriptors, 16 MiB file size, two 16 MiB noexec tmpfs filesystems, five seconds, 65,536 stored output bytes, a 98,304-byte hard output-flood cutoff, and one active execution process with no in-process queue. A competing request receives 429 and `Retry-After`.

Source enters the container over stdin. There is no host bind mount. Jobs use `--network=none`, a read-only root, private IPC, dropped capabilities, `no-new-privileges`, numeric user `65534:65534`, `--pull=never`, and digest-pinned stripped images. No repository, home, vault, container socket, credential, package manager, or shell is mounted or available. Timeout, overflow, caller disconnect, shutdown, and startup all require verified container removal. Successful job source/output state is deleted before the execution slot is released; bounded interrupted remnants are cleaned at startup and by the 15-minute timer. Audit records contain only safe job/release identifiers and allowlisted sanitized metadata, rotate at 5 MiB with at most five rotations, and expire after the configured 1–30 day retention (14 days by default). They never contain raw source, credentials, JWTs, output bodies, or private context.

## 1. Preconditions and immutable local release

From the website repository, verify the reviewed branch and clean tree, run the complete test matrix, then package and verify:

```bash
git status --short
npm run test:routes
npm run test:security
npm run test:content
npm run test:commune
npm run test:addons
npm run test:sandbox-runner
npm run test:sandbox-access
npm run test:sandbox-finalizer
npm run test:sandbox-proxy
npm run test:sandbox-eligibility
npm run test:sandbox-production-gate
npm run test:sandbox-deployment
npm run test:sandbox-integration
npm run test:sandbox-database
npm run test:sandbox-database:disposable
npm run typecheck
npm run typecheck:functions
npm run build
git diff --check
npm run sandbox:release
npm run sandbox:verify-release -- services/sandbox-runner/release-output/<release-id>.tar.gz
```

The packaging command refuses a dirty tree. Transfer only the archive, its matching `.sha256` file, and the reviewed `install-verified-release.sh` from that same clean commit over the existing `elysia-admin` SSH path. Do not copy the website repository, `.env.local`, `.dev.vars`, an SSH key, or any production secret to the VPS.

## 2. Reconfirm the hardened VPS baseline

Use the existing non-root administrator. Do not re-enable root SSH or password authentication:

```bash
ssh elysia-admin@<SERVER_IP>
sudo whoami
sudo sshd -t
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|allowusers'
systemctl is-active ssh
systemctl is-enabled ssh
```

Expected effective policy includes `permitrootlogin no`, password and keyboard-interactive authentication disabled, public-key authentication enabled, and only `elysia-admin` allowed. Keep the Hetzner firewall limited to the administrative SSH rule. Do not open the runner port, 80, or 443 for this service; Cloudflare Tunnel initiates an outbound connection.

After the service account and packages exist, `deployment/host-preflight.sh` performs the same host/account prerequisite audit without changing the server. It fails unless Ubuntu 24.04, hardened SSH, a locked no-SSH execution account, Node 22+, cgroup v2, subordinate IDs, lingering, Podman, and the loopback listener boundary are present. The Hetzner firewall remains a separate read-only dashboard/CLI verification because this repository helper must not alter provider state.

## 3. Create the dedicated service account

Inspect existing IDs and subordinate ranges before selecting an unused range:

```bash
getent passwd elysia-sandbox
sudo cat /etc/subuid
sudo cat /etc/subgid
```

If absent, create a dedicated account with no password and no SSH authorization. Replace the subordinate range placeholders only after verifying that the range does not overlap another user:

```bash
sudo useradd --create-home --shell /bin/bash elysia-sandbox
sudo passwd --lock elysia-sandbox
sudo usermod --add-subuids <FREE_START>-<FREE_END> elysia-sandbox
sudo usermod --add-subgids <FREE_START>-<FREE_END> elysia-sandbox
sudo loginctl enable-linger elysia-sandbox
```

Use at least 65,536 subordinate IDs. Never add `elysia-sandbox` to the rootful `docker` group. Confirm ownership and mappings before continuing.

After enabling lingering, start the service account's user manager and define a scoped command array for every rootless engine and user-systemd command below. Repeat this small block after reconnecting over SSH:

```bash
sandbox_uid="$(id -u elysia-sandbox)"
sudo systemctl start "user@${sandbox_uid}.service"
sandbox_user=(sudo -u elysia-sandbox env HOME=/home/elysia-sandbox XDG_RUNTIME_DIR="/run/user/${sandbox_uid}" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${sandbox_uid}/bus")
```

## 4. Install Node and rootless engines from official sources

The release requires Node.js 22 or newer. Install a supported Node release from the operator-approved official distribution path and confirm `/usr/bin/node` is the intended binary. Do not use an unaudited convenience installer.

Install Podman and rootless prerequisites from Ubuntu's signed repository:

```bash
sudo apt update
sudo apt install -y podman uidmap slirp4netns fuse-overlayfs dbus-user-session
"${sandbox_user[@]}" podman info --format '{{.Host.Security.Rootless}}'
"${sandbox_user[@]}" podman system migrate
```

The first command must report `true`. Confirm cgroup v2 and the systemd cgroup manager. Follow the official Podman rootless documentation for any distribution-specific storage setting.

Docker is a cold standby only. Configure Docker's official Ubuntu APT repository, install the documented Engine packages including `docker-ce-rootless-extras`, and follow Docker's rootless-mode instructions as `elysia-sandbox`. Do not run the convenience script and do not grant access to the rootful socket. After its separate acceptance test, leave the rootless user service stopped and disabled:

```bash
"${sandbox_user[@]}" dockerd-rootless-setuptool.sh install
"${sandbox_user[@]}" systemctl --user disable --now docker.service docker.socket
```

The production environment must say `ELYSIA_SANDBOX_ENGINE=podman`. Activating Docker requires an intentional environment change and service restart; there is no automatic fallback. Official references:

Run `deployment/validate-rootless-podman.sh` as `elysia-sandbox` before any Podman acceptance test. During the separately controlled Docker certification only, point `DOCKER_HOST` at that account's exact `/run/user/<uid>/docker.sock` and run `deployment/validate-rootless-docker-standby.sh`; it rejects Docker-group membership and rootful/remote sockets, neutralizes TLS/context overrides during inspection, and requires rootless mode with cgroup v2. Stop Docker afterward and remove `DOCKER_HOST` before the normal Podman post-install verification.

- <https://podman.io/docs/installation>
- <https://docs.podman.io/en/latest/markdown/podman.1.html#rootless-mode>
- <https://docs.docker.com/engine/install/ubuntu/>
- <https://docs.docker.com/engine/security/rootless/>

## 5. Prepare immutable runtime images

Build `images/python.Containerfile` and `images/node.Containerfile` in an isolated release process using digest-pinned base images. Verify that the resulting images contain no shell, BusyBox userland, `npm`, `npx`, `pip`, `apk`, or other package installer. Publish them only to the approved private namespace, record their immutable digests, and pull those exact digest references as `elysia-sandbox` before execution is enabled.

Place a reviewed `registries.conf` and signature-policy configuration under the service account's containers configuration. The supplied policy is an example namespace allowlist, not cryptographic image signing; digest pinning, TLS, isolated build review, and filesystem inspection remain mandatory. Replace its example registry namespace before use. The runner itself always uses `--pull=never`.

## 6. Install the root-owned release and user services

Run the release installer through the administrator account. Packaging uses an explicit source allowlist, and the installer verifies the archive checksum, path shape, complete per-file/directory manifest coverage, release ID, and modes before updating `current`; it does not restart the service:

```bash
sudo bash <TRANSFERRED_INSTALLER_PATH>/install-verified-release.sh <release.tar.gz> <release.tar.gz.sha256>
sudo readlink -f /opt/elysia-sandbox-runner/current
sudo find /opt/elysia-sandbox-runner/current -xdev -not -user root -print
```

Create the writable runtime directories, then lock the service configuration and user-unit path to root. The service account may read `runner.env` through its group but may not rewrite its unit, kill switches, engine selection, image digests, or service token:

```bash
sudo install -d -m 0755 -o root -g root /home/elysia-sandbox/.config
sudo install -d -m 0750 -o root -g elysia-sandbox /home/elysia-sandbox/.config/elysia-sandbox-runner
sudo install -d -m 0700 -o elysia-sandbox -g elysia-sandbox /home/elysia-sandbox/.local/state/elysia-sandbox-runner
sudo install -d -m 0700 -o elysia-sandbox -g elysia-sandbox /home/elysia-sandbox/.local/share/containers
sudo install -d -m 0755 -o root -g root /home/elysia-sandbox/.config/systemd /home/elysia-sandbox/.config/systemd/user
sudo install -m 0644 -o root -g root /opt/elysia-sandbox-runner/current/services/sandbox-runner/deployment/systemd/*.service /home/elysia-sandbox/.config/systemd/user/
sudo install -m 0644 -o root -g root /opt/elysia-sandbox-runner/current/services/sandbox-runner/deployment/systemd/*.timer /home/elysia-sandbox/.config/systemd/user/
sudo install -m 0640 -o root -g elysia-sandbox /opt/elysia-sandbox-runner/current/services/sandbox-runner/.env.example /home/elysia-sandbox/.config/elysia-sandbox-runner/runner.env
```

Edit `runner.env` through the administrator’s privileged editor, enter values directly, and recheck ownership/mode afterward. Keep both execution switches false until database, Access, Tunnel, and all live acceptance tests are ready:

```bash
sudoedit /home/elysia-sandbox/.config/elysia-sandbox-runner/runner.env
sudo chown root:elysia-sandbox /home/elysia-sandbox/.config/elysia-sandbox-runner/runner.env
sudo chmod 0640 /home/elysia-sandbox/.config/elysia-sandbox-runner/runner.env
sudo find /home/elysia-sandbox/.config/systemd -not -user root -print
```

Then load and enable the cleanup timer; enable the runner only at the final activation checkpoint:

The outer runner and cleanup units grant cgroup delegation and write to rootless Podman storage because the unprivileged engine must create and remove cgroups and container layers. They intentionally cannot use systemd `NoNewPrivileges`: that would disable the `newuidmap`/`newgidmap` helpers required for subordinate IDs. The untrusted execution container still receives `no-new-privileges`, capability dropping, a non-root user, and every other fixed isolation flag. Treat a live user-unit acceptance test after reboot as mandatory.

These are hand-written systemd **user** units for a Node controller that launches short-lived `podman run --rm` jobs. They are not deprecated `podman generate systemd` output. A persistent-container Quadlet is intentionally not used: wrapping the controller in another container would require nested container control or an engine socket, both forbidden. If the architecture later gains a genuinely persistent Podman-managed container, use a reviewed rootless Quadlet for that new component rather than generated units.

No AppArmor profile is installed by this release. A custom container profile is conditional: add one only after it is reviewed and shown compatible with rootless Podman, the stripped runtime images, timeout cleanup, and the full acceptance suite. Do not paste an untested profile into production merely to claim an extra control.

```bash
"${sandbox_user[@]}" systemctl --user daemon-reload
"${sandbox_user[@]}" systemctl --user enable --now elysia-sandbox-cleanup.timer
"${sandbox_user[@]}" systemctl --user enable elysia-sandbox-runner.service
```

## 7. Preserve and verify the installed Supabase boundary

The migration-history repair and three additive migrations are complete. All four versions are aligned locally/remotely. They are immutable historical inputs now: do not re-run them, edit them, use `db push` to replay them, or repair their history again. The baseline remains disposable-database-only and must never execute against the existing production database.

The installed sandbox database boundary:

- adds code hashes, byte counts, idempotency keys, leases, execution/finalization timestamps, bounded results, and lifecycle constraints;
- uses an advisory lock for atomic per-user reservation and stale-run recovery;
- derives member/reviewer/administrator tiers from current server-side roles and enforces one active reservation plus conservative tiered hourly/daily quotas without weakening container isolation;
- rechecks every non-manual source association inside the `SECURITY DEFINER` reservation boundary and binds idempotent replays to the complete source/code metadata;
- adds narrowly scoped reserve/start/finalize RPCs;
- revokes direct run/diagnostic mutation and the old result-recording RPC from browser roles;
- stores only a SHA-256 hash for `SANDBOX_DB_FINALIZER_TOKEN` in the private schema; that hash intentionally remains NULL until the external acceptance gate is ready.

The operator helper `scripts/sandboxFinalizerTokenTool.mjs` can validate its contract without creating secret material (`npm run sandbox:finalizer:check`). Later, its explicit rotation mode uses OS cryptographic randomness, writes only new owner-only files outside the repository, emits hash-only transactional SQL, and verifies that exactly one private row was changed. Its revocation mode emits a separately verified NULL-hash transaction. The helper never connects to Supabase or accepts a raw token in argv. Do not invoke secret-producing modes until the external infrastructure is ready and an operator explicitly controls the private destination. After later manual initialization, the same raw value exists only as the Pages production secret; Supabase stores only its SHA-256 digest. The browser, runner, preview deployments, logs, and Git never receive it.

## 8. Configure Cloudflare Tunnel and Access

Create a named Cloudflare Tunnel and route `sandbox.elysiaecobotics.com` to `http://127.0.0.1:8788`. Install `cloudflared` from Cloudflare's official signed package source and run it as its persistent system service. Put the credential JSON only at its root-readable server path; never place it in the repository or release. The supplied `config.example.yml` ends with a mandatory `http_status:404` catch-all.

Before installing that configuration, run `deployment/cloudflared/validate-config.sh` against the operator-created private copy. It accepts exactly one sandbox hostname, exactly the loopback runner service, and the final 404 catch-all; it rejects symlinks and credential-like inline fields and invokes `cloudflared tunnel ingress validate` when the CLI is present.

Create a Cloudflare Access self-hosted application for the sandbox hostname with a Service Auth-only policy that permits only the Pages proxy's dedicated service token. The Pages Function sends `CF-Access-Client-Id` and `CF-Access-Client-Secret`; ordinary browser access, a wrong pair, or a missing pair must fail before reaching the tunnel origin. Configure the runner with the application's non-secret team issuer and AUD tag so it independently validates the resulting Access assertion at the origin. Direct tunnel/origin bypass must therefore fail even if the private bearer token were somehow known.

Confirm Access is enforced on the tunnel hostname, DNS is proxied, the origin remains loopback-only, and the Hetzner firewall has no public runner/HTTP/HTTPS application rule. Official references:

- <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/>
- <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/as-a-service/linux/>

## 9. Configure the existing Pages project

First verify the exact existing Pages project name and current build/deployment configuration in the Cloudflare dashboard or authenticated Wrangler account. Do not create a live `wrangler.jsonc` from the example until this is known.

For the production environment only, set ordinary variables and encrypted secrets described below. Preview must retain `SANDBOX_ENABLED=false` and `SANDBOX_DEPLOYMENT_ENV=preview`, and production secrets must not be added to preview. The production origin must be exactly `https://elysiaecobotics.com`; the service URL must be the Access-protected tunnel hostname.

Routine Pages deployments must not write environment variables. Snapshot the live production variable/binding names and types plus secret names (never secret values), compare them with the preceding known-good deployment, and deploy the reviewed artifact without altering control-plane state. The normal production contract is `SANDBOX_ENABLED=true` with `SANDBOX_DEPLOYMENT_ENV=production`; an unexpected mismatch is a stop-and-investigate condition. The checked-in `.dev.vars.example` and `wrangler.example.jsonc` are disabled development/preview scaffolds and are not evidence that production should be disabled.

Deploy the already verified clean application build through the established Pages workflow. Confirm `public/_routes.json` includes `/api/sandbox/*`, excludes the shared module path, and does not include `/api/billing/*`. This Pages project is website/sandbox-only: never configure `BILLING_*`, `STRIPE_*`, payment, webhook, payout, or `SUPABASE_SERVICE_ROLE_KEY` bindings here. The same-origin billing namespace belongs to the separately deployed billing Worker described in `stripe-test-mode-economic-system.md`; sharing a hostname does not permit sharing secret bindings. Cloudflare binding references:

- <https://developers.cloudflare.com/pages/functions/bindings/>
- <https://developers.cloudflare.com/pages/functions/routing/>

## 10. Live acceptance and final activation

Before public activation, run the live integration suite as `elysia-sandbox` against production-equivalent, non-production runtime state. It must prove Python, JavaScript, and TypeScript execution plus timeout, output, file-size, memory, PID, network, DNS, child-process/shell/package-manager refusal, caller-disconnect cleanup, and no-orphan enforcement under rootless Podman. Repeat separately under rootless Docker to certify cold standby, then return the environment to Podman and stop Docker. Static and mocked repository tests are not substitutes for these engine proofs. The suite permits an explicit `/tmp/elysia-sandbox-integration-*` runtime root for local preflight only; that exception is implemented solely in the test harness and is never accepted by the production service configuration.

Test the complete deployed path for anonymous, invalid user token, unauthorized source, wrong Access token, and wrong runner token failures; authenticated health sanitization; immediate `429` on concurrent runs; idempotent retry; stale lease recovery; database-finalization distinction; raw-data deletion; response redaction; preview disablement; and persistence after the administrator disconnects. Inspect the process/socket boundary:

```bash
"${sandbox_user[@]}" systemctl --user status elysia-sandbox-runner.service elysia-sandbox-cleanup.timer
sudo ss -ltnp
"${sandbox_user[@]}" podman ps --all
"${sandbox_user[@]}" find /home/elysia-sandbox/.local/state/elysia-sandbox-runner/jobs -mindepth 1 -maxdepth 2 -print
systemctl status cloudflared
```

For a new environment, only after every proof passes should the operator initialize the narrow finalizer credential, set both runner switches and the production Pages switch true, restart the user runner service, and deploy the production Pages binding change. Disconnect the administrator client, wait, then verify an authenticated health request and bounded run from an independent client. For the already activated production environment, repeat the authenticated health and bounded-run checks after releases while preserving the existing enabled state. Do not replay the initial activation procedure or rotate credentials during a routine application release.

### Mandatory post-deployment production release gate

`npm run sandbox:production-gate` is the canonical routine-release gate. It fails unless the tree is clean, `HEAD` equals `online/main`, the canonical Pages deployment is a clean successful `main` deployment of that exact commit, production has the exact reviewed variable/secret/service-binding names and types, `SANDBOX_ENABLED=true`, and preview has neither enabled execution nor production sandbox secrets. Its Cloudflare project request is read-only; the tool never changes a Pages setting.

The gate then proves four distinct server paths: anonymous health returns `authentication_required`; a governed signed-in profile-less fixture returns `profile_required` without reaching the runner; an eligible profile-backed fixture receives sanitized availability; and one small Python `manual_snapshot` run returns a UUID run ID, reaches `completed` plus `recordingStatus=recorded`, returns bounded output, and replays idempotently without a second execution. A successful runner result is returned only after the container removal check and temporary job removal path have completed; post-run authenticated health must also remain available. This complements, but does not replace, the direct rootless-Podman no-orphan inspection above.

No credential is accepted in argv or a checked-in file. Immediately before the gate, an operator creates three temporary regular files outside the repository with mode `0600`, owned by the current account, containing respectively a read-only Cloudflare Pages API token, a short-lived profile-less Supabase access token, and a short-lived eligible profile-backed Supabase access token. Provide only their absolute paths through these environment names:

- `CLOUDFLARE_API_TOKEN_FILE`
- `ELYSIA_SANDBOX_PROFILELESS_TOKEN_FILE`
- `ELYSIA_SANDBOX_ELIGIBLE_TOKEN_FILE`

Provide the non-secret account identifier through `CLOUDFLARE_ACCOUNT_ID`. Run `npm run sandbox:production-gate`, retain only its safe commit/deployment/run identifiers in the release record, then remove the three temporary credential files. Never paste credential contents into chat, a command argument, shell history, logs, documentation, or a report. The two acceptance accounts must be distinct and must continue through ordinary Auth, profile, account-lifecycle, quota, reservation, Access, finalizer, and runner controls; there is no bypass or magic account.

## 11. Rollback and kill switches

For a deliberate sandbox incident or maintenance shutdown, disable Pages execution first (`SANDBOX_ENABLED=false`), then set either runner execution switch false and restart the user service. Do not perform this kill-switch sequence as part of an ordinary website rollback or release. Terminate any active container and confirm removal. To roll back code, repoint `/opt/elysia-sandbox-runner/current` atomically to a previously verified root-owned release and restart; never modify a release directory in place. Database migrations are additive and should be remediated with a new reviewed migration, not destructive down-migration against run history.

Follow `docs/security/governed-sandbox-incident-response.md` for containment and credential rotation.

## Required names (values entered manually)

Production Pages variables:

- `SANDBOX_ENABLED`
- `SANDBOX_DEPLOYMENT_ENV`
- `SANDBOX_PUBLIC_ORIGIN`
- `SANDBOX_SERVICE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Production Pages encrypted secrets:

- `SANDBOX_SERVICE_TOKEN`
- `SANDBOX_DB_FINALIZER_TOKEN`
- `CLOUDFLARE_ACCESS_CLIENT_ID`
- `CLOUDFLARE_ACCESS_CLIENT_SECRET`

Runner secret:

- `ELYSIA_SANDBOX_SERVICE_TOKEN`

Runner non-secret Access trust identifiers:

- `ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN`
- `ELYSIA_SANDBOX_ACCESS_AUDIENCE`

Runner controls and non-secret settings:

- `ELYSIA_SANDBOX_MODE`
- `ELYSIA_SANDBOX_ENABLED`
- `ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION`
- `ELYSIA_SANDBOX_HOST`
- `ELYSIA_SANDBOX_PORT`
- `ELYSIA_SANDBOX_ENGINE`
- `ELYSIA_SANDBOX_RUNTIME_ROOT`
- `ELYSIA_SANDBOX_PYTHON_IMAGE`
- `ELYSIA_SANDBOX_NODE_IMAGE`
- `ELYSIA_SANDBOX_JOB_RETENTION_SECONDS`
- `ELYSIA_SANDBOX_AUDIT_RETENTION_DAYS`
- `DOCKER_HOST` only during explicit rootless-Docker cold-standby certification/activation

Tunnel credential:

- `CLOUDFLARED_TUNNEL_CREDENTIAL`

Never create a `VITE_` form of a private value. No Supabase service-role/secret key or billing/provider secret belongs in this Pages/sandbox architecture. Use `wrangler.example.jsonc` and `.dev.vars.example` only for this boundary; never merge the separate billing-Worker examples or local variables into them.
