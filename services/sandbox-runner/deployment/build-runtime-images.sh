#!/usr/bin/env bash
set -euo pipefail

mode=plan
if [[ ${1:-} == --execute ]]; then
  mode=execute
elif [[ $# -ne 0 ]]; then
  echo "usage: build-runtime-images.sh [--execute]" >&2
  exit 2
fi

if [[ ${EUID} -eq 0 ]]; then
  echo "Build runtime images with the unprivileged rootless Podman account." >&2
  exit 1
fi

python_base=${ELYSIA_SANDBOX_PYTHON_BASE_IMAGE:-}
node_base=${ELYSIA_SANDBOX_NODE_BASE_IMAGE:-}
python_output=${ELYSIA_SANDBOX_PYTHON_OUTPUT_IMAGE:-localhost/elysia-sandbox-python:review-candidate}
node_output=${ELYSIA_SANDBOX_NODE_OUTPUT_IMAGE:-localhost/elysia-sandbox-node:review-candidate}
digest_pattern='^[a-z0-9][a-z0-9._/-]*(:[a-z0-9._-]+)?@sha256:[0-9a-f]{64}$'
[[ $python_base =~ $digest_pattern ]]
[[ $node_base =~ $digest_pattern ]]
[[ $python_output != *:latest ]]
[[ $node_output != *:latest ]]

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)

if [[ $mode == plan ]]; then
  printf 'PLAN podman build --pull=never --build-arg BASE_IMAGE=%q --file %q --tag %q %q\n' "$python_base" "$root/images/python.Containerfile" "$python_output" "$root/images"
  printf 'PLAN podman build --pull=never --build-arg BASE_IMAGE=%q --file %q --tag %q %q\n' "$node_base" "$root/images/node.Containerfile" "$node_output" "$root/images"
  echo "No image was built. Re-run with --execute only in the reviewed isolated build environment."
  exit 0
fi

command -v podman >/dev/null
command -v tar >/dev/null
podman image exists "$python_base"
podman image exists "$node_base"
podman build --pull=never --build-arg "BASE_IMAGE=$python_base" --file "$root/images/python.Containerfile" --tag "$python_output" "$root/images"
podman build --pull=never --build-arg "BASE_IMAGE=$node_base" --file "$root/images/node.Containerfile" --tag "$node_output" "$root/images"

temporary=$(mktemp -d)
containers=()
cleanup() {
  for container in "${containers[@]:-}"; do podman rm --force "$container" >/dev/null 2>&1 || true; done
  rm -rf -- "$temporary"
}
trap cleanup EXIT

inspect_image() {
  local image=$1
  local archive=$2
  local container
  container=$(podman create --network=none "$image")
  containers+=("$container")
  podman export --output "$archive" "$container"
  if tar -tf "$archive" | grep -Eq '^(bin/(sh|ash|bash|dash|busybox)|sbin/(apk|busybox)|usr/bin/(sh|ash|bash|dash|busybox|apk|apt|apt-get)|usr/local/bin/(sh|ash|bash|dash|busybox|npm|npx|corepack|pip[^/]*)|usr/local/lib/node_modules/npm)(/|$)'; then
    echo "Forbidden shell or package tooling remains in $image." >&2
    exit 1
  fi
  [[ $(podman image inspect "$image" --format '{{.Config.User}}') == 65534:65534 ]]
}

inspect_image "$python_output" "$temporary/python.tar"
inspect_image "$node_output" "$temporary/node.tar"
printf '{"ok":true,"pythonImageId":"%s","nodeImageId":"%s","published":false}\n' \
  "$(podman image inspect "$python_output" --format '{{.Id}}')" \
  "$(podman image inspect "$node_output" --format '{{.Id}}')"
