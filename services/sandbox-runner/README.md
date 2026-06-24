# Elysia Local Sandbox Runner

This service is a local-only sandbox runner foundation for reviewed `.elysia-sandbox-request.json` handoff bundles. It is separate from the public website and must not be deployed as a public execution endpoint.

It uses Docker or Podman with controlled argument arrays, never `shell: true`, and fails closed if no container engine or local runtime image is available.

Commands:

```bash
npm run sandbox:doctor
npm run sandbox:validate -- services/sandbox-runner/fixtures/hello-python.elysia-sandbox-request.json
npm run sandbox:run -- services/sandbox-runner/fixtures/hello-python.elysia-sandbox-request.json --confirm-local-execution
npm run sandbox:validate-snapshot -- services/sandbox-runner/fixtures/snapshot-javascript-run.json
npm run sandbox:run-snapshot -- services/sandbox-runner/fixtures/snapshot-javascript-run.json --confirm-local-execution
npm run sandbox:serve -- --confirm-service-execution
npm run sandbox:status -- <job-id>
npm run sandbox:kill -- <job-id>
```

Manual image setup is required. The runner will not pull images automatically:

```bash
docker pull python:3.12-alpine
docker pull node:22-alpine
```

The runner never mounts the host home directory, repo root, Docker socket, vaults, `.env`, credentials, or private Local Elysia data. It writes runtime job data under `services/sandbox-runner/runtime/` by default, which is ignored by git. Set `ELYSIA_SANDBOX_RUNTIME_ROOT=/path/to/writable/runtime` to use a dedicated service volume or `/tmp` during local smoke tests.

## Coding Cornucopia service mode

`server.mjs` exposes the repo-side service contract used by Coding Cornucopia:

- `GET /health`
- `POST /v1/runs`

The server is fail-closed unless started with `--confirm-service-execution` or `ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION=true`. The frontend only calls it when `VITE_CODING_SANDBOX_ENDPOINT` is configured.

The service still runs outside the website/browser/Supabase process. Production exposure must add a reviewed origin allowlist, authentication/rate limiting, process supervision, TLS, and abuse monitoring. A successful sandbox run is evidence only; it is not trust, Marketplace approval, Developer Forge approval, or Local Elysia authority.
