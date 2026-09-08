import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readinessBaselineCommit, readinessEvidenceDirectory } from "./readinessPaths.mjs";
const root = process.cwd();
const target = await fs.mkdtemp(path.join(os.tmpdir(), "elysia-readiness-before-"));
async function run(cmd, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {cwd, shell:false, stdio:"inherit"});
    child.once("error", reject);child.once("exit", code => code === 0 ? resolve() : reject(new Error("Baseline build command failed.")));
  });
}
// Export only tracked application inputs, never .env, credentials or Git state.
await run("git", ["archive", "--format=tar", `--output=${target}/source.tar`, readinessBaselineCommit, "src", "public", "index.html", "artisan-collective.html", "vite.config.ts", "package.json", "tsconfig.json", "tsconfig.node.json"]);
await run("tar", ["-xf", `${target}/source.tar`, "-C", target]);
await fs.symlink(path.join(root,"node_modules"),path.join(target,"node_modules")),
await run(process.execPath,[path.join(root,"node_modules/vite/bin/vite.js"),"build"],target);
const evidence = await readinessEvidenceDirectory();
await fs.writeFile(path.join(evidence,"baseline-preview-location.json"),JSON.stringify({source:readinessBaselineCommit,directory:target,syntheticConfiguration:true},null,2)+"\n");
console.log("Before-change static preview built from the pinned historical baseline with synthetic configuration.");
