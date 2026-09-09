import { spawn } from "node:child_process";
// Fixed local contract tests only; no deployment, catalog-creation or URL audit.
const checks = ["test:routes", "test:route-preservation", "test:route-metadata", "test:protected-surfaces", "test:navigation-model", "test:security", "test:abuse-controls", "test:content", "test:marketplace-intake", "test:manifest-convergence", "test:marketplace-submission-boundary", "test:online-identity", "test:account-communications", "test:commons-circle-mutual", "test:commune-circle-private", "test:job-opportunity", "test:job-post-fees", "test:publisher-ownership", "test:bundle-budget", "test:public-bundle-security"];
let failed = false;
for (const check of checks) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", check], { shell: false, stdio: "inherit" });
    child.once("error", reject); child.once("exit", resolve);
  });
  if (code !== 0) { failed = true; console.error(`Readiness regression failed: ${check}`); }
}
process.exitCode = failed ? 1 : 0;
