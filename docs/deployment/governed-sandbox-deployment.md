# Governed sandbox deployment runbook

This runbook implements the production path without exposing an application port and without placing a Supabase service-role key anywhere in the browser, Pages Functions, or VPS. Perform production actions only after the repository is clean, every local check passes, the release bundle verifies, and an operator explicitly approves the deployment checkpoint.

Never paste a secret into source control, command history, chat, logs, or a deployment transcript. Enter values directly in the relevant masked dashboard field or mode-`0600` server file. The required secret names are listed at the end of this runbook; their values are deliberately absent.

## 1. Preconditions and immutable local release

From the website repository, verify the reviewed branch and clean tree, run the complete test matrix, then package and verify:

```bash
git status --short
npm run test:routes
npm run test:security
npm run test:content
npm run test:commune
npm run test:sandbox-runner
npm run test:sandbox-proxy
npm run test:sandbox-deployment
npm run test:sandbox-integration
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

No AppArmor profile is installed by this release. A custom container profile is conditional: add one only after it is reviewed and shown compatible with rootless Podman, the stripped runtime images, timeout cleanup, and the full acceptance suite. Do not paste an untested profile into production merely to claim an extra control.

```bash
"${sandbox_user[@]}" systemctl --user daemon-reload
"${sandbox_user[@]}" systemctl --user enable --now elysia-sandbox-cleanup.timer
"${sandbox_user[@]}" systemctl --user enable elysia-sandbox-runner.service
```

## 7. Apply the additive Supabase migration

Review and apply `supabase/migrations/2026_07_13_sandbox_proxy_access_and_reservation.sql` through the existing controlled migration workflow. It must be applied as a new migration, never by editing prior production migrations.

The migration:

- adds code hashes, byte counts, idempotency keys, leases, execution/finalization timestamps, bounded results, and lifecycle constraints;
- uses an advisory lock for atomic per-user reservation and stale-run recovery;
- derives member/reviewer/administrator tiers from current server-side roles and enforces one active reservation plus conservative tiered hourly/daily quotas without weakening container isolation;
- rechecks every non-manual source association inside the `SECURITY DEFINER` reservation boundary and binds idempotent replays to the complete source/code metadata;
- adds narrowly scoped reserve/start/finalize RPCs;
- revokes direct run/diagnostic mutation and the old result-recording RPC from browser roles;
- stores only a SHA-256 hash for `SANDBOX_DB_FINALIZER_TOKEN` in the private schema.

Generate the finalizer value outside the repository. Enter the same value directly into the production Pages secret and write only its digest to `private.sandbox_proxy_secrets` through a protected SQL operator session. Do not expose the private schema or grant browser roles access to it. Verify exact RPC overloads and grants after applying.

## 8. Configure Cloudflare Tunnel and Access

Create a named Cloudflare Tunnel and route `sandbox.elysiaecobotics.com` to `http://127.0.0.1:8788`. Install `cloudflared` from Cloudflare's official signed package source and run it as its persistent system service. Put the credential JSON only at its root-readable server path; never place it in the repository or release. The supplied `config.example.yml` ends with a mandatory `http_status:404` catch-all.

Create a Cloudflare Access application for the sandbox hostname with a Service Auth policy that permits only the Pages proxy's service token. The Pages Function sends `CF-Access-Client-Id` and `CF-Access-Client-Secret`; ordinary browser access, a wrong pair, or a missing pair must fail before reaching the tunnel origin.

Confirm Access is enforced on the tunnel hostname, DNS is proxied, the origin remains loopback-only, and the Hetzner firewall has no public runner/HTTP/HTTPS application rule. Official references:

- <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/>
- <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/as-a-service/linux/>

## 9. Configure the existing Pages project

First verify the exact existing Pages project name and current build/deployment configuration in the Cloudflare dashboard or authenticated Wrangler account. Do not create a live `wrangler.jsonc` from the example until this is known.

For the production environment only, set ordinary variables and encrypted secrets described below. Preview must retain `SANDBOX_ENABLED=false` and `SANDBOX_DEPLOYMENT_ENV=preview`, and production secrets must not be added to preview. The production origin must be exactly `https://elysiaecobotics.com`; the service URL must be the Access-protected tunnel hostname.

Deploy the already verified clean application build through the established Pages workflow. Confirm `public/_routes.json` includes `/api/sandbox/*` and excludes the shared module path. Cloudflare binding references:

- <https://developers.cloudflare.com/pages/functions/bindings/>
- <https://developers.cloudflare.com/pages/functions/routing/>

## 10. Live acceptance and final activation

Before public activation, run the live integration suite as `elysia-sandbox` against production-equivalent, non-production runtime state. It must prove Python, JavaScript, and TypeScript execution plus timeout, output, memory, PID, network, shell, cleanup, and no-orphan enforcement under rootless Podman. Repeat separately under rootless Docker to certify cold standby, then return the environment to Podman and stop Docker.

Test the complete deployed path for anonymous, invalid user token, unauthorized source, wrong Access token, and wrong runner token failures; authenticated health sanitization; immediate `429` on concurrent runs; idempotent retry; stale lease recovery; database-finalization distinction; raw-data deletion; response redaction; preview disablement; and persistence after the administrator disconnects. Inspect the process/socket boundary:

```bash
"${sandbox_user[@]}" systemctl --user status elysia-sandbox-runner.service elysia-sandbox-cleanup.timer
sudo ss -ltnp
"${sandbox_user[@]}" podman ps --all
"${sandbox_user[@]}" find /home/elysia-sandbox/.local/state/elysia-sandbox-runner/jobs -mindepth 1 -maxdepth 2 -print
systemctl status cloudflared
```

Only after every proof passes should the operator set both runner switches and the production Pages switch true, restart the user runner service, and deploy the production Pages binding change. Disconnect the ThinkPad, wait, then verify an authenticated health request and bounded run from an independent client.

## 11. Rollback and kill switches

Disable Pages execution first (`SANDBOX_ENABLED=false`), then set either runner execution switch false and restart the user service. Terminate any active container and confirm removal. To roll back code, repoint `/opt/elysia-sandbox-runner/current` atomically to a previously verified root-owned release and restart; never modify a release directory in place. Database migrations are additive and should be remediated with a new reviewed migration, not destructive down-migration against run history.

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

Tunnel credential:

- `CLOUDFLARED_TUNNEL_CREDENTIAL`

Never create a `VITE_` form of a private value. No Supabase service-role/secret key belongs in this architecture.
