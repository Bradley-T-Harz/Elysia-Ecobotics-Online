# Runner deployment artifacts

These files operate the existing governed runner; they do not create a second execution architecture. Run every mutating helper through the reviewed `elysia-admin` path. Helpers that can change the host default to a printed plan and require `--apply`.

The outer runner is a Node.js process that starts short-lived rootless Podman jobs. It therefore uses a systemd **user service**, not a generated Podman service and not a container with a Podman/Docker socket. Quadlet remains the preferred pattern for persistent containers, but it is intentionally not used to wrap this process because doing so would require nested container control or an engine socket. The execution jobs themselves are ephemeral, fixed-argument `podman run --rm` processes.

Artifacts:

- `host-preflight.sh` is a read-only administrator check for Ubuntu 24.04, hardened SSH, locked service-account state, Node, cgroup v2, subordinate IDs, lingering, and loopback-only port state.
- `validate-rootless-podman.sh` verifies the unprivileged account, subordinate IDs, cgroup v2, rootless Podman, and absence of rootful Docker-group authority.
- `validate-rootless-docker-standby.sh` verifies that an explicitly selected cold standby uses only the service account's rootless Docker socket and never rootful Docker-group authority. It does not start Docker or change the production engine.
- `build-runtime-images.sh` builds from already-present digest-pinned bases and inspects exported filesystems for forbidden shells and package tools.
- `install-user-service.sh` installs root-owned user units without overwriting an existing environment file or starting execution.
- `post-install-verify.sh` performs non-secret release, configuration, socket, unit, and rootless-engine checks.
- `rollback-release.sh` atomically repoints `current` to a previously verified immutable release; it never restarts the service.
- `uninstall-user-service.sh` stops and removes only copied user units. It deliberately retains releases, runtime evidence, environment files, cloudflared, and credentials for explicit incident handling.
- `cloudflared/validate-config.sh` checks the single loopback ingress and mandatory 404 catch-all before using cloudflared's own validator.
- `cloudflare/access-contract.example.json` is a non-deployable assertion checklist, not an API payload.

None of these helpers installs packages, changes SSH, changes a firewall, creates a Tunnel or Access object, initializes the database finalizer, or enables public execution.
