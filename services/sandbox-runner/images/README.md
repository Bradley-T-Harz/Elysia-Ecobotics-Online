# Minimal sandbox runtime images

Production does not use mutable upstream language images directly. Each Containerfile takes an upstream base reference that has already been pinned by digest, then removes shells, BusyBox userland, package managers, package installers, and root caches. The final image runs as numeric user `65534:65534`, receives source only over stdin, and is invoked only with the runner's fixed argv.

Build in an isolated release process, inspect the resulting filesystem, run the deployment acceptance suite, publish to the operator-approved registry, and place the resulting immutable `name@sha256:...` references directly in the server environment file. Never substitute a tag or enable automatic pulls in the runner service.

The production acceptance gate must verify that `/bin/sh`, `/bin/ash`, `/bin/busybox`, `npm`, `npx`, `pip`, and `apk` are absent before enabling public execution.
