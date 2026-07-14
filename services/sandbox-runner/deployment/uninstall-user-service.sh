#!/usr/bin/env bash
set -euo pipefail

apply=false
if [[ ${1:-} == --apply ]]; then
  apply=true
elif [[ $# -ne 0 ]]; then
  echo "usage: uninstall-user-service.sh [--apply]" >&2
  exit 2
fi

home=/home/elysia-sandbox
unit_dir=$home/.config/systemd/user
if ! $apply; then
  echo "PLAN stop and disable the runner and cleanup timer, then remove only the three copied user-unit files"
  echo "PLAN retain runner.env, runtime state, immutable releases, cloudflared configuration, and all credentials"
  echo "No host state changed. Re-run with --apply only during a reviewed deactivation."
  exit 0
fi
if [[ ${EUID} -ne 0 ]]; then
  echo "--apply requires the reviewed administrator through sudo." >&2
  exit 1
fi

uid=$(id -u elysia-sandbox)
sandbox_user=(sudo -u elysia-sandbox env HOME="$home" XDG_RUNTIME_DIR="/run/user/${uid}" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus")
"${sandbox_user[@]}" systemctl --user disable --now elysia-sandbox-runner.service elysia-sandbox-cleanup.timer
"${sandbox_user[@]}" systemctl --user stop elysia-sandbox-cleanup.service || true
rm -f -- "$unit_dir/elysia-sandbox-runner.service" "$unit_dir/elysia-sandbox-cleanup.service" "$unit_dir/elysia-sandbox-cleanup.timer"
"${sandbox_user[@]}" systemctl --user daemon-reload
echo "Runner user units removed. Releases, configuration, state, Tunnel, and credentials were retained."
