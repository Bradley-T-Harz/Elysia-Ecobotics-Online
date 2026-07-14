#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: validate-config.sh <cloudflared-config.yml>" >&2
  exit 2
fi
requested_config=$1
[[ -f $requested_config && ! -L $requested_config ]]
config=$(readlink -f -- "$requested_config")
tunnel_id=$(sed -n 's/^[[:space:]]*tunnel:[[:space:]]*\([0-9a-fA-F-]*\)[[:space:]]*$/\1/p' "$config")
[[ $tunnel_id =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]
[[ $(grep -Ec "^[[:space:]]*credentials-file:[[:space:]]+/etc/cloudflared/${tunnel_id}\\.json[[:space:]]*$" "$config") -eq 1 ]]
[[ $(grep -Ec '^[[:space:]]*-[[:space:]]+hostname:[[:space:]]+sandbox\.elysiaecobotics\.com[[:space:]]*$' "$config") -eq 1 ]]
[[ $(grep -Ec '^[[:space:]]+service:[[:space:]]+http://127\.0\.0\.1:8788[[:space:]]*$' "$config") -eq 1 ]]
[[ $(grep -Ec '^[[:space:]]*-[[:space:]]+service:[[:space:]]+http_status:404[[:space:]]*$' "$config") -eq 1 ]]
[[ $(grep -Ec '^[[:space:]]*-[[:space:]]+hostname:' "$config") -eq 1 ]]
[[ $(grep -Ec '^[[:space:]]+connectTimeout:[[:space:]]+5s[[:space:]]*$' "$config") -eq 1 ]]
[[ $(grep -Ec '^[[:space:]]+noTLSVerify:[[:space:]]+false[[:space:]]*$' "$config") -eq 1 ]]
if grep -Eqi '(client[_-]?secret|service[_-]?token|authorization:[[:space:]]*bearer|private[_-]?key)' "$config"; then
  echo "Tunnel configuration contains forbidden credential-like inline material." >&2
  exit 1
fi
if command -v cloudflared >/dev/null; then
  cloudflared --config "$config" tunnel ingress validate
else
  echo "Static Tunnel contract valid; cloudflared CLI validation remains required on the prepared server."
fi
