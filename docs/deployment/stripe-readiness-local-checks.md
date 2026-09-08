# Local financial-readiness checks

These checks exercise the existing optional support, independent giving and creator Marketplace boundaries with synthetic data. They do not deploy, apply remote migrations, create provider resources, contact a provider or enable transactions.

Run from the repository root with the existing installed dependencies:

```sh
node scripts/runReadinessChecks.mjs billing
node scripts/runReadinessChecks.mjs readiness
node scripts/runReadinessChecks.mjs legal
node scripts/runReadinessChecks.mjs functions
node scripts/runReadinessChecks.mjs build
node scripts/runReadinessChecks.mjs regression
node scripts/runReadinessChecks.mjs integration
node scripts/runReadinessChecks.mjs baseline
node scripts/runReadinessChecks.mjs publication
node scripts/runReadinessChecks.mjs browser
node scripts/runReadinessChecks.mjs publicationBrowser
```

The wrapper passes a small explicit environment, does not load `.env` files, blocks external Node network requests, and uses public synthetic build configuration. Browser checks refuse external services. Integration checks require an already cached PostgreSQL image and use a disposable Podman database with no network, no image pull and bounded resources. Do not substitute a real database connection.

Build before regression checks. Build the baseline and publication preview before either browser check. Baseline, publication and browser evidence defaults to the system temporary directory under `elysia-readiness-checks`. To preserve each run separately, pass the same explicit `--output /absolute/path/outside/the/repository` argument to those four commands. The scripts do not select private coordination folders automatically. Keep evidence outside version control.

The before-change baseline is pinned to `c04260585e237e213d10e0220d964a09e4f0bbcf`, so later commits cannot silently redefine it. That Git object must be available locally; a shallow clone without it will fail rather than fetch automatically. Publication preparation overlays 23 current public source files on that baseline and retains the old stewardship upload workflow. Its generated manifest describes that run, not approval for future source changes. Compare it against the reviewed scope before considering a separate publication. **Never deploy the generated synthetic `dist`.**

The September 8 public legal revision has been published. `prepareReadinessLegal.mjs --check` verifies its semantic hashes, inactive bundle manifest and staged migration without writing them. Its former `--write-unpublished` mode is disabled. Future policy edits require a new version and migration; preserve historical hashes and acceptances.

The three September 8 migrations are source preparation only. No check applies them remotely or switches active legal pointers, starts receipt delivery, enables billing or Connect, schedules retention deletion, or dispatches settlements. Settlement and retention settings remain proposals; the settlement dispatcher refuses execution.

Version control contains source, public legal archives/manifests, inactive migration definitions, synthetic fixtures, regression scripts and this reusable guide. Owner facts, unresolved decisions, provider correspondence, deployment logs, screenshots, source snapshots, configuration copies and private activation/rollback runbooks belong in the separate coordination evidence directory. Do not copy that private packet into this repository.
