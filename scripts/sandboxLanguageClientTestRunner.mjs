import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const entry = new URL("./sandboxLanguageClientTest.mjs", import.meta.url).pathname;
const outfile = path.join(os.tmpdir(), `elysia-sandbox-language-client-test-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node23",
    outfile,
    logLevel: "silent"
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await fs.unlink(outfile).catch(() => undefined);
}
