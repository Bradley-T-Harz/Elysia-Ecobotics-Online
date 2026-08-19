import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [nav, model, styles, header, accountButton] = await Promise.all([
  read("src/shared/components/SiteNav.tsx"),
  read("src/shared/navigation/publicNavigation.ts"),
  read("src/styles.css"),
  read("src/shared/components/SiteHeader.tsx"),
  read("src/shared/components/AccountButton.tsx")
]);

assert(nav.includes("publicNavigationTerritories.map"), "Desktop navigation must render from the shared public model.");
assert(nav.includes('className="site-nav-territory__trigger"'), "Desktop territory buttons are missing.");
assert(nav.includes("aria-controls={isOpen ? panelId : undefined}") && nav.includes("aria-expanded={isOpen}"), "Desktop disclosure must expose ARIA state only for the mounted panel.");
assert(nav.includes("{isOpen && (") && nav.includes('className="site-nav-panel" id={panelId}'), "The controlled desktop panel must exist exactly while its trigger is open.");
assert(nav.includes("current === territory.id ? null : territory.id"), "Desktop triggers must toggle one territory at a time.");
assert(nav.includes('event.key !== "Escape"') && nav.includes("trigger?.focus()"), "Desktop Escape and focus return are missing.");
assert(nav.includes('document.addEventListener("pointerdown"') && nav.includes("regionRef.current?.contains"), "Outside-interaction closure is missing.");
assert(nav.includes("location.pathname") && nav.includes("location.search") && nav.includes("location.hash"), "Route/location-change closure is missing.");
assert(!nav.includes("onMouseEnter") && !nav.includes("onMouseOver"), "Navigation must not depend on hover.");
assert(nav.includes("<NavLink") && nav.includes("destination.to"), "Destinations must be ordinary canonical NavLinks.");
assert(nav.includes('bridge: "separate-elysia-portal"') === false && model.includes('bridge: "separate-elysia-portal"'), "Bridge metadata belongs in the public model, not component logic.");
assert(nav.includes('aria-controls="site-navigation-mobile"') && nav.includes("aria-expanded={mobileOpen}"), "Mobile Explore disclosure ARIA state is missing.");
assert(nav.includes('data-view={mobileTerritory ? "destinations" : "territories"}'), "Mobile navigation must expose its staged view state.");
assert(nav.includes("openMobileTerritory") && nav.includes("returnToMobileTerritories"), "Mobile staged disclosure and back behavior are missing.");
assert(nav.includes("mobileTerritory.destinations.map"), "Mobile destinations must come from the selected shared-model territory.");
assert(nav.includes("mobileBackRef.current?.focus()") && nav.includes("mobileReturnFocusIdRef.current") && nav.includes("mobileTerritoryRefs.current[territoryId]?.focus()"), "Mobile focus movement and return are missing.");
assert(nav.includes("setMobileTerritoryId(null)") && nav.includes("mobileToggleRef.current?.focus()"), "Mobile Escape closure must return focus.");

for (const selector of [
  ".site-nav-region",
  ".site-nav-desktop",
  ".site-nav-territory__trigger",
  ".site-nav-panel",
  ".site-nav-destination",
  ".site-nav-mobile__territory",
  ".site-nav-mobile__back"
]) {
  assert(styles.includes(selector), `Missing scoped navigation CSS: ${selector}`);
}
assert(!styles.includes(".site-nav-region { overflow: hidden") && !styles.includes(".site-nav-region { overflow: clip"), "Attached panels must not be clipped by their region.");
assert(!/body\s*\{[^}]*overflow\s*:\s*hidden/s.test(styles), "Navigation must not introduce global body scroll locking.");
assert(styles.includes("overscroll-behavior: contain") && styles.includes("max-height: min(68vh, 34rem)"), "Mobile short-screen scroll containment is missing.");
assert(styles.includes(".site-nav-region *") && styles.includes("transition: none !important"), "Reduced-motion navigation behavior is missing.");
assert(styles.includes("min-height: 2.75rem"), "Mobile controls must target approximately 44 CSS pixels.");

assert(header.includes('className="site-brand" to="/"'), "Brand/Home utility changed.");
assert(header.includes('className="install-link" to="/archive"'), "Download utility changed.");
assert(accountButton.includes('to="/commons-circle"'), "AccountButton target changed.");

for (const forbidden of ["/admin", "/commons-circle/support-billing", "/commons-circle/signals", "/developer-forge/drafts", "/commune/moderation"]) {
  assert(!model.includes(forbidden), `Restricted path entered the anonymous model: ${forbidden}`);
}

console.log("Navigation shell ok (desktop disclosure, staged mobile parity, Escape/focus return, outside and route-change closure, scoped CSS)." );
