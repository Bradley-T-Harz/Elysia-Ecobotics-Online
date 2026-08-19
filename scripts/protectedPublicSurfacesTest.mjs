import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [app, navigation, homepage, sitemap, inventoryText, preservationLaw] = await Promise.all([
  read("src/App.tsx"),
  read("src/shared/navigation/publicNavigation.ts"),
  read("src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx"),
  read("public/sitemap.xml"),
  read("docs/navigation/protected-public-surfaces.json"),
  read("docs/release/PUBLIC_SURFACE_PRESERVATION_CONTRACT.md"),
]);
const inventory = JSON.parse(inventoryText);

assert.equal(inventory.schemaVersion, 1, "Protected-surface inventory schema changed without a migration.");
assert(!app.includes("HiddenReleaseSurface"), "Established surfaces must not be replaced by a shared homepage redirect.");
assert(preservationLaw.includes("explicit approval by name"), "Named removal approval law is missing.");

for (const surface of inventory.surfaces) {
  const declaredPath = surface.routePattern ?? surface.path;
  const routeFragment = `path="${declaredPath.slice(1)}"`;
  assert(app.includes(routeFragment), `${surface.name}: protected route is absent (${surface.path}).`);
  const componentRoute = `<Route ${routeFragment} element={<${surface.component}`;
  assert(app.includes(componentRoute), `${surface.name}: route no longer resolves to ${surface.component}.`);
  assert(!app.includes(`<Route ${routeFragment} element={<Navigate replace to="/"`), `${surface.name}: protected route silently redirects to home.`);
  if (surface.publicNavigationLabel) {
    assert(navigation.includes(`label: "${surface.publicNavigationLabel}"`), `${surface.name}: public navigation label was removed.`);
    assert(navigation.includes(`to: "${surface.path}"`), `${surface.name}: public navigation path was removed.`);
  }
}

for (const path of ["/archive", "/products", "/lab", "/commune"]) {
  assert(homepage.includes(`to="${path}"`) || navigation.includes(`to: "${path}"`), `${path}: no public entrance remains.`);
  assert(sitemap.includes(`https://elysiaecobotics.com${path}`), `${path}: sitemap entry was removed.`);
}

console.log(`Protected public surfaces ok (${inventory.surfaces.length} route contracts; no silent homepage redirects).`);
