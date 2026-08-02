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

VITE_AUTH_CAPTCHA_MODE=required \
VITE_AUTH_TURNSTILE_SITE_KEY=0x4AAAAAAECNSZYyGXT8LPJC \
  npm run build
node scripts/authProductionRelease.mjs verify

if [[ "$allow_dirty" == true ]]; then
  echo "Local dirty-tree verification only; this artifact is not authorized for production upload."
fi
