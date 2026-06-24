# Coding Cornucopia Sandbox API Contract

The repo-side runner exposes a small HTTP contract when started with:

```bash
npm run sandbox:serve -- --confirm-service-execution
```

Use `ELYSIA_SANDBOX_RUNTIME_ROOT=/path/to/writable/runtime` when the service
needs to store job metadata and redacted output outside the repo checkout.

The frontend calls it only when:

```text
VITE_CODING_SANDBOX_ENDPOINT=https://reviewed-sandbox-host.example
```

## GET /health

Returns runtime readiness, container engine availability, image availability, network default, and fail-closed state.

## POST /v1/runs

Runs an explicit snapshot payload if language and safety policy allow it.

Request:

```json
{
  "snapshot_id": "commune-code-version-id",
  "source_type": "commune_code_version",
  "source_id": "commune-code-document-id",
  "language": "javascript",
  "file_name": "main.js",
  "code": "console.log('hello')",
  "network_policy": "disabled",
  "filesystem_policy": "temporary_workspace_only"
}
```

Response:

```json
{
  "ok": true,
  "runId": "job-uuid",
  "status": "completed",
  "language": "javascript",
  "file": "main.js",
  "snapshotId": "commune-code-version-id",
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "durationMs": 120,
  "diagnostics": [],
  "message": "Sandbox run completed. This is not a trust or Marketplace approval signal."
}
```

Statuses:

- `completed`
- `failed`
- `denied`
- `policy_blocked`
- `sandbox_unavailable`

Diagnostic categories include syntax, runtime, dependency, network, filesystem, timeout, output, forbidden operation, secret-scan, unsupported-language, and sandbox-internal failures.

The service must not receive private account email, reviewer private notes, service-role keys, local Elysia data, private files, or credentials.
