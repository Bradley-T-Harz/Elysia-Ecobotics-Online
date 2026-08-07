import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const repositoryRoot = new URL("../", import.meta.url).pathname;
const bundled = await build({
  stdin: {
    contents: [
      'export * from "./src/pages/The-Living-Library/livingLibraryCatalog.ts";',
      'export * from "./src/pages/The-Living-Library/livingLibrarySearch.ts";',
    ].join("\n"),
    resolveDir: repositoryRoot,
    sourcefile: "living-library-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const moduleSource = bundled.outputFiles[0].text;
const catalog = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);

const {
  activeLivingLibrarySources,
  allLivingLibrarySources,
  defaultLivingLibraryFilters,
  formatLivingLibraryCitation,
  legacyLivingLibrarySources,
  livingLibraryBrowseCategories,
  resolveLivingLibrarySource,
  searchLivingLibrarySources,
} = catalog;

assert.equal(allLivingLibrarySources.length, 232, "the 171-record baseline, 57-resource expansion, and four-resource quality expansion must remain resolvable");
assert.equal(activeLivingLibrarySources.length, 200, "active catalog count changed unexpectedly");
assert.equal(legacyLivingLibrarySources.length, 32, "legacy/tombstone count changed unexpectedly");
assert.equal(new Set(allLivingLibrarySources.map((source) => source.id)).size, allLivingLibrarySources.length, "source IDs must be unique");
assert.equal(new Set(activeLivingLibrarySources.map((source) => source.id)).size, activeLivingLibrarySources.length, "active source IDs must be unique");

const validLinkRoles = new Set(["official", "search", "data", "api", "documentation", "download", "code", "license", "citation", "historical", "legacy"]);
const validCategories = new Set(livingLibraryBrowseCategories.map((category) => category.name));
for (const source of allLivingLibrarySources) {
  assert.equal(resolveLivingLibrarySource(source.id)?.id, source.id, `source ${source.id} must resolve`);
  assert.ok(source.links.length >= 1, `source ${source.id} needs at least one typed link`);
  assert.ok(source.links.some((link) => link.primary), `source ${source.id} needs a primary link`);
  assert.ok(source.links.every((link) => validLinkRoles.has(link.role)), `source ${source.id} has an invalid link role`);
  assert.ok(source.links.every((link) => /^https?:\/\//.test(link.url)), `source ${source.id} has a malformed external link`);
  assert.ok(source.operator.trim(), `source ${source.id} needs an operator`);
  assert.ok(source.searchKeywords.length >= 3, `source ${source.id} needs structured search vocabulary`);
  assert.ok(source.aliases.length >= 0, `source ${source.id} aliases must be structured`);
  assert.ok(source.scienceDomains.length >= 1, `source ${source.id} needs science domains`);
  assert.ok(validCategories.has(source.browseCategory), `source ${source.id} has an unknown browse category`);
  if (source.lifecycle.parentId) assert.ok(resolveLivingLibrarySource(source.lifecycle.parentId), `source ${source.id} parent must resolve`);
  if (source.lifecycle.successorId) assert.ok(resolveLivingLibrarySource(source.lifecycle.successorId), `source ${source.id} successor must resolve`);
}
assert.ok(activeLivingLibrarySources.every((source) => source.lifecycle.status === "active"), "legacy sources must not leak into active discovery");
for (const baselineSource of allLivingLibrarySources.slice(0, 171)) {
  assert.equal(resolveLivingLibrarySource(baselineSource.id)?.id, baselineSource.id, `baseline source ${baselineSource.id} must retain stable resolution`);
}

const expansionIds = [
  "npmx", "lter-network", "codap", "earthscope-consortium", "open-earth-monitor", "climate-us", "raspberry-pi-foundation", "data-nuggets", "hugging-face-hub", "datacite-commons", "re3data", "opendoar", "orcid-registry", "ror", "openaire", "opencitations", "scielo", "la-referencia", "ajol", "j-stage", "cinii-research", "hal-open-science", "cessda-data-catalogue", "gesis-search", "shodhganga", "ndltd", "icpsr", "pangaea", "nsf-neon", "hydroshare", "obis", "bco-dmo", "ameriflux", "movebank", "embl-ebi", "ncbi-geo", "europe-pmc", "clinicaltrials-gov", "materials-cloud", "nomad", "crystallography-open-database", "cern-open-data", "inspire-hep", "hepdata", "mast", "simbad", "gaia-archive", "zbmath-open", "nist-dlmf", "oeis", "osti-gov", "nasa-ntrs", "national-academies-publications", "phet", "openstax", "hhmi-biointeractive", "clean",
];
assert.equal(expansionIds.length, 57, "approved expansion ID fixture must describe all new active records");
for (const id of expansionIds) {
  const expanded = allLivingLibrarySources.find((entry) => entry.id === id);
  assert.ok(expanded?.active, `${id} must be a unique active expansion record`);
  assert.ok(expanded.searchKeywords.length >= 15, `${id} needs at least 15 truthful discovery terms`);
  assert.ok(expanded.aliases.length >= 2, `${id} needs useful aliases or acronyms`);
  assert.ok(expanded.links.every((entry) => entry.url.startsWith("https://")), `${id} active links should use HTTPS`);
  assert.ok(expanded.access.note.length >= 40, `${id} needs an access annotation`);
  assert.ok(expanded.content.note.length >= 40, `${id} needs a hosting/review annotation`);
  assert.ok(expanded.license.summary.length >= 40, `${id} needs a reuse annotation`);
  assert.ok(expanded.citation.creator && expanded.citation.title && expanded.citation.url, `${id} needs structured citation metadata`);
}

const miniExpansionIds = ["cochrane-library", "allen-brain-map", "paleobiology-database", "openaq"];
assert.equal(miniExpansionIds.length, 4, "the 200-resource quality expansion must contain exactly four records");
for (const id of miniExpansionIds) {
  const expanded = allLivingLibrarySources.find((entry) => entry.id === id);
  assert.ok(expanded?.active, `${id} must be a unique active quality-expansion record`);
  assert.ok(expanded.searchKeywords.length >= 40, `${id} needs at least 40 truthful discovery terms`);
  assert.ok(expanded.aliases.length >= 4, `${id} needs useful aliases and acronyms`);
  assert.ok(expanded.links.length >= 4, `${id} needs a primary link and substantive typed official links`);
  assert.ok(expanded.links.every((entry) => entry.url.startsWith("https://")), `${id} active links should use HTTPS`);
  assert.ok(expanded.access.note.length >= 120, `${id} needs a nuanced access annotation`);
  assert.ok(expanded.content.note.length >= 120, `${id} needs a nuanced hosting/review annotation`);
  assert.ok(expanded.license.summary.length >= 120, `${id} needs a nuanced reuse annotation`);
  assert.ok(expanded.citation.creator && expanded.citation.title && expanded.citation.url, `${id} needs structured citation metadata`);
}
const miniExpansionDomains = miniExpansionIds.map((id) => new URL(allLivingLibrarySources.find((entry) => entry.id === id).officialUrl).hostname.replace(/^www\./, ""));
assert.equal(new Set(miniExpansionDomains).size, miniExpansionIds.length, "the four additions must not duplicate one another's primary service domain");
for (const id of miniExpansionIds) {
  const added = allLivingLibrarySources.find((entry) => entry.id === id);
  const normalizedName = added.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  assert.equal(allLivingLibrarySources.filter((entry) => entry.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalizedName).length, 1, `${id} must not duplicate an existing normalized display name`);
}

function source(id) {
  const value = resolveLivingLibrarySource(id);
  assert.ok(value, `missing source ${id}`);
  return value;
}

// P0 and canonical URL dispositions.
assert.equal(source("hud-user--hud-data").officialUrl, "https://www.huduser.gov/portal/pdrdatas_landing.html");
assert.equal(source("noaa-ncei-access-data-service").officialUrl, "https://www.ncei.noaa.gov/support/access-data-service-api-user-documentation");
assert.ok(source("noaa-ncei-access-data-service").links.some((link) => link.role === "api" && link.url.endsWith("/access/services/data/v1")));
assert.equal(source("gitlab").officialUrl, "https://gitlab.com/explore/projects");
assert.equal(source("sigstore-cosign").officialUrl, "https://docs.sigstore.dev/quickstart/quickstart-cosign/");
assert.ok(source("common-crawl").links.some((link) => link.url === "https://commoncrawl.org/get-started"));
for (const id of ["microsoft-academic-graph-legacy", "epa-ejscreen", "papers-with-code", "nasa-earthdata-cloud", "the-stack"]) {
  assert.equal(source(id).active, false, `${id} must not appear in active discovery`);
}
assert.equal(source("epa-ejscreen").lifecycle.status, "legacy");
assert.equal(source("epa-ejscreen").officialUrl, "https://19january2021snapshot.epa.gov/ejscreen_.html");
assert.equal(source("epa-ejscreen").links[0].role, "historical");
assert.match(source("epa-ejscreen").name, /Archived Historical EPA Resource/);
assert.match(source("epa-ejscreen").limitationsCautions, /January 19, 2021/);
assert.doesNotMatch(source("epa-ejscreen").lifecycle.legacyReason ?? "", /replacement/i, "EJSCREEN must not imply a successor");
assert.equal(source("cinii-research").access.api, "key/token required");
assert.match(source("national-academies-publications").license.trainingCaution, /machine learning|artificial-intelligence training/i);
assert.equal(source("hugging-face-datasets").lifecycle.parentId, "hugging-face-hub");
assert.match(source("ndltd").content.note, /taken offline/i);
assert.match(source("ndltd").verification.limitation ?? "", /no completion date/i);
assert.ok(source("ndltd").links.every((link) => link.url.startsWith("https://")), "NDLTD must not expose the offline Global ETD Search endpoint as an active link");
for (const id of ["microsoft-academic-graph-legacy", "papers-with-code"]) {
  assert.equal(source(id).links[0].role, "historical", `${id} must not present historical context as a current official destination`);
  assert.match(source(id).links[0].caution ?? "", /Historical context only/, `${id} historical link must carry a caution`);
}
assert.equal(source("nasa-earthdata-cloud").lifecycle.successorId, "nasa-earthdata");
assert.equal(source("the-stack").lifecycle.successorId, "the-stack-v2");
assert.equal(source("nasa-earthdata").content.hostsContent, "mixed");
assert.match(source("nasa-earthdata").content.note, /distributed NASA Earth science data centers/);
assert.match(source("nasa-earthdata").access.note, /free Earthdata Login/);
assert.equal(source("google-earth-engine").content.reviewStatus, "repository with varying material");
assert.equal(source("google-earth-engine-data-catalog").content.reviewStatus, "repository with varying material");

// Owner-confirmed and P2 normalization destinations.
const expectedUrls = {
  "data-gov-in": "https://www.data.gov.in/",
  "unicef-data": "https://data.unicef.org/",
  "unhcr-refugee-data-finder": "https://www.unhcr.org/refugee-statistics",
  "gbif": "https://www.gbif.org/",
  "iucn-red-list": "https://www.iucnredlist.org/",
  "esa-earth-online--earth-observation-gateway": "https://earth.esa.int/eogateway",
  "scopus": "https://www.scopus.com/pages/home",
  "npm-registry": "https://www.npmjs.com/",
  "stack-overflow": "https://stackoverflow.com/questions",
  "materials-project": "https://next-gen.materialsproject.org/",
  "undata": "https://data.un.org/",
  "imf-data-portal": "https://www.imf.org/en/Data",
  "data-europa-eu--european-data-portal": "https://data.europa.eu/en",
  "wateraid-america": "https://www.wateraid.org/washmatters/resources",
  "google-bigquery-public-datasets": "https://docs.cloud.google.com/bigquery/public-data",
  "epa-enterprise-data-catalog": "https://www.epa.gov/data/enterprise-data-catalog",
  "nist-data-repository": "https://data.nist.gov/sdp/",
  "tauri": "https://v2.tauri.app/",
};
for (const [id, url] of Object.entries(expectedUrls)) assert.equal(source(id).officialUrl, url, `${id} canonical URL changed`);
assert.ok(source("materials-project").links.some((link) => link.role === "legacy" && link.url === "https://legacy.materialsproject.org/"));
assert.ok(source("materials-project").links.some((link) => link.role === "code" && link.url === "https://github.com/materialsproject"));

// Material annotation corrections are represented structurally.
assert.match(source("nasa-nsidc").operator, /CIRES.*University of Colorado Boulder.*NASA-managed DAAC/i);
assert.equal(source("nasa-nsidc").access.public, "account required");
assert.equal(source("crossref").resourceType, "Scholarly metadata or citation infrastructure");
assert.equal(source("crossref").content.hostsContent, "no");
assert.equal(source("pubmed").content.hostsContent, "no");
assert.equal(source("pubmed-central--pmc").content.reviewStatus, "repository with varying material");
assert.equal(source("arxiv").content.reviewStatus, "preprint");
assert.equal(source("inaturalist").content.reviewStatus, "citizen science");
assert.equal(source("ebird").content.reviewStatus, "citizen science");
assert.equal(source("google-bigquery-public-datasets").browseCategory, "General & Government Data");
assert.equal(source("wikimedia-commons").browseCategory, "Research Practice & Education");
assert.equal(source("ollama").access.cloud, "optional");
assert.equal(source("supabase-rls").access.public, "open");
assert.equal(source("supabase-rls").access.cloud, "optional");
assert.equal(source("scopus").access.public, "institutional/subscription required");

// Stewardship scope: seven research/education portals retained, 23 organization cards archived.
const retainedStewardshipIds = ["coral-reef-alliance", "world-wildlife-fund", "eesi", "pure-earth", "wateraid-america", "doctors-without-borders--msf", "wikimedia-foundation"];
assert.ok(retainedStewardshipIds.every((id) => source(id).active), "research/education recasts must remain active");
assert.equal(legacyLivingLibrarySources.filter((record) => record.id === "rainforest-trust" || record.id === "care-international").length, 2);
assert.equal(activeLivingLibrarySources.some((record) => record.category === "Stewardship Organizations"), false, "blanket stewardship category must be absent");

// Search corpus. Assertions identify families, not brittle exact ordering.
const search = (query) => searchLivingLibrarySources(activeLivingLibrarySources, query, defaultLivingLibraryFilters).map((result) => result.source.id);
function expectAny(query, expectedIds) {
  const results = search(query);
  assert.ok(expectedIds.some((id) => results.includes(id)), `${query} should find one of ${expectedIds.join(", ")}; got ${results.slice(0, 12).join(", ")}`);
}
const corpus = [
  ["atmosphere", ["noaa-climate-data-online", "nasa-earthdata"]],
  ["atmospheric", ["noaa-climate-data-online", "noaa-ncei-access-data-service"]],
  ["weather", ["noaa-climate-data-online"]],
  ["meteorology", ["noaa-climate-data-online", "noaa-ncei-access-data-service"]],
  ["climate", ["nasa-earthdata", "noaa-climate-data-online"]],
  ["ocean", ["copernicus-data-space-ecosystem", "coral-reef-alliance"]],
  ["marine", ["coral-reef-alliance"]],
  ["water", ["usgs-epa-water-quality-portal", "wateraid-america"]],
  ["watershed", ["usgs-watershed-boundary-dataset"]],
  ["hydrology", ["usgs-national-hydrography", "usgs-epa-water-quality-portal"]],
  ["biodiversity", ["gbif", "iucn-red-list", "inaturalist"]],
  ["species", ["gbif", "iucn-red-list"]],
  ["ecology", ["gbif", "inaturalist"]],
  ["conservation", ["iucn-red-list", "world-wildlife-fund"]],
  ["satellite", ["nasa-earthdata", "google-earth-engine-data-catalog"]],
  ["remote sensing", ["nasa-earthdata", "usgs-earthexplorer"]],
  ["wildfire", ["nasa-firms"]],
  ["fire", ["nasa-firms"]],
  ["earthquake", ["usgs-earthquake-catalog"]],
  ["geology", ["usgs-earthquake-catalog", "usgs-volcano-data"]],
  ["geophysics", ["usgs-earthquake-catalog"]],
  ["air quality", ["epa-tri--toxics-release-inventory", "nasa-firms"]],
  ["pollution", ["epa-tri--toxics-release-inventory", "pure-earth"]],
  ["agriculture", ["usda-nass-quick-stats", "faostat"]],
  ["soil", ["google-earth-engine-data-catalog"]],
  ["chemistry", ["pubchem", "nist-chemistry-webbook"]],
  ["compounds", ["pubchem"]],
  ["proteins", ["rcsb-protein-data-bank"]],
  ["structures", ["rcsb-protein-data-bank", "materials-project"]],
  ["genomics", ["ncbi-datasets", "ensembl"]],
  ["genes", ["ncbi-datasets", "ensembl"]],
  ["health", ["pubmed", "who-global-health-observatory"]],
  ["epidemiology", ["pubmed", "doctors-without-borders--msf"]],
  ["papers", ["pubmed", "nasa-ads", "crossref"]],
  ["literature", ["pubmed", "openalex"]],
  ["peer reviewed", ["world-wildlife-fund", "pubmed", "web-of-science"]],
  ["preprint", ["arxiv"]],
  ["citation", ["crossref", "openalex"]],
  ["DOI", ["crossref"]],
  ["open access", ["doaj", "pubmed-central--pmc"]],
  ["datasets", ["hugging-face-datasets", "google-dataset-search"]],
  ["statistics", ["eurostat", "undata"]],
  ["census", ["u-s-census-apis"]],
  ["housing", ["hud-user--hud-data"]],
  ["economics", ["fred", "world-bank-data"]],
  ["labor", ["bls-public-data-api"]],
  ["astronomy", ["nasa-ads", "nasa-exoplanet-archive"]],
  ["exoplanets", ["nasa-exoplanet-archive"]],
  ["materials", ["materials-project", "nist-jarvis"]],
  ["machine learning", ["openml", "hugging-face-datasets"]],
  ["benchmark", ["openml", "open-catalyst-project"]],
  ["code", ["software-heritage", "github"]],
  ["software", ["software-heritage", "github"]],
  ["licensing", ["creative-commons", "hugging-face-dataset-cards"]],
  ["API", ["noaa-ncei-access-data-service", "crossref", "u-s-census-apis"]],
  ["repository finder", ["re3data", "opendoar"]],
  ["African journals", ["ajol", "scielo"]],
  ["doctoral thesis India", ["shodhganga"]],
  ["long term ecology", ["lter-network", "nsf-neon"]],
  ["cryosphere", ["nasa-nsidc"]],
  ["ice elevation", ["nasa-nsidc"]],
  ["GNSS", ["earthscope-consortium"]],
  ["seismology", ["earthscope-consortium"]],
  ["marine biodiversity", ["obis"]],
  ["animal tracking", ["movebank"]],
  ["eddy covariance", ["ameriflux", "nsf-neon"]],
  ["carbon flux", ["ameriflux", "nsf-neon"]],
  ["water models", ["hydroshare"]],
  ["functional genomics", ["ncbi-geo", "embl-ebi"]],
  ["clinical trial", ["clinicaltrials-gov"]],
  ["crystal structures", ["crystallography-open-database", "materials-cloud"]],
  ["high energy physics", ["cern-open-data", "inspire-hep", "hepdata"]],
  ["LHC data", ["cern-open-data"]],
  ["space telescope data", ["mast"]],
  ["Gaia", ["gaia-archive"]],
  ["mathematics papers", ["zbmath-open"]],
  ["special functions", ["nist-dlmf"]],
  ["integer sequence", ["oeis"]],
  ["DOE research", ["osti-gov"]],
  ["NASA reports", ["nasa-ntrs"]],
  ["science textbook", ["openstax"]],
  ["climate lesson", ["clean"]],
  ["data literacy", ["codap", "data-nuggets"]],
  ["AI models", ["hugging-face-hub"]],
  ["AI datasets", ["hugging-face-hub"]],
  ["package registry", ["npmx"]],
  ["interactive graphs", ["codap"]],
  ["former Climate.gov team", ["climate-us"]],
  ["physical computing lessons", ["raspberry-pi-foundation"]],
  ["real scientist classroom data", ["data-nuggets"]],
  ["DOI metadata search", ["datacite-commons"]],
  ["researcher identifier", ["orcid-registry"]],
  ["organization identifier", ["ror"]],
  ["research graph", ["openaire", "datacite-commons"]],
  ["open citation index", ["opencitations"]],
  ["Latin American journals", ["scielo"]],
  ["Latin American repositories", ["la-referencia"]],
  ["Japanese journals", ["j-stage"]],
  ["Japanese papers", ["cinii-research"]],
  ["French research", ["hal-open-science"]],
  ["European social data", ["cessda-data-catalogue"]],
  ["survey datasets", ["gesis-search", "icpsr"]],
  ["global theses", ["ndltd"]],
  ["georeferenced data", ["pangaea"]],
  ["ocean biogeochemistry", ["bco-dmo"]],
  ["animal trajectories", ["movebank"]],
  ["life science databases", ["embl-ebi"]],
  ["biomedical preprints", ["europe-pmc"]],
  ["computational materials", ["materials-cloud", "nomad"]],
  ["publication plot data", ["hepdata"]],
  ["astronomical objects", ["simbad"]],
  ["astrometry star catalog", ["gaia-archive"]],
  ["open integer sequences", ["oeis"]],
  ["consensus report", ["national-academies-publications"]],
  ["physics simulation", ["phet"]],
  ["biology teaching resources", ["hhmi-biointeractive"]],
  ["systematic review", ["cochrane-library"]],
  ["treatment effectiveness evidence", ["cochrane-library"]],
  ["controlled trial evidence synthesis", ["cochrane-library"]],
  ["brain cell types", ["allen-brain-map"]],
  ["spatial transcriptomics brain", ["allen-brain-map"]],
  ["neural connectivity atlas", ["allen-brain-map"]],
  ["fossil occurrences", ["paleobiology-database"]],
  ["deep time biodiversity", ["paleobiology-database"]],
  ["taphonomy stratigraphy", ["paleobiology-database"]],
  ["ground level air quality", ["openaq"]],
  ["PM2.5 sensors", ["openaq"]],
  ["global pollution monitoring", ["openaq"]],
];
for (const [query, expectedIds] of corpus) expectAny(query, expectedIds);
const atmospheric = search("atmospheric");
assert.ok(atmospheric.includes("nasa-earthdata"), "atmospheric must include NASA Earthdata");
assert.ok(atmospheric.includes("noaa-climate-data-online"), "atmospheric must include NOAA Climate Data Online");
assert.ok(atmospheric.includes("epa-tri--toxics-release-inventory") || atmospheric.includes("nasa-firms"), "atmospheric should include a relevant air-quality/fire observation resource");
assert.ok(atmospheric.includes("openaq"), "atmospheric must include OpenAQ's scientifically relevant ground-level observations");
const aiDatasets = search("AI datasets");
assert.ok(aiDatasets.includes("hugging-face-hub"), "AI datasets must surface Hugging Face Hub");
assert.ok(aiDatasets.length <= 12, `AI acronym matching must not degrade into a broad substring match; got ${aiDatasets.length} results`);

// Citation access date and verification date are deliberately distinct.
const citationSource = source("crossref");
const citation = formatLivingLibraryCitation(citationSource, new Date("2031-04-05T12:00:00Z"));
assert.match(citation, /Accessed 2031-04-05/);
assert.doesNotMatch(citation, /Accessed 2026-08-07/);
assert.match(citation, /DOI and scholarly metadata service/i);
assert.equal(citationSource.verification.urlLastVerified, "2026-08-07");
assert.match(formatLivingLibraryCitation(source("microsoft-academic-graph-legacy"), new Date("2031-04-05T12:00:00Z")), /retired catalog record/);
for (const id of miniExpansionIds) {
  const miniCitation = formatLivingLibraryCitation(source(id), new Date("2031-04-05T12:00:00Z"));
  assert.match(miniCitation, /Accessed 2031-04-05/, `${id} citation must use the action-time access date`);
  assert.doesNotMatch(miniCitation, /Accessed 2026-08-07/, `${id} citation must not reuse the catalog verification date`);
}
assert.equal(source("openaq").access.api, "key/token required");
assert.equal(source("allen-brain-map").access.api, "open/no credential");
assert.equal(source("paleobiology-database").license.attributionRequired, true);
assert.match(source("cochrane-library").license.trainingCaution, /training rights|AI-training/i);

// Route, accessibility, and structural performance contracts.
const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../src/pages/The-Living-Library/index.tsx", import.meta.url), "utf8");
const cardSource = await readFile(new URL("../src/pages/The-Living-Library/LivingLibrarySourceCard.tsx", import.meta.url), "utf8");
const commonsApiSource = await readFile(new URL("../src/pages/The-Commons-Circle/commonsCircleApi.ts", import.meta.url), "utf8");
const savedShelvesSource = await readFile(new URL("../src/pages/The-Commons-Circle/SavedShelvesPage.tsx", import.meta.url), "utf8");
assert.match(appSource, /living-library\/browse\/:categorySlug/);
assert.match(appSource, /living-library\/source\/:sourceId/);
assert.match(pageSource, /legacyCategoryHashMap/);
assert.match(pageSource, /visibleResults = searchResults\.slice\(0, visibleCount\)/, "results must be staged");
assert.match(pageSource, /const pageSize = 12/, "initial render budget must remain bounded");
assert.doesNotMatch(pageSource, /416/, "giant keyword select must not return");
assert.match(cardSource, /external site, opens in a new tab/);
assert.match(cardSource, /aria-pressed=\{saved\}/);
assert.match(pageSource, /aria-live="polite"/);
assert.match(commonsApiSource, /elysiaLivingLibrary\.savedCitationRecords\.v2/);
assert.match(commonsApiSource, /savedSourceIds\.map\(resolveLivingLibrarySource\)/);
assert.match(commonsApiSource, /stored\?\.citationText \?\? citationFor\(source\)/, "Commons sync must preserve action-time citation text when available");
assert.match(savedShelvesSource, /allLivingLibrarySources/, "Saved Shelves must resolve active and legacy IDs");
assert.match(savedShelvesSource, /View historical context/, "Saved Shelves must not label historical links as current official destinations");

console.log(`Living Library catalog tests passed: ${activeLivingLibrarySources.length} active, ${legacyLivingLibrarySources.length} legacy, ${corpus.length} search queries.`);
