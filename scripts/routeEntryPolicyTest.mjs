import assert from "node:assert/strict";
import {
  isApprovedRouteTarget,
  resolveRouteEntryDirective,
} from "../src/shared/navigation/routeEntryPolicy.ts";

const location = (pathname, { hash = "", search = "", state = null } = {}) => ({
  hash,
  pathname,
  search,
  state,
});

function resolve(current, {
  action = "PUSH",
  initial = false,
  initialHistoryTraversal = false,
  previous = location("/source"),
} = {}) {
  return resolveRouteEntryDirective({
    initialHistoryTraversal,
    isInitialEntry: initial,
    location: current,
    navigationAction: action,
    previousLocation: previous,
  });
}

assert.deepEqual(resolve(location("/about")), { behavior: "top" });
assert.deepEqual(resolve(location("/about"), { action: "REPLACE" }), { behavior: "top" });
assert.deepEqual(resolve(location("/about"), { action: "POP" }), { behavior: "preserve" });
assert.deepEqual(resolve(location("/about"), { initial: true, action: "POP", previous: null }), { behavior: "top" });
assert.deepEqual(resolve(location("/about"), { initial: true, action: "POP", initialHistoryTraversal: true, previous: null }), { behavior: "preserve" });
assert.deepEqual(resolve(location("/archive", { hash: "#release-availability" })), { behavior: "target", targetId: "release-availability" });
assert.deepEqual(resolve(location("/living-library", { hash: "#library-code-datasets" })), { behavior: "target", targetId: "library-code-datasets" });
assert.deepEqual(resolve(location("/developer-forge", { hash: "#forge-preview" })), { behavior: "target", targetId: "forge-preview" });
assert.deepEqual(resolve(location("/commune/coding-cornucopia/review", { hash: "#coding-workbench-heading" })), { behavior: "target", targetId: "coding-workbench-heading" });
assert.deepEqual(resolve(location("/about", { hash: "#unapproved-target" })), { behavior: "top" });
assert.deepEqual(resolve(location("/commons-circle/signals/inbox", { search: "?view=messages" }), {
  previous: location("/commons-circle/signals/inbox"),
}), { behavior: "preserve" });
assert.deepEqual(resolve(location("/commons-circle/signals/notifications", { search: "?filter=marketplace" }), {
  action: "REPLACE",
  previous: location("/commons-circle/signals/notifications"),
}), { behavior: "preserve" });
assert.deepEqual(resolve(location("/commons-circle/signals/requests-reviews", { search: "?domain=job_posts&state=pending" }), {
  action: "REPLACE",
  previous: location("/commons-circle/signals/requests-reviews", { search: "?domain=job_posts" }),
}), { behavior: "preserve" });
assert.deepEqual(resolve(location("/marketplace/action-preview", { search: "?addon=second" }), {
  previous: location("/marketplace/action-preview", { search: "?addon=first" }),
}), { behavior: "top" });
assert.deepEqual(resolve(location("/commune/coding-cornucopia/review", { search: "?post=second" }), {
  previous: location("/commune/coding-cornucopia/review", { search: "?post=first" }),
}), { behavior: "top" });
assert.deepEqual(resolve(location("/marketplace/action-preview", { search: "?addon=example" }), {
  previous: location("/marketplace/browse"),
}), { behavior: "top" });
assert.deepEqual(resolve(location("/support", { state: { routeEntry: "preserve" } })), { behavior: "preserve" });
assert.deepEqual(resolve(location("/support", { state: { routeEntry: "top" } })), { behavior: "top" });
assert.deepEqual(resolve(location("/support", { state: { routeEntry: { targetId: "support-checkout" } } })), { behavior: "target", targetId: "support-checkout" });

for (const approved of ["release-availability", "support-checkout", "library-environmental-data", "forge-workbench", "coding-workbench-heading"]) {
  assert.equal(isApprovedRouteTarget(approved), true, `${approved} should remain approved`);
}
assert.equal(isApprovedRouteTarget("arbitrary-lower-control"), false);
for (const targetId of ["marketplace-profile", "marketplace-licenses", "seller-preparation", "seller-records"]) {
  assert.deepEqual(resolve(location("/marketplace/account", { hash: `#${targetId}` })), { behavior: "target", targetId });
}

console.log("Route-entry policy contract ok.");
