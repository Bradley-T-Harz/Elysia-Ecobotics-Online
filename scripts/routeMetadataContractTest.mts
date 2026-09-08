import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { routeMetadataForPath } from "../src/shared/navigation/routeMetadata.ts";

const contract = JSON.parse(await fs.readFile(new URL("../docs/navigation/route-preservation-contract.json", import.meta.url), "utf8"));
const genericTitle = "Elysia Ecobotics Online";

function materializePath(value: string) {
  return value
    .replaceAll(":roomSlug", "coding-cornucopia")
    .replaceAll(":postId", "a1100000-0000-4000-8000-000000000001")
    .replaceAll(":conversationId", "a1200000-0000-4000-8000-000000000001")
    .replaceAll(":publicHandle", "@synthetic-route-metadata")
    .replaceAll(":categorySlug", "earth-environment")
    .replaceAll(":sourceId", "nasa-earthdata")
    .replaceAll(":step", "profile")
    .replaceAll(":section", "readiness")
    .replaceAll(":id", "synthetic-route-metadata")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "synthetic-route-metadata");
}

const smokePaths = [...new Set<string>(contract.routes.flatMap((route: { smokePaths?: string[] }) => route.smokePaths ?? []).map(materializePath))]
  .filter((pathname) => pathname.startsWith("/") && !pathname.includes("*"));
assert.equal(smokePaths.length, 164, "The metadata contract must cover the complete preserved smoke-path baseline.");

for (const pathname of smokePaths) {
  const metadata = routeMetadataForPath(pathname);
  assert(metadata.title.length >= 8 && metadata.title.length <= 100, `${pathname} has an invalid title length.`);
  assert(pathname === "/" || metadata.title !== genericTitle, `${pathname} retained the generic page title.`);
  assert(metadata.description.length >= 30 && metadata.description.length <= 240, `${pathname} has an invalid description length.`);
  assert.equal(metadata.canonicalUrl, `https://elysiaecobotics.com${pathname === "/" ? "/" : encodeURI(pathname)}`, `${pathname} has the wrong canonical URL.`);
  assert(!metadata.title.includes("synthetic-route-metadata") && !metadata.description.includes("synthetic-route-metadata"), `${pathname} leaked a dynamic identifier into public metadata.`);
  assert(!metadata.title.includes("a1100000") && !metadata.title.includes("a1200000"), `${pathname} leaked an internal UUID into its title.`);
}

assert.equal(routeMetadataForPath("/account/change-password").title, "Change Password | Elysia Ecobotics Online");
assert.equal(routeMetadataForPath("/commons-circle/settings/privacy").title, "Privacy & Public Profile | Elysia Ecobotics Online");
assert.equal(routeMetadataForPath("/commons-circle/settings/hosted-execution").title, "Hosted Execution Allowance | Elysia Ecobotics Online");
assert.equal(routeMetadataForPath("/artisan-collective").title, "Elysia Artisan Collective | Elysia Ecobotics Online");
assert.equal(routeMetadataForPath("/marketplace/addons/private-looking-slug").title, "Marketplace Add-on | Elysia Ecobotics Online");
assert.equal(routeMetadataForPath("/commons-circle/@private-looking-handle").title, "Public Commons Profile | Elysia Ecobotics Online");
assert.equal(routeMetadataForPath("/commune/posts/a1100000-0000-4000-8000-000000000001").title, "Commune Post | Elysia Ecobotics Online");

console.log(`Route metadata contract passed for ${smokePaths.length} preserved smoke paths without dynamic-identifier leakage.`);
