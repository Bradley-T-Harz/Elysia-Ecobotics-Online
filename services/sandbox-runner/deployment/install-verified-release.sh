#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer through sudo from the verified administrator account." >&2
  exit 1
fi

if [[ $# -ne 2 ]]; then
  echo "usage: install-verified-release.sh <release.tar.gz> <release.tar.gz.sha256>" >&2
  exit 2
fi

archive=$(readlink -f -- "$1")
checksum=$(readlink -f -- "$2")
install_root=/opt/elysia-sandbox-runner
releases_root=${install_root}/releases
staging=$(mktemp -d /opt/elysia-sandbox-stage.XXXXXXXX)
trap 'rm -rf -- "$staging"' EXIT

test -f "$archive"
test -f "$checksum"
test "$(basename -- "$checksum")" = "$(basename -- "$archive").sha256"
command -v sha256sum >/dev/null
command -v tar >/dev/null
getent passwd elysia-sandbox >/dev/null

checksum_name=$(basename -- "$archive")
test "$(wc -l < "$checksum")" -eq 1
expected=$(awk -v name="$checksum_name" 'NF == 2 && $1 ~ /^[0-9a-f]{64}$/ && $2 == name { print $1 }' "$checksum")
test -n "$expected"
actual=$(sha256sum "$archive" | awk '{ print $1 }')
test "$actual" = "$expected"

declare -A archive_entries=()
archive_entry_count=0
while IFS= read -r entry; do
  archive_entry_count=$((archive_entry_count + 1))
  test "$archive_entry_count" -le 2000
  if [[ -n ${archive_entries[$entry]+present} ]]; then
    echo "Release archive contains a duplicate path." >&2
    exit 1
  fi
  archive_entries[$entry]=1
  case "$entry" in
    bundle/*|bundle) ;;
    *) echo "Release archive contains an invalid path." >&2; exit 1 ;;
  esac
  case "/$entry/" in
    *"/../"*) echo "Release archive contains path traversal." >&2; exit 1 ;;
  esac
done < <(tar -tzf "$archive")

while IFS= read -r entry; do
  case "${entry:0:1}" in
    -|d) ;;
    *) echo "Release archive contains a link or special file." >&2; exit 1 ;;
  esac
done < <(tar -tzvf "$archive")

tar -xzf "$archive" -C "$staging" --no-same-owner --no-same-permissions
bundle=${staging}/bundle
test -f "${bundle}/RELEASE-MANIFEST.sha256"
test -f "${bundle}/RELEASE-METADATA.json"
grep -Eq '"dirty"[[:space:]]*:[[:space:]]*false' "${bundle}/RELEASE-METADATA.json" || {
  echo "Dirty-tree releases cannot be installed." >&2
  exit 1
}
declare -A manifest_files=()
declare -A manifest_directories=()
manifest_file_count=0
while IFS= read -r line; do
  if [[ ! $line =~ ^[0-9a-f]{64}\ \ (.+)$ ]]; then
    echo "Release manifest is malformed." >&2
    exit 1
  fi
  manifest_path=${BASH_REMATCH[1]}
  case "$manifest_path" in
    services/sandbox-runner/*) ;;
    *) echo "Release manifest contains an invalid path." >&2; exit 1 ;;
  esac
  case "/$manifest_path/" in
    *"/../"*|*"//"*) echo "Release manifest contains an invalid path." >&2; exit 1 ;;
  esac
  if [[ -n ${manifest_files[$manifest_path]+present} ]]; then
    echo "Release manifest contains a duplicate path." >&2
    exit 1
  fi
  manifest_files[$manifest_path]=1
  manifest_file_count=$((manifest_file_count + 1))
  parent_path=$(dirname -- "$manifest_path")
  while [[ $parent_path != "." ]]; do
    manifest_directories[$parent_path]=1
    parent_path=$(dirname -- "$parent_path")
  done
done < "${bundle}/RELEASE-MANIFEST.sha256"
(
  cd "$bundle"
  sha256sum --strict --check RELEASE-MANIFEST.sha256
)

extracted_file_count=0
while IFS= read -r -d '' extracted_file; do
  extracted_path=${extracted_file#"${bundle}/"}
  case "$extracted_path" in
    RELEASE-MANIFEST.sha256|RELEASE-METADATA.json) continue ;;
  esac
  if [[ -z ${manifest_files[$extracted_path]+present} ]]; then
    echo "Release contains an unmanifested file." >&2
    exit 1
  fi
  extracted_file_count=$((extracted_file_count + 1))
done < <(find "$bundle" -type f -print0)
test "$extracted_file_count" -eq "$manifest_file_count"
while IFS= read -r -d '' extracted_directory; do
  extracted_path=${extracted_directory#"${bundle}/"}
  if [[ -z ${manifest_directories[$extracted_path]+present} ]]; then
    echo "Release contains an unmanifested directory." >&2
    exit 1
  fi
done < <(find "$bundle" -mindepth 1 -type d -print0)

release_id=$(sed -n 's/^[[:space:]]*"releaseId":[[:space:]]*"\(sandbox-[0-9a-f]\{20\}\)".*/\1/p' "${bundle}/RELEASE-METADATA.json")
test -n "$release_id"
manifest_release_id="sandbox-$(sha256sum "${bundle}/RELEASE-MANIFEST.sha256" | awk '{ print substr($1, 1, 20) }')"
test "$release_id" = "$manifest_release_id"
destination=${releases_root}/${release_id}
if [[ -e "$destination" ]]; then
  echo "Release already exists: $release_id" >&2
  exit 1
fi

install -d -m 0755 -o root -g root "$install_root" "$releases_root"
mv -- "$bundle" "$destination"
chown -R root:root "$destination"
find "$destination" -type d -exec chmod 0755 {} +
find "$destination" -type f -exec chmod 0644 {} +
next_link=${install_root}/.current.${release_id}.$$
ln -s -- "${destination}" "$next_link"
mv -Tf -- "$next_link" "${install_root}/current"

echo "Installed and activated immutable release: $release_id"
echo "Service restart remains a separate, explicit operator action."
