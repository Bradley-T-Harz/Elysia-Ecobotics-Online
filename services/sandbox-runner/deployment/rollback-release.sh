#!/usr/bin/env bash
set -euo pipefail

apply=false
if [[ ${1:-} == --apply ]]; then
  apply=true
  shift
fi
if [[ $# -ne 1 || ! $1 =~ ^sandbox-[0-9a-f]{20}$ ]]; then
  echo "usage: rollback-release.sh [--apply] sandbox-<20-hex-release-id>" >&2
  exit 2
fi

release_id=$1
destination=/opt/elysia-sandbox-runner/releases/$release_id
[[ -d $destination ]]
[[ $(find "$destination" -xdev -not -user root -print -quit) == "" ]]
(
  cd "$destination"
  sha256sum --strict --check RELEASE-MANIFEST.sha256 >/dev/null
)

if ! $apply; then
  echo "PLAN atomically repoint /opt/elysia-sandbox-runner/current to $destination"
  echo "No symlink or service changed. Re-run with --apply after review."
  exit 0
fi
if [[ ${EUID} -ne 0 ]]; then
  echo "--apply requires the reviewed administrator through sudo." >&2
  exit 1
fi
next=/opt/elysia-sandbox-runner/.current.$release_id.$$
trap 'rm -f -- "$next"' EXIT
ln -s -- "$destination" "$next"
mv -Tf -- "$next" /opt/elysia-sandbox-runner/current
echo "Release pointer changed to $release_id. No service was restarted."
