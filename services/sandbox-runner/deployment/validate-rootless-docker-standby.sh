#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -eq 0 ]]; then
  echo "Run as the unprivileged elysia-sandbox service account, never root." >&2
  exit 1
fi

user_name=$(id -un)
uid=$(id -u)
if [[ $user_name != elysia-sandbox ]]; then
  echo "Expected the dedicated elysia-sandbox account." >&2
  exit 1
fi

if id -nG | tr ' ' '\n' | grep -Fxq docker; then
  echo "elysia-sandbox must not belong to the rootful docker group." >&2
  exit 1
fi

expected_host="unix:///run/user/${uid}/docker.sock"
if [[ ${DOCKER_HOST:-} != "$expected_host" ]]; then
  echo "DOCKER_HOST must identify only the elysia-sandbox rootless user socket." >&2
  exit 1
fi

command -v docker >/dev/null
command -v node >/dev/null
docker_info=$(env -u DOCKER_CONTEXT -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker info --format '{{json .}}')
node -e '
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const info = JSON.parse(Buffer.concat(chunks));
    const rootless = Array.isArray(info.SecurityOptions)
      && info.SecurityOptions.some((entry) => /rootless/i.test(String(entry)));
    if (!rootless || String(info.CgroupVersion) !== "2") process.exit(1);
  });
' <<<"$docker_info"
env -u DOCKER_CONTEXT -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker ps --all --filter label=io.elysia.sandbox=true --format '{{.Names}}' >/dev/null

echo '{"ok":true,"account":"elysia-sandbox","engine":"docker","coldStandby":true,"rootless":true,"cgroupVersion":"v2"}'
