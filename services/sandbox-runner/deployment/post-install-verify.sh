#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run through the reviewed administrator with sudo; this script is read-only." >&2
  exit 1
fi

release=$(readlink -f /opt/elysia-sandbox-runner/current)
[[ $release == /opt/elysia-sandbox-runner/releases/sandbox-* ]]
[[ $(find "$release" -xdev -not -user root -print -quit) == "" ]]
(
  cd "$release"
  sha256sum --strict --check RELEASE-MANIFEST.sha256 >/dev/null
)

home=/home/elysia-sandbox
env_file=$home/.config/elysia-sandbox-runner/runner.env
[[ $(stat -c '%U:%G:%a' "$env_file") == root:elysia-sandbox:640 ]]
single_exact() { [[ $(grep -Fxc -- "$1" "$env_file") -eq 1 ]]; }
single_match() { [[ $(grep -Ec -- "$1" "$env_file") -eq 1 ]]; }
single_key() { [[ $(grep -Ec -- "^${1}=" "$env_file") -eq 1 ]]; }
for key in \
  ELYSIA_SANDBOX_MODE ELYSIA_SANDBOX_ENABLED ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION \
  ELYSIA_SANDBOX_HOST ELYSIA_SANDBOX_PORT ELYSIA_SANDBOX_ENGINE \
  ELYSIA_SANDBOX_PYTHON_IMAGE ELYSIA_SANDBOX_NODE_IMAGE ELYSIA_SANDBOX_SERVICE_TOKEN \
  ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN ELYSIA_SANDBOX_ACCESS_AUDIENCE; do
  single_key "$key"
done
single_exact 'ELYSIA_SANDBOX_MODE=production'
single_exact 'ELYSIA_SANDBOX_ENABLED=false'
single_exact 'ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION=false'
single_exact 'ELYSIA_SANDBOX_HOST=127.0.0.1'
single_exact 'ELYSIA_SANDBOX_PORT=8788'
single_exact 'ELYSIA_SANDBOX_ENGINE=podman'
single_match '^ELYSIA_SANDBOX_PYTHON_IMAGE=[a-z0-9][a-z0-9._/-]*(:[a-z0-9._-]+)?@sha256:[0-9a-f]{64}$'
single_match '^ELYSIA_SANDBOX_NODE_IMAGE=[a-z0-9][a-z0-9._/-]*(:[a-z0-9._-]+)?@sha256:[0-9a-f]{64}$'
single_match '^ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN=https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$'
single_match '^ELYSIA_SANDBOX_ACCESS_AUDIENCE=[A-Za-z0-9_-]{16,256}$'
if grep -Eq '^(SANDBOX_DB_FINALIZER_TOKEN|CLOUDFLARE_ACCESS_CLIENT_ID|CLOUDFLARE_ACCESS_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|DOCKER_HOST)=' "$env_file"; then
  echo "Runner environment contains a forbidden proxy/database credential or standby socket setting." >&2
  exit 1
fi
service_token=$(sed -n 's/^ELYSIA_SANDBOX_SERVICE_TOKEN=//p' "$env_file")
[[ ${#service_token} -ge 32 && ${#service_token} -le 512 && $service_token != *ENTER_DIRECTLY* && $service_token != *REPLACE* && $service_token != *$'\n'* ]]
unset service_token

for unit in elysia-sandbox-runner.service elysia-sandbox-cleanup.service elysia-sandbox-cleanup.timer; do
  [[ $(stat -c '%U:%G:%a' "$home/.config/systemd/user/$unit") == root:root:644 ]]
done

uid=$(id -u elysia-sandbox)
sandbox_user=(sudo -u elysia-sandbox env HOME="$home" XDG_RUNTIME_DIR="/run/user/${uid}" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus")
"${sandbox_user[@]}" bash "$release/services/sandbox-runner/deployment/validate-rootless-podman.sh" >/dev/null
"${sandbox_user[@]}" systemctl --user is-enabled elysia-sandbox-cleanup.timer >/dev/null
"${sandbox_user[@]}" systemctl --user is-enabled elysia-sandbox-runner.service >/dev/null

if ss -H -ltn 'sport = :8788' | awk '{print $4}' | grep -Evq '^(127\.0\.0\.1|\[::1\]):8788$'; then
  echo "Runner port 8788 is listening on a non-loopback address." >&2
  exit 1
fi

/usr/bin/node --check "$release/services/sandbox-runner/server.mjs"
/usr/bin/node --check "$release/services/sandbox-runner/accessValidator.mjs"
echo '{"ok":true,"releaseVerified":true,"rootlessPodman":true,"loopbackOnly":true,"executionEnabled":false}'
