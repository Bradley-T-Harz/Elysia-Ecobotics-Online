// Static publication candidate only. No deploy, migrations, provider actions or
// Git index changes. Its synthetic dist must NEVER be uploaded to production.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { readinessBaselineCommit, readinessEvidenceDirectory } from "./readinessPaths.mjs";
const root=process.cwd(), evidence=await readinessEvidenceDirectory();
const target=await fs.mkdtemp(path.join(os.tmpdir(),"elysia-readiness-publication-"));
async function run(cmd,args,cwd=root) {return new Promise((resolve,reject)=>{const child=spawn(cmd,args,{cwd,shell:false,stdio:"inherit"});child.once("error",reject);child.once("exit",code=>code===0?resolve():reject(Error("Publication preparation failed.")));});}
await run("git",["archive","--format=tar",`--output=${target}/source.tar`,readinessBaselineCommit,"src","public","index.html","artisan-collective.html","vite.config.ts","package.json","tsconfig.json","tsconfig.node.json"]);
await run("tar",["-xf",`${target}/source.tar`,"-C",target]);
await fs.symlink(path.join(root,"node_modules"),path.join(target,"node_modules"));
const files=[
 "src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx","src/pages/Support/index.tsx","src/pages/Support/SupportThankYouPage.tsx",
 "src/pages/Legal/index.tsx","src/pages/Legal/legalPolicyPages.ts","src/pages/Legal/economicLegalArchive.ts","src/pages/Legal/preparedEconomicLegalManifest.ts","src/pages/Legal/readinessLegalClarifications.ts",
 "src/pages/The-Commons-Circle/SupportBillingPage.tsx","src/pages/The-Commons-Circle/HostedExecutionAllowancePage.tsx","src/pages/The-Commons-Circle/OrganizationSponsorshipAccountPanel.tsx",
 "src/pages/The-Elysia-Commune/index.tsx","src/pages/The-Elysia-Marketplace/components/MarketplaceCommercePanel.tsx","src/pages/The-Elysia-Marketplace/components/MarketplaceCommerceAccountPanel.tsx","src/pages/The-Elysia-Marketplace/pages/HomePage.tsx",
 "src/shared/billing/FundingExplanation.tsx","src/shared/billing/PaymentRecordCard.tsx","src/shared/billing/paymentRecord.ts","src/shared/billing/legalDocumentLink.ts","src/shared/billing/billingClient.ts","tsconfig.json","vite.config.ts"
];
for(const file of files) {await fs.mkdir(path.dirname(path.join(target,file)),{recursive:true});await fs.copyFile(path.join(root,file),path.join(target,file));}
// Carry only wording/link changes from setup. The upload/RPC repair is a separate
// migration-dependent release, so this candidate retains the deployed workflow.
const setup="src/pages/The-Commons-Circle/CommonsCircleSetupPage.tsx";
let text=await fs.readFile(path.join(target,setup),"utf8");
text='import { FundingLink } from "../../shared/billing/FundingExplanation";\n'+text;
text=text.replace('<h2>Optional stewardship support</h2>','<h2>Optional stewardship support</h2><div className="button-row"><FundingLink /></div>')
 .replace('stored in the private stewardship-receipts bucket only after final confirmation.','sent to private hosted storage only after final confirmation. Remove unnecessary addresses, QR codes, transaction-access links and sensitive identifiers.');
await fs.writeFile(path.join(target,setup),text);files.push(setup);
await run(process.execPath,[path.join(root,"node_modules/typescript/bin/tsc"),"-b"],target);
await run(process.execPath,[path.join(root,"node_modules/vite/bin/vite.js"),"build"],target);
const manifests=[];
for(const file of files) manifests.push({file,sha256:crypto.createHash("sha256").update(await fs.readFile(path.join(target,file))).digest("hex")});
await fs.writeFile(path.join(evidence,"publication-candidate.json"),JSON.stringify({directory:target,baseline:readinessBaselineCommit,syntheticBuild:true,deployThisDist:false,migrationsIncluded:false,financialActivation:false,files:manifests},null,2)+"\n");
console.log("Static publication source candidate prepared and built; database/attachment repair and financial activation excluded. Never deploy its synthetic dist.");
