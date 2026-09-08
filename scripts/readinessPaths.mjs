import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const readinessRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const readinessBaselineCommit = "c04260585e237e213d10e0220d964a09e4f0bbcf";

export async function readinessEvidenceDirectory() {
  const directory = path.resolve(process.env.ELYSIA_READINESS_EVIDENCE_DIR || path.join(os.tmpdir(), "elysia-readiness-checks"));
  const relative = path.relative(readinessRepositoryRoot, directory);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("Readiness evidence must stay outside the source repository.");
  }
  await fs.mkdir(directory, { recursive: true });
  return directory;
}
