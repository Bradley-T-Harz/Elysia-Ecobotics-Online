#!/usr/bin/env node
import { cleanupRunnerState } from "./runner.mjs";

cleanupRunnerState()
  .then((result) => {
    if (!result.containers?.ok) throw new Error("container_cleanup_unverified");
    console.log(JSON.stringify({ ok: true, ...result }));
  })
  .catch(() => {
    console.error(JSON.stringify({ ok: false, error: "cleanup_failed" }));
    process.exitCode = 1;
  });
