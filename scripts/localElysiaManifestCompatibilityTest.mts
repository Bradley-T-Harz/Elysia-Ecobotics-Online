import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { assessLocalElysiaManifest, localElysiaCanonicalSchema, localElysiaManifestName } from "../src/shared/addons/localElysiaManifestContract.ts";

const canonical = {
  schema_version: "1.1",
  addon_id: "org.example.compatibility-proof",
  name: "Compatibility Proof",
  version: "0.1.0",
  publisher: { name: "Example Publisher", identity: "example-publisher" },
  compatibility: { min_elysia_version: "0.1.0", max_elysia_version: "1.0.0", addon_api_version: "1" },
  required_profiles: ["developer"],
  entrypoints: { tool: "files/tool.ts" },
  bridge: { protocol: "json_rpc_stdio", contract_version: "1", execution_enabled: false },
  permissions: [{ key: "filesystem.read_project", required: false, reason: "Read only user-selected project files." }],
  network_policy: { default: "deny", declared_hosts: [] },
  filesystem_policy: { default: "project_scoped", mounts: [] },
  memory_policy: { default: "deny", classes: [] },
  model_provider_policy: { default: "deny", providers: [] },
  tool_worker_policy: { default: "deny", workers: [] },
  execution: { requested: false },
  sandbox: { required: true, network: "deny_by_default", filesystem: "temporary_only" },
  external_services: [],
  license: { spdx: "Apache-2.0" },
  provenance: { status: "self_declared", source: "local" },
  signing: { publisher_key_id: null, signature: null },
  dependencies: [],
  checksums: { files: { "files/tool.ts": "0".repeat(64) } },
  binaries: []
};

assert.equal(localElysiaManifestName, "manifest.json");
assert.equal(localElysiaCanonicalSchema, "1.1");
assert.equal(assessLocalElysiaManifest(canonical).status, "canonical_candidate");
assert.equal(assessLocalElysiaManifest({ ...canonical, bridge: { ...canonical.bridge, execution_enabled: true } }).status, "incompatible");
assert.equal(assessLocalElysiaManifest({ schema_version: "1.0" }).status, "legacy_revalidation_required");
assert.equal(assessLocalElysiaManifest({ ...canonical, schema_version: "2.0" }).status, "incompatible");

const docs = await fs.readFile("docs/developer-forge/local-elysia-manifest-compatibility.md", "utf8");
assert.match(docs, /Local Elysia independently reopens/);
assert.match(docs, /final validation before install or enablement/i);
assert.match(docs, /Website Forge's existing editable\/submission contract is legacy schema `1\.0`/);

console.log("Website/Local Elysia manifest compatibility contract passed.");
