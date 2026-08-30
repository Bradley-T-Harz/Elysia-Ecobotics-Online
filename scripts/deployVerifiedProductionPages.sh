#!/usr/bin/env bash
set -euo pipefail

[[ "$#" -eq 0 ]] || {
  echo "Production Pages deploy failed: this command does not accept arguments" >&2
  exit 1
}

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repository_root"

[[ -z "$(git status --porcelain)" ]] || {
  echo "Production Pages deploy failed: production_release_requires_clean_tree" >&2
  exit 1
}
branch="$(git branch --show-current)"
[[ -n "$branch" ]] || {
  echo "Production Pages deploy failed: production_release_requires_named_branch" >&2
  exit 1
}
head_commit="$(git rev-parse HEAD)"
[[ "$(git rev-parse "online/$branch")" == "$head_commit" ]] || {
  echo "Production Pages deploy failed: production_release_requires_remote_branch_alignment" >&2
  exit 1
}
[[ "$(git rev-parse online/main)" == "$head_commit" ]] || {
  echo "Production Pages deploy failed: production_release_requires_online_main_alignment" >&2
  exit 1
}

lifecycle_turnstile_site_key="${VITE_TURNSTILE_SITE_KEY:-}"
[[ "$lifecycle_turnstile_site_key" =~ ^0x[0-9A-Za-z_-]{20,}$ ]] || {
  echo "Production Pages deploy failed: lifecycle_turnstile_site_key_missing_or_invalid" >&2
  exit 1
}

node scripts/authProductionRelease.mjs verify
wrangler_bin="$repository_root/node_modules/.bin/wrangler"
[[ -x "$wrangler_bin" ]] || {
  echo "Production Pages deploy failed: verified_wrangler_executable_missing" >&2
  exit 1
}
commit_message="$(git log -1 --pretty=%s)"
WRANGLER_WRITE_LOGS=false \
WRANGLER_LOG=log \
WRANGLER_LOG_SANITIZE=true \
  "$wrangler_bin" pages deploy dist \
    --project-name elysia-ecobotics-online \
    --branch main \
    --commit-hash "$head_commit" \
    --commit-message "$commit_message" \
    --commit-dirty=false
