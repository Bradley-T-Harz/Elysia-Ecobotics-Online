# Elysia governed sandbox runner

This package is the private Hetzner execution boundary for Coding Cornucopia. It listens only on `127.0.0.1:8788`, accepts authenticated requests from the Cloudflare Pages proxy through Cloudflare Tunnel and Access, and executes at most one run at a time in a locked-down rootless container. It is never a browser-facing API.

Production uses rootless Podman only. Rootless Docker is a separately selected, manually tested cold standby; the runner never chooses or falls back to another engine automatically.

## Security invariants

- `ELYSIA_SANDBOX_SERVICE_TOKEN` is required and compared in constant time after hashing.
- Production images must be fully qualified immutable `name@sha256:<digest>` references and already exist locally. Pulling is disabled.
- Each run has no network or DNS path, a read-only root, dropped capabilities, `no-new-privileges`, a non-root container user, a private PID/IPC namespace, fixed CPU/memory/PID/time/output/file-size limits, and bounded in-container tmpfs workspaces only.
- The runner passes fixed argument arrays with `shell: false` and writes source to the container process over stdin. It provides no package manager, shell, host-execution fallback, host source bind mount, repository mount, home mount, vault mount, engine-socket mount, or credential mount.
- One run owns the execution slot. A second request immediately receives `429 Busy` with `Retry-After`; there is no in-process queue.
- Timeout and output-overflow paths kill and forcibly remove the container before releasing the slot.
- While a job is running, the service reads only its validated cgroup-v2 directory and records bounded `cpu.stat` usage, `memory.peak`, `pids.peak`, and `memory.events` OOM evidence. Missing or malformed kernel counters become `null`; they never become invented "actual" usage. An observed `oom_kill` is reported as `memory_exceeded`.
- Successful run input and raw output are deleted immediately. Failed/interrupted run data is bounded and cleaned at startup and by the periodic timer.
- Health details require the private service token. The public Pages health endpoint returns only `available` or `unavailable`.

## Service contract

Every request requires both `Authorization: Bearer <ELYSIA_SANDBOX_SERVICE_TOKEN>` and a valid Cloudflare Access assertion in `Cf-Access-Jwt-Assertion`; browser `Origin` requests are rejected. The origin verifies RS256, exact issuer, audience, time bounds, and the signing key from the configured team-domain JWKS. Missing, malformed, stale, wrong-issuer, wrong-audience, or unknown-key assertions fail closed.

- `GET /health` — private engine/image/readiness detail for the Pages proxy and operator.
- `POST /v1/runs` — a strict, bounded snapshot selected and authorized by the Pages proxy.

The runner receives only the database-issued reservation ID, client request ID, lease expiry, code SHA-256, UTF-8 byte count, language, file name, selected code, and fixed policies. It rechecks those associations before starting. It must never receive a Supabase access token, user ID, email, role, source ownership data, private notes, Cloudflare Access service-token secret, database finalizer token, or private Elysia context.

## Configuration

Copy `.env.example` to `/home/elysia-sandbox/.config/elysia-sandbox-runner/runner.env`, make it root-owned with group `elysia-sandbox` and mode `0640`, and enter production values directly on the server. Do not commit or transmit that file. Both kill switches must be true before execution is possible:

```text
ELYSIA_SANDBOX_ENABLED=true
ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION=true
```

Set `ELYSIA_SANDBOX_ENGINE=podman` for production. Changing it to `docker` is an explicit standby activation and must only happen after the full cold-standby acceptance suite passes. Image values must be the exact digests produced and verified by the image release process described in `images/README.md`.

`ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN` is the exact HTTPS Access team issuer and `ELYSIA_SANDBOX_ACCESS_AUDIENCE` is the self-hosted application's AUD tag. These identifiers are not credentials, but production refuses placeholders or incomplete values. The Access service-token client ID and secret exist only in the Pages environment; the runner never receives them as configuration.

## Local verification

Static and mocked checks do not execute untrusted code:

```bash
npm run test:sandbox-runner
npm run test:sandbox-deployment
```

The live integration suite requires a prepared rootless engine and immutable test images, and is deliberately opt-in:

```bash
ELYSIA_SANDBOX_INTEGRATION=1 npm run test:sandbox-integration
```

Run that suite as `elysia-sandbox`, first with Podman. A Docker certification additionally requires `ELYSIA_SANDBOX_DOCKER_STANDBY_TEST=1`; it is a deliberate cold-standby check, not fallback. Never use either suite as root or point it at production state.

The suite fails unless a busy timeout produces real cgroup CPU and memory counters and a bounded memory-exhaustion case produces both a memory peak and `memory_exceeded`. This proof is required separately on the production host after installing a release because local success does not prove host cgroup delegation.

## Release and operation

`npm run sandbox:release` refuses a dirty tree and packages only the explicit runner release allowlist. `npm run sandbox:verify-release -- <archive>` independently checks the archive checksum, paths, complete file/directory manifest coverage, modes, dependency version, and JavaScript syntax. Releases are installed root-owned under `/opt/elysia-sandbox-runner/releases/<release-id>` and activated through `/opt/elysia-sandbox-runner/current`.

User-level service definitions live in `deployment/systemd/`. The timer provides defense-in-depth cleanup even though successful runs are already scrubbed synchronously. Full provisioning, release, Cloudflare, database, rollback, and acceptance instructions are in `docs/deployment/governed-sandbox-deployment.md`.

The outer runner and cleanup units deliberately do not set systemd `NoNewPrivileges` or `ProtectControlGroups`: rootless Podman needs the setuid `newuidmap`/`newgidmap` helpers and delegated cgroup v2 management, including during timed orphan cleanup. Those permissions remain confined to the unprivileged `elysia-sandbox` account. Every execution container independently receives `--security-opt=no-new-privileges`, and the units expose only runtime state plus rootless Podman storage as writable.

A successful execution is evidence only. It never proves safety, trust, authorship, compatibility, approval, or permission to install or run code elsewhere.
