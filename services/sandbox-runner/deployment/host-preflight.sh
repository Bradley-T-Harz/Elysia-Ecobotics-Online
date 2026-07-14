#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run through the reviewed elysia-admin sudo path; this check is read-only." >&2
  exit 1
fi

source /etc/os-release
[[ ${ID:-} == ubuntu && ${VERSION_ID:-} == 24.04 ]]

command -v sshd >/dev/null
sshd_effective=$(sshd -T)
grep -Fxq 'permitrootlogin no' <<<"$sshd_effective"
grep -Fxq 'passwordauthentication no' <<<"$sshd_effective"
grep -Fxq 'kbdinteractiveauthentication no' <<<"$sshd_effective"
grep -Fxq 'pubkeyauthentication yes' <<<"$sshd_effective"
grep -Fxq 'allowusers elysia-admin' <<<"$sshd_effective"

getent passwd elysia-admin >/dev/null
getent passwd elysia-sandbox >/dev/null
[[ $(getent passwd elysia-sandbox | cut -d: -f6) == /home/elysia-sandbox ]]
[[ $(passwd -S elysia-sandbox | awk '{print $2}') == L ]]
if [[ -s /home/elysia-sandbox/.ssh/authorized_keys ]]; then
  echo "The execution service account must not accept SSH keys." >&2
  exit 1
fi
if id -nG elysia-sandbox | tr ' ' '\n' | grep -Fxq docker; then
  echo "elysia-sandbox must not belong to the rootful docker group." >&2
  exit 1
fi

for command_name in node podman newuidmap newgidmap loginctl systemctl ss; do
  command -v "$command_name" >/dev/null
done
node -e 'const major = Number(process.versions.node.split(".")[0]); if (!Number.isInteger(major) || major < 22) process.exit(1)'
[[ -e /var/lib/systemd/linger/elysia-sandbox ]]
[[ $(stat -fc %T /sys/fs/cgroup) == cgroup2fs ]]

subid_total() {
  local database=$1
  local file=$2
  local value
  value=$(getent "$database" elysia-sandbox 2>/dev/null || awk -F: '$1 == "elysia-sandbox" { print }' "$file")
  awk -F: 'BEGIN { total=0 } { total += $3 } END { print total+0 }' <<<"$value"
}
[[ $(subid_total subuid /etc/subuid) -ge 65536 ]]
[[ $(subid_total subgid /etc/subgid) -ge 65536 ]]

if ss -H -ltn 'sport = :8788' | awk '{print $4}' | grep -Evq '^(127\.0\.0\.1|\[::1\]):8788$'; then
  echo "Runner port 8788 is listening on a non-loopback address." >&2
  exit 1
fi

echo '{"ok":true,"readOnly":true,"ubuntu":"24.04","sshHardened":true,"serviceAccountLocked":true,"subordinateIds":true,"cgroupVersion":"v2","loopbackOnly":true}'
