# Developer Forge Workbench

The Developer Forge workbench is an inert add-on studio for preparing Elysia add-ons. It helps developers edit manifest and documentation files, inspect validation findings, preview Marketplace metadata, and submit immutable snapshots for review.

## What the workbench can do

- Edit virtual draft files such as `manifest.json`, `README.md`, `LICENSE`, and review-boundary notes.
- Use Monaco syntax highlighting when available, with a plain text fallback.
- Validate manifests with structured Ajv checks, URL format checks, and semver version checks.
- Preview Markdown through sanitized rendering with GitHub-flavored Markdown support.
- Format JSON and Markdown with Prettier on explicit command.
- Run static scans and package/archive inspection without executing package code.
- Export an inert `.elysia-addon` archive.
- Submit immutable review snapshots.
- Duplicate a locked draft for a revision.

## What the workbench must not do

- It must not run package code, scripts, build hooks, dependency hooks, or shell commands.
- It must not install, enable, disable, or control local Elysia.
- It must not access private local Elysia memory, logs, vaults, credentials, private repositories, or machine data.
- It must not expose private packages before review publication.
- It must not let developers approve, publish, revoke, or trust-label their own submissions.

## Snapshot rule

Marketplace reviewers inspect immutable submission snapshots. A snapshot captures the manifest, permissions, package facts, scan findings, validation results, and Marketplace preview at the time of submission. After submission, the original draft is locked from ordinary owner edits. Changes must happen through an explicit revision draft and resubmission.

## Safety language

Static scan is evidence, not proof. Checksums are integrity evidence, not cryptographic signing unless signing infrastructure is actually present. Marketplace publication is not local installation. Local Elysia remains the final verifier, installer, permission authority, runtime, and sandbox.
