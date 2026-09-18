#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repository_root"

allow_dirty=false
if [[ "${1:-}" == "--allow-dirty" && "$#" -eq 1 ]]; then
  allow_dirty=true
elif [[ "$#" -ne 0 ]]; then
  echo "Production Pages build failed: usage: buildProductionPages.sh [--allow-dirty]" >&2
  exit 1
fi

if [[ "$allow_dirty" == false ]]; then
  [[ -z "$(git status --porcelain)" ]] || {
    echo "Production Pages build failed: production_release_requires_clean_tree" >&2
    exit 1
  }
  branch="$(git branch --show-current)"
  [[ -n "$branch" ]] || {
    echo "Production Pages build failed: production_release_requires_named_branch" >&2
    exit 1
  }
  head_commit="$(git rev-parse HEAD)"
  [[ "$(git rev-parse "online/$branch")" == "$head_commit" ]] || {
    echo "Production Pages build failed: production_release_requires_remote_branch_alignment" >&2
    exit 1
  }
  [[ "$(git rev-parse online/main)" == "$head_commit" ]] || {
    echo "Production Pages build failed: production_release_requires_online_main_alignment" >&2
    exit 1
  }
fi

lifecycle_turnstile_site_key="${VITE_TURNSTILE_SITE_KEY:-}"
[[ "$lifecycle_turnstile_site_key" =~ ^0x[0-9A-Za-z_-]{20,}$ ]] || {
  echo "Production Pages build failed: lifecycle_turnstile_site_key_missing_or_invalid" >&2
  exit 1
}
[[ "$lifecycle_turnstile_site_key" != "0x4AAAAAAECNSZYyGXT8LPJC" ]] || {
  echo "Production Pages build failed: lifecycle_turnstile_must_not_reuse_auth_widget" >&2
  exit 1
}
[[ "$lifecycle_turnstile_site_key" != "1x00000000000000000000AA" ]] || {
  echo "Production Pages build failed: lifecycle_turnstile_test_key_forbidden" >&2
  exit 1
}

node scripts/authProductionRelease.mjs validate-environment

VITE_BILLING_API_PUBLICATION=live \
VITE_AUTH_CAPTCHA_MODE=required \
VITE_AUTH_TURNSTILE_SITE_KEY=0x4AAAAAAECNSZYyGXT8LPJC \
VITE_TURNSTILE_SITE_KEY="$lifecycle_turnstile_site_key" \
  npm run build
VITE_TURNSTILE_SITE_KEY="$lifecycle_turnstile_site_key" \
  node scripts/authProductionRelease.mjs verify
node --input-type=module -e 'import fs from "node:fs"; if (!fs.readFileSync("dist/index.html", "utf8").includes(`name="elysia-billing-api-publication" content="live"`)) throw new Error("production_billing_publication_missing");'

if [[ "$allow_dirty" == true ]]; then
  echo "Local dirty-tree verification only; this artifact is not authorized for production upload."
fi
