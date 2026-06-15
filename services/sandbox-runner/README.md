# Elysia Local Sandbox Runner

This service is a local-only sandbox runner foundation for reviewed `.elysia-sandbox-request.json` handoff bundles. It is separate from the public website and must not be deployed as a public execution endpoint.

It uses Docker or Podman with controlled argument arrays, never `shell: true`, and fails closed if no container engine or local runtime image is available.

Commands:

```bash
npm run sandbox:doctor
npm run sandbox:validate -- services/sandbox-runner/fixtures/hello-python.elysia-sandbox-request.json
npm run sandbox:run -- services/sandbox-runner/fixtures/hello-python.elysia-sandbox-request.json --confirm-local-execution
npm run sandbox:status -- <job-id>
npm run sandbox:kill -- <job-id>
```

Manual image setup is required. The runner will not pull images automatically:

```bash
docker pull python:3.12-alpine
docker pull node:22-alpine
```

The runner never mounts the host home directory, repo root, Docker socket, vaults, `.env`, credentials, or private Local Elysia data. It writes runtime job data under `services/sandbox-runner/runtime/`, which is ignored by git.
