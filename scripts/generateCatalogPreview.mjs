import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const sourcePath = path.join(root, "src/pages/The-Elysia-Marketplace/data/seedAddons.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
  }
}).outputText;

const sandbox = { exports: {}, require: () => ({}) };
vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
const seedAddons = sandbox.exports.seedAddons;
if (!Array.isArray(seedAddons)) {
  throw new Error("seedAddons export was not an array");
}

const output = {
  schema_version: "0.1",
  generated_from: "src/data/seedAddons.ts",
  note: "Static candidate metadata only. Candidate status is not publication, installability, enablement, or authority. Local Elysia must validate any future reviewed package.",
  addons: seedAddons
};

fs.writeFileSync(path.join(root, "public/catalog-preview.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote public/catalog-preview.json with ${seedAddons.length} add-ons.`);
