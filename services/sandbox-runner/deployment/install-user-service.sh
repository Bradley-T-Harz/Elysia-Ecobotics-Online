#!/usr/bin/env bash
set -euo pipefail

apply=false
if [[ ${1:-} == --apply ]]; then
  apply=true
elif [[ $# -ne 0 ]]; then
  echo "usage: install-user-service.sh [--apply]" >&2
  exit 2
fi

release=/opt/elysia-sandbox-runner/current/services/sandbox-runner
home=/home/elysia-sandbox
unit_dir=$home/.config/systemd/user
config_dir=$home/.config/elysia-sandbox-runner
state_dir=$home/.local/state/elysia-sandbox-runner

run() {
  if $apply; then
    "$@"
  else
    printf 'PLAN'
    printf ' %q' "$@"
    printf '\n'
  fi
}

if $apply && [[ ${EUID} -ne 0 ]]; then
  echo "--apply requires the reviewed administrator through sudo." >&2
  exit 1
fi

if $apply; then
  getent passwd elysia-sandbox >/dev/null
  [[ $(readlink -f /opt/elysia-sandbox-runner/current) == /opt/elysia-sandbox-runner/releases/* ]]
  [[ $(find "$(readlink -f /opt/elysia-sandbox-runner/current)" -xdev -not -user root -print -quit) == "" ]]
fi

run loginctl enable-linger elysia-sandbox
run install -d -m 0755 -o root -g root \
  "$home/.config" \
  "$home/.config/systemd" \
  "$unit_dir" \
  "$unit_dir/timers.target.wants" \
  "$unit_dir/default.target.wants"
run install -d -m 0750 -o root -g elysia-sandbox "$config_dir"
run install -d -m 0700 -o elysia-sandbox -g elysia-sandbox "$state_dir" "$home/.local/share/containers"
run install -m 0644 -o root -g root "$release/deployment/systemd/elysia-sandbox-runner.service" "$unit_dir/elysia-sandbox-runner.service"
run install -m 0644 -o root -g root "$release/deployment/systemd/elysia-sandbox-cleanup.service" "$unit_dir/elysia-sandbox-cleanup.service"
run install -m 0644 -o root -g root "$release/deployment/systemd/elysia-sandbox-cleanup.timer" "$unit_dir/elysia-sandbox-cleanup.timer"
run ln -sfn ../elysia-sandbox-cleanup.timer "$unit_dir/timers.target.wants/elysia-sandbox-cleanup.timer"
run ln -sfn ../elysia-sandbox-runner.service "$unit_dir/default.target.wants/elysia-sandbox-runner.service"

if $apply && [[ ! -e $config_dir/runner.env ]]; then
  install -m 0640 -o root -g elysia-sandbox "$release/.env.example" "$config_dir/runner.env"
elif ! $apply; then
  echo "PLAN create runner.env from .env.example only when runner.env is absent; never overwrite it"
fi

if $apply; then
  uid=$(id -u elysia-sandbox)
  systemctl start "user@${uid}.service"
  sandbox_user=(sudo -u elysia-sandbox env HOME="$home" XDG_RUNTIME_DIR="/run/user/${uid}" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${uid}/bus")
  "${sandbox_user[@]}" systemctl --user daemon-reload
  "${sandbox_user[@]}" systemctl --user start elysia-sandbox-cleanup.timer
  echo "User units installed. The runner was enabled for boot but not started; both execution switches remain operator-controlled."
else
  echo "PLAN reload the elysia-sandbox user manager, start only the cleanup timer, and enable (not start) the runner service"
  echo "No host state changed. Re-run with --apply only after reviewing this plan."
fi
