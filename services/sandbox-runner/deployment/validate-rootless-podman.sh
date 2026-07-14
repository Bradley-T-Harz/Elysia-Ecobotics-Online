#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -eq 0 ]]; then
  echo "Run as the unprivileged elysia-sandbox service account, never root." >&2
  exit 1
fi

user_name=$(id -un)
if [[ $user_name != elysia-sandbox ]]; then
  echo "Expected the dedicated elysia-sandbox account." >&2
  exit 1
fi

command -v getent >/dev/null
command -v node >/dev/null
command -v podman >/dev/null
[[ $(stat -fc %T /sys/fs/cgroup) == cgroup2fs ]]

subid_total() {
  local database=$1
  local file=$2
  local value
  value=$(getent "$database" "$user_name" 2>/dev/null || awk -F: -v user="$user_name" '$1 == user { print }' "$file")
  awk -F: 'BEGIN { total=0 } { total += $3 } END { print total+0 }' <<<"$value"
}
subuid_count=$(subid_total subuid /etc/subuid)
subgid_count=$(subid_total subgid /etc/subgid)
[[ $subuid_count -ge 65536 ]]
[[ $subgid_count -ge 65536 ]]

if id -nG | tr ' ' '\n' | grep -Fxq docker; then
  echo "elysia-sandbox must not belong to the rootful docker group." >&2
  exit 1
fi

podman_info=$(podman info --format json)
node -e '
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const info = JSON.parse(Buffer.concat(chunks));
    if (info?.host?.security?.rootless !== true || String(info?.host?.cgroupVersion) !== "v2") process.exit(1);
  });
' <<<"$podman_info"
podman unshare true
podman ps --all --filter label=io.elysia.sandbox=true --format '{{.Names}}' >/dev/null

echo '{"ok":true,"account":"elysia-sandbox","rootless":true,"cgroupVersion":"v2","subordinateIds":true}'
