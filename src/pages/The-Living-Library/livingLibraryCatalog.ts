import {
  livingLibrarySources as auditedLivingLibraryRecords,
  type LivingLibrarySource as AuditedLivingLibrarySource,
} from "./livingLibrarySources";

export type LivingLibraryLinkRole =
  | "official"
  | "search"
  | "data"
  | "api"
  | "documentation"
  | "download"
  | "code"
  | "license"
  | "citation"
  | "historical"
  | "legacy";

export type LivingLibraryLink = {
  label: string;
  url: string;
  role: LivingLibraryLinkRole;
  primary?: boolean;
  caution?: string;
};

export type LivingLibraryBrowseCategory =
  | "General & Government Data"
  | "Earth, Environment & Climate"
  | "Social, Economic & Policy Data"
  | "Physical Sciences & Space"
  | "Life Sciences & Health"
  | "Scholarly Literature & Citations"
  | "Code, Models & Technical Infrastructure"
  | "Research Practice & Education";

export type LivingLibraryResourceType =
  | "Data catalog or portal"
  | "Research data repository"
  | "Scientific database"
  | "Observatory or monitoring network"
  | "Literature index"
  | "Scholarly metadata or citation infrastructure"
  | "Journal directory"
  | "Preprint repository"
  | "Literature repository"
  | "Citizen-science platform"
  | "API or developer documentation"
  | "Scientific software or code infrastructure"
  | "ML dataset, model, or benchmark resource"
  | "Standards, licensing, or educational resource"
  | "Research publications portal";

export type LivingLibraryPublicAccess =
  | "open"
  | "account optional"
  | "account required"
  | "institutional/subscription required"
  | "mixed/record-dependent"
  | "retired/unavailable";

export type LivingLibraryApiAccess =
  | "no API"
  | "open/no credential"
  | "key/token required"
  | "account required"
  | "OAuth/authentication required"
  | "subscription/institutional"
  | "mixed"
  | "unknown/unverified";

export type LivingLibraryCloudAccess =
  | "not required"
  | "optional"
  | "required for this workflow"
  | "hosted service"
  | "self-hostable alternative"
  | "mixed";

export type LivingLibraryDownloadAccess =
  | "yes"
  | "no"
  | "collection-dependent"
  | "record-dependent"
  | "restricted"
  | "unknown";

export type LivingLibraryReviewStatus =
  | "peer review expected"
  | "mixed"
  | "preprint"
  | "metadata/index only"
  | "repository with varying material"
  | "citizen science"
  | "not applicable";

export type LivingLibraryLifecycle = "active" | "legacy" | "deprecated" | "retired" | "successor available";

export type LivingLibrarySource = AuditedLivingLibrarySource & {
  active: boolean;
  aliases: string[];
  searchKeywords: string[];
  operator: string;
  operatorType: string;
  resourceType: LivingLibraryResourceType;
  browseCategory: LivingLibraryBrowseCategory;
  scienceDomains: string[];
  geography: string[];
  languages: string[];
  links: LivingLibraryLink[];
  access: {
    public: LivingLibraryPublicAccess;
    api: LivingLibraryApiAccess;
    cloud: LivingLibraryCloudAccess;
    download: LivingLibraryDownloadAccess;
    note: string;
  };
  content: {
    reviewStatus: LivingLibraryReviewStatus;
    hostsContent: "yes" | "no" | "mixed";
    note: string;
  };
  license: {
    summary: string;
    termsUrl?: string;
    recordLevelVariation: boolean;
    attributionRequired: boolean | "varies";
    trainingCaution: string;
  };
  lifecycle: {
    status: LivingLibraryLifecycle;
    version?: string;
    parentId?: string;
    successorId?: string;
    legacyReason?: string;
  };
  verification: {
    urlLastVerified: string;
    annotationLastVerified: string;
    licenseAccessLastVerified: string;
    method: string;
    status: "verified" | "manual/gated" | "legacy" | "unavailable";
    finalCanonicalUrl: string;
    limitation?: string;
  };
  citationType: string;
};

type CatalogOverride = Partial<Pick<LivingLibrarySource,
  "name" | "organization" | "sourceType" | "bestFor" | "whyItBelongs" | "limitationsCautions" |
  "licenseReuseNotes" | "privacyEthicsWarnings" | "citationAttributionNotes"
>> & {
  primaryUrl?: string;
  aliases?: string[];
  keywords?: string[];
  operator?: string;
  operatorType?: string;
  resourceType?: LivingLibraryResourceType;
  browseCategory?: LivingLibraryBrowseCategory;
  scienceDomains?: string[];
  geography?: string[];
  languages?: string[];
  links?: LivingLibraryLink[];
  publicAccess?: LivingLibraryPublicAccess;
  apiAccess?: LivingLibraryApiAccess;
  cloudAccess?: LivingLibraryCloudAccess;
  downloadAccess?: LivingLibraryDownloadAccess;
  accessNote?: string;
  reviewStatus?: LivingLibraryReviewStatus;
  hostsContent?: "yes" | "no" | "mixed";
  contentNote?: string;
  termsUrl?: string;
  recordLevelVariation?: boolean;
  attributionRequired?: boolean | "varies";
  trainingCaution?: string;
  citationType?: string;
  version?: string;
  parentId?: string;
  verificationStatus?: LivingLibrarySource["verification"]["status"];
  verificationLimitation?: string;
};

type LegacyDisposition = {
  status: Exclude<LivingLibraryLifecycle, "active">;
  reason: string;
  successorId?: string;
  historicalUrl?: string;
};

export const livingLibraryBrowseCategories: Array<{ id: string; name: LivingLibraryBrowseCategory; description: string }> = [
  { id: "general-data", name: "General & Government Data", description: "National, international, civic, statistical, and cross-domain data gateways." },
  { id: "earth-environment", name: "Earth, Environment & Climate", description: "Atmosphere, weather, oceans, water, biodiversity, agriculture, hazards, and geospatial observation." },
  { id: "social-policy", name: "Social, Economic & Policy Data", description: "Population, housing, labor, economics, public health, and humanitarian evidence with human-context cautions." },
  { id: "physical-space", name: "Physical Sciences & Space", description: "Chemistry, materials, geology, geophysics, astronomy, and planetary science." },
  { id: "life-health", name: "Life Sciences & Health", description: "Biology, genomics, proteins, neuroscience, medicine, and health research." },
  { id: "literature-citations", name: "Scholarly Literature & Citations", description: "Papers, repositories, indexes, DOI infrastructure, citation systems, and scholarly graphs." },
  { id: "code-technical", name: "Code, Models & Technical Infrastructure", description: "Scientific software, code archives, ML datasets, APIs, and local or hosted research infrastructure." },
  { id: "practice-education", name: "Research Practice & Education", description: "Licensing, provenance, research methods, evidence libraries, and responsible reuse guidance." },
];

const legacyDispositions: Record<string, LegacyDisposition> = {
  "nasa-earthdata-cloud": { status: "successor available", successorId: "nasa-earthdata", reason: "Folded into NASA Earthdata as cloud-workflow guidance; it is not a standalone discovery portal." },
  "epa-ejscreen": { status: "retired", reason: "Removed from active discovery because the official resource is unavailable and no equivalent official successor is confirmed." },
  "papers-with-code": { status: "retired", reason: "The former benchmark portal is discontinued; Hugging Face Trending Papers and the surviving data dump are not equivalent replacements.", historicalUrl: "https://github.com/paperswithcode/paperswithcode-data" },
  "microsoft-academic-graph-legacy": { status: "retired", reason: "Microsoft retired the website, APIs, and graph updates on 2021-12-31.", historicalUrl: "https://www.microsoft.com/en-us/research/project/academic/" },
  "the-stack": { status: "legacy", successorId: "the-stack-v2", reason: "Version 1 is retained only for saved-source and version-history compatibility; The Stack v2 is the active family record." },
  "esa": { status: "successor available", successorId: "esa-earth-online--earth-observation-gateway", reason: "The general ESA homepage was folded into the specific Earth Observation Gateway resource." },
  "common-crawl-documentation": { status: "successor available", successorId: "common-crawl", reason: "Documentation is now a typed child link on the Common Crawl resource." },
  "software-heritage-legal--policy-area": { status: "successor available", successorId: "software-heritage", reason: "Legal and policy guidance is now a typed child link on Software Heritage." },
  "bigcode-documentation": { status: "successor available", successorId: "bigcode", reason: "Documentation is now a typed child link on the BigCode family record." },
  "rainforest-trust": { status: "legacy", reason: "Removed from active scientific discovery: the card represented a charity homepage, not a substantial research/data/education gateway." },
  "amazon-conservation-team": { status: "legacy", reason: "Removed from active scientific discovery: the card represented a conservation organization homepage rather than a research infrastructure resource." },
  "sierra-club-foundation": { status: "legacy", reason: "Removed from active scientific discovery: the foundation homepage is not a scientific knowledge gateway." },
  "nrdc": { status: "legacy", reason: "Removed from active scientific discovery: advocacy and policy work alone do not satisfy the science-infrastructure inclusion rule." },
  "earthjustice": { status: "legacy", reason: "Removed from active scientific discovery: a legal advocacy organization is not itself scientific knowledge infrastructure." },
  "digdeep-right-to-water-project": { status: "legacy", reason: "Removed from active scientific discovery: the card represented a service/advocacy organization, not a reusable research portal." },
  "we-act-for-environmental-justice": { status: "legacy", reason: "Removed from active scientific discovery: the card represented advocacy/community organizing rather than a dedicated research gateway." },
  "first-nations-development-institute": { status: "legacy", reason: "Removed from active scientific discovery: the organization card did not identify a substantial scientific resource." },
  "indspire": { status: "legacy", reason: "Removed from active scientific discovery: the education charity homepage is not a scientific knowledge gateway." },
  "fistula-foundation": { status: "legacy", reason: "Removed from active scientific discovery: the medical charity card did not expose a research repository or evidence portal." },
  "every-mother-counts": { status: "legacy", reason: "Removed from active scientific discovery: the advocacy organization card did not expose a dedicated research gateway." },
  "camfed-usa-foundation": { status: "legacy", reason: "Removed from active scientific discovery: the education and leadership organization is valuable but the card was not scientific infrastructure." },
  "miraclefeet": { status: "legacy", reason: "Removed from active scientific discovery: the service charity homepage is not a scientific research gateway." },
  "family-promise": { status: "legacy", reason: "Removed from active scientific discovery: the housing-service organization card is not a scientific data or research resource." },
  "new-incentives": { status: "legacy", reason: "Removed from active scientific discovery: evidence-informed charitable work is not the same as operating a scientific knowledge gateway." },
  "women-for-women-international": { status: "legacy", reason: "Removed from active scientific discovery: the humanitarian organization homepage is not a scientific knowledge resource." },
  "sudanese-american-physicians-association": { status: "legacy", reason: "Removed from active scientific discovery: the relief organization homepage is not a scientific repository." },
  "palestine-children-s-relief-fund": { status: "legacy", reason: "Removed from active scientific discovery: the humanitarian organization homepage is not a scientific repository." },
  "razom-for-ukraine": { status: "legacy", reason: "Removed from active scientific discovery: the relief organization homepage is not a scientific knowledge gateway." },
  "halo-trust-usa": { status: "legacy", reason: "Removed from active scientific discovery: mine-clearance work is important, but the card did not identify a dedicated research/data portal.", historicalUrl: "https://www.halotrust.org/us/" },
  "refugepoint": { status: "legacy", reason: "Removed from active scientific discovery: the refugee-support organization homepage is not a scientific data gateway." },
  "international-rescue-committee": { status: "legacy", reason: "Removed from active scientific discovery: the general humanitarian organization card did not identify a dedicated research repository." },
  "care-international": { status: "legacy", reason: "Removed from active scientific discovery: the humanitarian organization homepage is not a scientific knowledge gateway." },
};

const aliasesById: Record<string, string[]> = {
  "u-s-census-apis": ["Census API", "United States Census Bureau"],
  "data-europa-eu--european-data-portal": ["European Data Portal", "EU data portal"],
  "who-global-health-observatory": ["WHO GHO", "Global Health Observatory"],
  "hdx--humanitarian-data-exchange": ["HDX", "Humanitarian Data Exchange"],
  "nasa-nsidc": ["NSIDC", "NSIDC DAAC", "National Snow and Ice Data Center"],
  "noaa-climate-data-online": ["NOAA CDO", "Climate Data Online"],
  "noaa-ncei-access-data-service": ["NCEI ADS", "NOAA Access Data Service"],
  "nasa-firms": ["FIRMS", "Fire Information for Resource Management System"],
  "usgs-earthexplorer": ["EarthExplorer", "USGS satellite imagery"],
  "copernicus-data-space-ecosystem": ["CDSE", "Copernicus Data Space"],
  "google-earth-engine": ["GEE", "Earth Engine"],
  "openstreetmap": ["OSM"],
  "usgs-epa-water-quality-portal": ["WQP", "Water Quality Portal"],
  "epa-tri--toxics-release-inventory": ["TRI", "Toxics Release Inventory"],
  "gbif": ["Global Biodiversity Information Facility"],
  "iucn-red-list": ["Red List", "IUCN species assessments"],
  "rcsb-protein-data-bank": ["RCSB PDB", "Protein Data Bank", "PDB"],
  "worldwide-protein-data-bank": ["wwPDB", "Worldwide PDB"],
  "pubmed-central--pmc": ["PMC", "PubMed Central"],
  "crossref": ["DOI metadata", "Crossref REST API"],
  "doaj": ["Directory of Open Access Journals"],
  "arxiv": ["arXiv preprints"],
  "software-heritage": ["SWH", "Software Heritage Archive"],
  "the-stack-v2": ["Stack v2", "BigCode Stack v2"],
  "npm-registry": ["npm", "npmjs"],
  "wikipedia-dumps": ["Wikimedia dumps", "Wikipedia database dumps"],
  "postgresql-full-text-search": ["Postgres full text search", "PostgreSQL FTS"],
  "supabase-rls": ["RLS", "row level security", "Postgres RLS"],
  "cloudflare-r2": ["R2", "object storage"],
  "cloudflare-durable-objects": ["Durable Objects"],
  "the-update-framework--tuf": ["TUF", "The Update Framework"],
  "sigstore-cosign": ["Cosign", "Sigstore signing"],
  "coral-reef-alliance": ["CORAL", "Coral Reef Alliance science"],
  "world-wildlife-fund": ["WWF", "WWF science publications"],
  "doctors-without-borders--msf": ["MSF Science Portal", "Médecins Sans Frontières research"],
  "wikimedia-foundation": ["Wikimedia Research", "WMF Research"],
};

const atmosphericKeywords = ["atmosphere", "atmospheric", "meteorology", "weather", "climate", "climatology", "temperature", "precipitation", "rain", "snow", "wind", "storms", "environmental observations", "time series"];
const vocabularyById: Record<string, string[]> = {
  "nasa-earthdata": [...atmosphericKeywords, "earth observation", "satellite", "remote sensing", "ocean", "land", "hydrology"],
  "nasa-open-data-portal": ["NASA datasets", "space science", "earth science", "atmospheric data", "aeronautics"],
  "nasa-nsidc": [...atmosphericKeywords, "cryosphere", "ice", "glaciers", "sea ice", "snow", "polar", "satellite"],
  "noaa-climate-data-online": [...atmosphericKeywords, "climate stations", "historical weather", "drought", "ocean"],
  "noaa-ncei-access-data-service": [...atmosphericKeywords, "REST API", "climate API", "ocean", "environmental data"],
  "nasa-firms": ["wildfire", "wildfires", "fire", "active fire", "hotspots", "smoke", "air quality", "satellite", "remote sensing", "atmospheric"],
  "copernicus-data-space-ecosystem": ["satellite", "remote sensing", "earth observation", "Sentinel", "ocean", "atmosphere", "climate", "land"],
  "google-earth-engine-data-catalog": ["satellite", "remote sensing", "climate", "atmospheric", "ocean", "hydrology", "wildfire", "soil", "geospatial"],
  "google-earth-engine": ["satellite", "remote sensing", "climate", "atmospheric", "ocean", "hydrology", "wildfire", "soil", "geospatial analysis"],
  "usgs-national-hydrography": ["water", "hydrology", "hydrography", "rivers", "streams", "lakes", "watersheds"],
  "usgs-3d-hydrography-program": ["water", "hydrology", "hydrography", "3DHP", "rivers", "streams", "elevation"],
  "usgs-watershed-boundary-dataset": ["water", "hydrology", "watershed", "drainage", "basin", "HUC"],
  "usgs-epa-water-quality-portal": ["water", "hydrology", "water quality", "pollution", "chemistry", "rivers", "lakes"],
  "epa-enviroatlas": ["air quality", "pollution", "ecosystems", "climate", "biodiversity", "environmental health"],
  "epa-tri--toxics-release-inventory": ["air quality", "pollution", "emissions", "toxic chemicals", "industrial facilities", "atmospheric releases"],
  "gbif": ["biodiversity", "species", "ecology", "occurrences", "taxonomy", "conservation", "biogeography"],
  "iucn-red-list": ["biodiversity", "species", "conservation", "extinction risk", "threatened species", "ecology"],
  "inaturalist": ["biodiversity", "species", "ecology", "citizen science", "observations", "conservation"],
  "ebird": ["biodiversity", "birds", "ornithology", "ecology", "citizen science", "species", "migration"],
  "coral-reef-alliance": ["ocean", "marine", "coral", "reefs", "biodiversity", "climate resilience", "conservation science"],
  "world-wildlife-fund": ["biodiversity", "species", "ecology", "conservation", "peer reviewed", "ocean", "forests", "wildlife"],
  "pure-earth": ["air quality", "pollution", "lead", "mercury", "toxic sites", "environmental health", "peer reviewed"],
  "wateraid-america": ["water", "hydrology", "sanitation", "WASH", "public health", "research reports"],
  "usgs-earthquake-catalog": ["earthquake", "earthquakes", "geology", "geophysics", "seismology", "hazards"],
  "usgs-volcano-data": ["volcano", "volcanology", "geology", "geophysics", "hazards"],
  "pubchem": ["chemistry", "chemicals", "compounds", "molecules", "bioassays", "structures"],
  "nist-chemistry-webbook": ["chemistry", "compounds", "spectra", "thermochemistry", "physical chemistry"],
  "materials-project": ["materials", "materials science", "crystals", "structures", "batteries", "computational materials", "API"],
  "nist-jarvis": ["materials", "materials science", "crystals", "structures", "DFT", "machine learning"],
  "open-catalyst-project": ["materials", "catalysis", "chemistry", "machine learning", "benchmark", "structures"],
  "nasa-exoplanet-archive": ["astronomy", "exoplanets", "planets", "stars", "space", "time series"],
  "nasa-ads": ["astronomy", "astrophysics", "papers", "literature", "citations", "peer reviewed", "preprints"],
  "ncbi-datasets": ["genomics", "genes", "genomes", "sequences", "biology", "bioinformatics"],
  "ncbi-e-utilities": ["genomics", "genes", "papers", "PubMed", "API", "bioinformatics"],
  "ensembl": ["genomics", "genes", "genomes", "variants", "comparative genomics", "bioinformatics"],
  "rcsb-protein-data-bank": ["proteins", "structures", "structural biology", "molecules", "PDB"],
  "worldwide-protein-data-bank": ["proteins", "structures", "structural biology", "archive", "PDB"],
  "openneuro": ["neuroscience", "brain imaging", "MRI", "EEG", "health", "research data"],
  "pubmed": ["papers", "literature", "medicine", "health", "epidemiology", "peer reviewed", "biomedical citations"],
  "pubmed-central--pmc": ["papers", "full text", "open access", "medicine", "health", "biomedical literature"],
  "crossref": ["DOI", "digital object identifier", "citations", "metadata", "papers", "literature", "scholarly infrastructure"],
  "openalex": ["papers", "literature", "citations", "DOI", "scholarly graph", "metadata", "authors", "institutions"],
  "semantic-scholar-api": ["papers", "literature", "citations", "scholarly graph", "metadata", "API"],
  "core": ["papers", "literature", "open access", "repositories", "full text", "metadata"],
  "doaj": ["papers", "journals", "peer reviewed", "open access", "literature", "directory"],
  "arxiv": ["papers", "preprint", "preprints", "literature", "physics", "mathematics", "computer science"],
  "web-of-science": ["papers", "peer reviewed", "literature", "citations", "scholarly index", "subscription"],
  "scopus": ["papers", "peer reviewed", "literature", "citations", "scholarly index", "subscription"],
  "dimensions": ["papers", "literature", "citations", "grants", "datasets", "clinical trials", "mixed access"],
  "the-stack-v2": ["code", "software", "machine learning", "training dataset", "benchmark", "licenses", "source code"],
  "common-crawl": ["web corpus", "web archive", "machine learning", "training data", "bulk download", "WARC"],
  "doctors-without-borders--msf": ["papers", "peer reviewed", "health", "epidemiology", "humanitarian medicine", "research portal"],
  "wikimedia-foundation": ["research", "papers", "open knowledge", "Wikipedia", "datasets", "knowledge integrity"],
  "creative-commons": ["license", "licensing", "copyright", "attribution", "reuse", "open access", "Creative Commons"],
  "hugging-face-dataset-cards": ["license", "licensing", "dataset documentation", "provenance", "metadata", "responsible AI"],
};

const operatorOverrides: Record<string, [string, string]> = {
  "data-gov": ["U.S. General Services Administration", "government"],
  "usaspending-gov": ["U.S. Department of the Treasury", "government"],
  "u-s-census-apis": ["U.S. Census Bureau", "government"],
  "u-s-census-microdata-api": ["U.S. Census Bureau", "government"],
  "hud-user--hud-data": ["HUD Office of Policy Development and Research", "government"],
  "fred": ["Federal Reserve Bank of St. Louis", "government/public institution"],
  "fred-api": ["Federal Reserve Bank of St. Louis", "government/public institution"],
  "bls-public-data-api": ["U.S. Bureau of Labor Statistics", "government"],
  "data-gov-uk": ["Government Digital Service, United Kingdom", "government"],
  "data-gov-au": ["Australian Government", "government"],
  "data-gov-in": ["Government of India", "government"],
  "data-gov-sg": ["Government Technology Agency of Singapore", "government"],
  "data-gov-my": ["Government of Malaysia", "government"],
  "data-europa-eu--european-data-portal": ["Publications Office of the European Union", "intergovernmental"],
  "eurostat": ["Eurostat, European Commission", "intergovernmental"],
  "undata": ["United Nations Statistics Division", "intergovernmental"],
  "hdx--humanitarian-data-exchange": ["United Nations OCHA", "intergovernmental"],
  "who-global-health-observatory": ["World Health Organization", "intergovernmental"],
  "who-health-inequality-data-repository": ["World Health Organization", "intergovernmental"],
  "unhcr-refugee-data-finder": ["UNHCR", "intergovernmental"],
  "google-dataset-search": ["Google", "commercial"],
  "kaggle-datasets": ["Kaggle (Google)", "commercial"],
  "registry-of-open-data-on-aws": ["Amazon Web Services", "commercial"],
  "zenodo": ["CERN", "intergovernmental research organization"],
  "harvard-dataverse": ["Harvard Institute for Quantitative Social Science", "academic"],
  "osf": ["Center for Open Science", "nonprofit"],
  "figshare": ["Figshare (Digital Science)", "commercial"],
  "nasa-earthdata": ["NASA Earth Science Data Systems", "government"],
  "nasa-open-data-portal": ["NASA", "government"],
  "nasa-nsidc": ["NSIDC at CIRES, University of Colorado Boulder; NASA-managed DAAC", "academic/government partnership"],
  "noaa-climate-data-online": ["NOAA National Centers for Environmental Information", "government"],
  "noaa-ncei-access-data-service": ["NOAA National Centers for Environmental Information", "government"],
  "nasa-firms": ["NASA Earth Science Data and Information System", "government"],
  "usgs-earthexplorer": ["U.S. Geological Survey", "government"],
  "usgs-national-hydrography": ["U.S. Geological Survey", "government"],
  "usgs-3d-hydrography-program": ["U.S. Geological Survey", "government"],
  "usgs-watershed-boundary-dataset": ["U.S. Geological Survey", "government"],
  "usgs-earthquake-catalog": ["U.S. Geological Survey", "government"],
  "usgs-volcano-data": ["U.S. Geological Survey", "government"],
  "usgs-epa-water-quality-portal": ["U.S. Geological Survey, EPA, and National Water Quality Monitoring Council", "government consortium"],
  "copernicus-data-space-ecosystem": ["European Commission Copernicus Programme", "intergovernmental"],
  "google-earth-engine-data-catalog": ["Google", "commercial"],
  "google-earth-engine": ["Google", "commercial"],
  "google-bigquery-public-datasets": ["Google Cloud", "commercial"],
  "openstreetmap": ["OpenStreetMap Foundation and contributors", "nonprofit/community"],
  "epa-enterprise-data-catalog": ["U.S. Environmental Protection Agency", "government"],
  "epa-enviroatlas": ["U.S. Environmental Protection Agency", "government"],
  "epa-tri--toxics-release-inventory": ["U.S. Environmental Protection Agency", "government"],
  "usda-nass-quick-stats": ["USDA National Agricultural Statistics Service", "government"],
  "usda-nass-api": ["USDA National Agricultural Statistics Service", "government"],
  "ipums": ["University of Minnesota", "academic"],
  "pubchem": ["National Center for Biotechnology Information", "government"],
  "nist-chemistry-webbook": ["National Institute of Standards and Technology", "government"],
  "materials-project": ["Lawrence Berkeley National Laboratory", "government research laboratory"],
  "nist-data-repository": ["National Institute of Standards and Technology", "government"],
  "nist-jarvis": ["National Institute of Standards and Technology", "government"],
  "nasa-exoplanet-archive": ["NASA Exoplanet Science Institute at Caltech/IPAC", "government/academic partnership"],
  "nasa-ads": ["Smithsonian Astrophysical Observatory under NASA funding", "academic/government partnership"],
  "nasa-ads-api": ["Smithsonian Astrophysical Observatory under NASA funding", "academic/government partnership"],
  "esa-earth-online--earth-observation-gateway": ["European Space Agency", "intergovernmental"],
  "ncbi-datasets": ["National Center for Biotechnology Information", "government"],
  "ncbi-e-utilities": ["National Center for Biotechnology Information", "government"],
  "pubmed-apis": ["National Center for Biotechnology Information", "government"],
  "pubmed": ["U.S. National Library of Medicine", "government"],
  "pubmed-central--pmc": ["U.S. National Library of Medicine", "government"],
  "ensembl": ["EMBL-EBI", "intergovernmental research organization"],
  "rcsb-protein-data-bank": ["RCSB PDB consortium", "academic consortium"],
  "worldwide-protein-data-bank": ["Worldwide Protein Data Bank consortium", "international consortium"],
  "openneuro": ["Stanford Center for Reproducible Neuroscience", "academic"],
  "openalex": ["OurResearch", "nonprofit"],
  "semantic-scholar-api": ["Allen Institute for AI", "nonprofit research institute"],
  "core": ["The Open University", "academic"],
  "arxiv": ["Cornell University", "academic"],
  "web-of-science": ["Clarivate", "commercial"],
  "scopus": ["Elsevier", "commercial"],
  "dimensions": ["Digital Science", "commercial"],
  "software-heritage": ["Software Heritage", "nonprofit research infrastructure"],
  "the-stack-v2": ["BigCode project", "open research collaboration"],
  "pypi": ["Python Software Foundation", "nonprofit"],
  "npm-registry": ["npm / GitHub", "commercial"],
  "cran": ["R Foundation and CRAN maintainers", "nonprofit/community"],
  "github": ["GitHub", "commercial"],
  "gitlab": ["GitLab", "commercial/open-source"],
  "codeberg": ["Codeberg e.V.", "nonprofit"],
  "forgejo": ["Forgejo community", "open-source/community"],
  "stack-exchange-data-dump": ["Stack Exchange and Internet Archive", "commercial/nonprofit partnership"],
  "stack-overflow": ["Stack Overflow", "commercial/community"],
  "stack-exchange": ["Stack Exchange", "commercial/community"],
  "wikipedia-dumps": ["Wikimedia Foundation", "nonprofit"],
  "wikimedia-commons": ["Wikimedia Foundation and volunteer communities", "nonprofit/community"],
  "postgresql-full-text-search": ["PostgreSQL Global Development Group", "open-source/community"],
  "supabase-vector-columns": ["Supabase", "commercial/open-source"],
  "supabase-rls": ["Supabase and PostgreSQL communities", "commercial/open-source"],
  "supabase-storage": ["Supabase", "commercial/open-source"],
  "cloudflare-r2": ["Cloudflare", "commercial"],
  "cloudflare-queues": ["Cloudflare", "commercial"],
  "cloudflare-durable-objects": ["Cloudflare", "commercial"],
  "cloudflare-turnstile": ["Cloudflare", "commercial"],
  "tauri": ["Tauri Programme within the Commons Conservancy", "open-source/nonprofit"],
  "tauri-updater-docs": ["Tauri Programme within the Commons Conservancy", "open-source/nonprofit"],
  "docker-security-docs": ["Docker", "commercial/open-source"],
  "apparmor": ["Canonical / Ubuntu", "commercial/open-source"],
  "sigstore": ["Sigstore project under the Linux Foundation", "open-source/nonprofit"],
  "sigstore-cosign": ["Sigstore project under the Linux Foundation", "open-source/nonprofit"],
  "hugging-face-dataset-cards": ["Hugging Face", "commercial/open-source"],
  "coral-reef-alliance": ["Coral Reef Alliance", "nonprofit research/education"],
  "world-wildlife-fund": ["World Wildlife Fund", "nonprofit research/education"],
  "eesi": ["Environmental and Energy Study Institute", "nonprofit education/policy"],
  "pure-earth": ["Pure Earth", "nonprofit research"],
  "wateraid-america": ["WaterAid", "nonprofit research/education"],
  "doctors-without-borders--msf": ["Médecins Sans Frontières / Doctors Without Borders", "nonprofit medical research"],
  "wikimedia-foundation": ["Wikimedia Foundation Research team", "nonprofit research"],
};

const overrides: Record<string, CatalogOverride> = {
  "data-gov-in": {
    primaryUrl: "https://www.data.gov.in/",
    verificationStatus: "manual/gated",
    verificationLimitation: "The official destination redirects to www.data.gov.in but its edge service denied both polite HTTP and headless-browser requests during final verification. This is an automation challenge, not evidence that the public portal is retired.",
  },
  "hud-user--hud-data": {
    primaryUrl: "https://www.huduser.gov/portal/pdrdatas_landing.html",
    publicAccess: "mixed/record-dependent",
    accessNote: "Public products coexist with registered downloads and restricted-use application workflows; check the specific HUD dataset.",
  },
  "data-europa-eu--european-data-portal": { primaryUrl: "https://data.europa.eu/en" },
  "undata": {
    primaryUrl: "https://data.un.org/",
    accessNote: "The official UNdata service now responds over HTTPS; individual source databases and downloads retain their own terms.",
  },
  "unhcr-refugee-data-finder": {
    primaryUrl: "https://www.unhcr.org/refugee-statistics",
    name: "UNHCR Refugee Statistics",
    bestFor: "Official refugee, asylum, displacement, return, and statelessness statistics and data tools.",
    contentNote: "This is UNHCR's refugee-statistics resource family, not a generic organization homepage. Human data requires aggregation and protection care.",
  },
  "google-dataset-search": {
    hostsContent: "no",
    reviewStatus: "metadata/index only",
    contentNote: "A discovery index that links to third-party datasets; it does not host the records, grant reuse rights, or certify quality.",
  },
  "nasa-nsidc": {
    name: "NASA NSIDC DAAC",
    publicAccess: "account required",
    accessNote: "Catalog information is public; downloading DAAC data requires NASA Earthdata Login. NSIDC is part of CIRES at CU Boulder and operates this NASA-managed DAAC.",
  },
  "nasa-earthdata": {
    publicAccess: "mixed/record-dependent",
    apiAccess: "key/token required",
    cloudAccess: "optional",
    downloadAccess: "yes",
    reviewStatus: "repository with varying material",
    hostsContent: "mixed",
    accessNote: "Earthdata Search metadata is public. Downloading most NASA Earth science holdings requires a free Earthdata Login; APIs, cloud workflows, and provider-specific services can require tokens or additional setup.",
    contentNote: "NASA Earthdata is a program-level gateway and search system across distributed NASA Earth science data centers. It indexes and brokers access to datasets; individual DAACs host and steward many of the underlying records.",
    links: [
      { role: "search", label: "Search NASA Earthdata", url: "https://search.earthdata.nasa.gov/search" },
      { role: "documentation", label: "Earthdata Cloud workflow guidance", url: "https://nasa-openscapes.github.io/earthdata-cloud-cookbook/when-to-cloud.html", caution: "Guidance, not a standalone data portal." },
    ],
  },
  "google-earth-engine": {
    reviewStatus: "repository with varying material",
    hostsContent: "mixed",
    contentNote: "Google Earth Engine is a hosted geospatial analysis platform with a catalog of provider datasets. Dataset provenance, validation, license, and review status vary by collection.",
  },
  "google-earth-engine-data-catalog": {
    reviewStatus: "repository with varying material",
    hostsContent: "mixed",
    contentNote: "The Earth Engine Data Catalog describes datasets available to the hosted Earth Engine platform; it is not a peer-review certification and collection terms vary.",
  },
  "imf-data-portal": {
    primaryUrl: "https://www.imf.org/en/Data",
    verificationStatus: "manual/gated",
    verificationLimitation: "The official IMF Data destination was denied by the edge service during polite HTTP and headless-browser checks; the response is treated as automation ambiguity, not retirement.",
  },
  "ensembl": {
    verificationLimitation: "The live Ensembl 116 page announces an upcoming transition to the new Ensembl platform and preserves a release archive. The current official URL remained live at final verification.",
  },
  "noaa-ncei-access-data-service": {
    primaryUrl: "https://www.ncei.noaa.gov/support/access-data-service-api-user-documentation",
    links: [{ role: "api", label: "NCEI Access Data Service v1 endpoint", url: "https://www.ncei.noaa.gov/access/services/data/v1" }],
    apiAccess: "open/no credential",
    downloadAccess: "collection-dependent",
    accessNote: "The documented REST endpoint is public; supported formats, volume, and bulk pathways depend on the dataset.",
  },
  "google-bigquery-public-datasets": {
    primaryUrl: "https://docs.cloud.google.com/bigquery/public-data",
    browseCategory: "General & Government Data",
    scienceDomains: ["Cross-domain public datasets", "Cloud data systems"],
    publicAccess: "open",
    apiAccess: "account required",
    cloudAccess: "required for this workflow",
    accessNote: "Documentation is public. Querying requires a Google Cloud project; billing setup, query costs, and dataset-specific licenses are separate concerns.",
  },
  "epa-enterprise-data-catalog": { primaryUrl: "https://www.epa.gov/data/enterprise-data-catalog" },
  "inaturalist": {
    reviewStatus: "citizen science",
    contentNote: "Citizen-science observations vary in identification confidence, sampling coverage, spatial bias, location sensitivity, and item-level media licensing.",
  },
  "ebird": {
    reviewStatus: "citizen science",
    publicAccess: "mixed/record-dependent",
    apiAccess: "mixed",
    downloadAccess: "record-dependent",
    contentNote: "Citizen-science observations are powerful but spatially and behaviorally biased; sensitive species locations and product-specific access rules require care.",
  },
  "materials-project": {
    primaryUrl: "https://next-gen.materialsproject.org/",
    links: [
      { role: "legacy", label: "Materials Project legacy interface", url: "https://legacy.materialsproject.org/", caution: "Legacy interface; not the primary destination." },
      { role: "code", label: "Materials Project official code", url: "https://github.com/materialsproject" },
    ],
    apiAccess: "key/token required",
    verificationStatus: "manual/gated",
    verificationLimitation: "The official next-generation portal actively blocks automated user agents and directs API users to the mp-api client. Public human access and API/account requirements remain distinct.",
  },
  "nist-data-repository": { primaryUrl: "https://data.nist.gov/sdp/" },
  "pubmed": {
    reviewStatus: "metadata/index only",
    hostsContent: "no",
    contentNote: "PubMed indexes biomedical citations and abstracts. It is not a full-text host and inclusion is not itself a peer-review guarantee.",
  },
  "pubmed-central--pmc": {
    reviewStatus: "repository with varying material",
    hostsContent: "yes",
    contentNote: "PMC hosts full text, but article version, review status, and reuse license vary by record; open access does not create a uniform license.",
  },
  "crossref": {
    sourceType: "DOI registration and scholarly metadata infrastructure",
    resourceType: "Scholarly metadata or citation infrastructure",
    reviewStatus: "metadata/index only",
    hostsContent: "no",
    bestFor: "Resolving DOIs and finding publisher-deposited scholarly metadata, references, funding, license, and update relationships.",
    contentNote: "Crossref registers DOIs, collects metadata, and links outward. It does not host the paper full text or certify peer review.",
    citationType: "DOI and scholarly metadata service",
  },
  "openalex": {
    reviewStatus: "metadata/index only",
    hostsContent: "no",
    contentNote: "A scholarly metadata graph and discovery layer, not a paper host or peer-review authority.",
  },
  "semantic-scholar-api": {
    reviewStatus: "metadata/index only",
    hostsContent: "no",
    apiAccess: "mixed",
    contentNote: "Literature metadata and graph access; not a full-text repository or a peer-review authority. API policies and key/rate-limit rules vary by endpoint and use.",
  },
  "core": {
    reviewStatus: "repository with varying material",
    hostsContent: "mixed",
    contentNote: "CORE aggregates repository metadata and open-access content. Hosting, version, license, and review status vary by record.",
  },
  "doaj": {
    reviewStatus: "metadata/index only",
    hostsContent: "no",
    contentNote: "A screened journal directory/index. Inclusion does not independently validate every article or make article licenses uniform.",
  },
  "arxiv": {
    reviewStatus: "preprint",
    hostsContent: "yes",
    contentNote: "Primarily preprints that have not necessarily passed journal peer review. Version, endorsement, withdrawal, and license details remain record-specific.",
  },
  "web-of-science": {
    publicAccess: "institutional/subscription required",
    apiAccess: "subscription/institutional",
    accessNote: "The public landing/authentication path is verified; full search, API, and entitlement behavior requires a subscription or institutional account and was not independently exercised.",
  },
  "scopus": {
    primaryUrl: "https://www.scopus.com/pages/home",
    publicAccess: "institutional/subscription required",
    apiAccess: "subscription/institutional",
    accessNote: "The official landing page is verified. Full functionality may require subscription, institutional, or member access and was not independently exercised.",
  },
  "dimensions": {
    publicAccess: "mixed/record-dependent",
    apiAccess: "subscription/institutional",
    accessNote: "Public discovery and paid/institutional features coexist; the complete entitlement split was not independently verified without an account.",
  },
  "the-stack-v2": {
    version: "2",
    parentId: "bigcode",
    contentNote: "Version 2 supersedes the active-catalog role of The Stack v1. Source provenance, repository licenses, opt-out history, PII handling, and training permission remain record/repository-specific.",
  },
  "software-heritage": {
    links: [{ role: "license", label: "Software Heritage legal and policy guidance", url: "https://www.softwareheritage.org/legal/" }],
  },
  "bigcode": {
    links: [{ role: "documentation", label: "BigCode documentation", url: "https://www.bigcode-project.org/docs/" }],
  },
  "common-crawl": {
    links: [{ role: "documentation", label: "Common Crawl get started documentation", url: "https://commoncrawl.org/get-started" }],
    downloadAccess: "yes",
    contentNote: "A large web crawl corpus, not a quality-screened or consent-certified dataset. Copyright, privacy, robots history, and downstream-use constraints require independent review.",
  },
  "npm-registry": { primaryUrl: "https://www.npmjs.com/" },
  "gitlab": {
    primaryUrl: "https://gitlab.com/explore/projects",
    cloudAccess: "optional",
    accessNote: "Public SaaS repository discovery is linked. GitLab also supports self-managed installations; repository visibility and licenses vary.",
  },
  "stack-overflow": {
    primaryUrl: "https://stackoverflow.com/questions",
    verificationStatus: "manual/gated",
    verificationLimitation: "Cloudflare bot verification blocked automated and headless-browser checks; this is not classified as a broken public destination.",
  },
  "wikimedia-commons": {
    browseCategory: "Research Practice & Education",
    resourceType: "Standards, licensing, or educational resource",
    scienceDomains: ["Open media", "Scientific illustration", "Education"],
    reviewStatus: "repository with varying material",
    contentNote: "An open-media repository, not a code dataset. Accuracy, provenance, and file-by-file licenses vary.",
  },
  "ollama": {
    cloudAccess: "optional",
    accessNote: "Local operation remains available. Optional cloud models and hosted features mean cloud use is a workflow choice, not an unconditional product-level 'No'.",
  },
  "supabase-rls": {
    publicAccess: "open",
    apiAccess: "no API",
    cloudAccess: "optional",
    accessNote: "The documentation is public. PostgreSQL row-level security is not inherently cloud-only; Supabase's hosted service requires an account, while self-hosting is possible.",
    contentNote: "Documentation about a database security capability, not a dataset or independent API resource.",
  },
  "tauri": { primaryUrl: "https://v2.tauri.app/" },
  "sigstore-cosign": {
    primaryUrl: "https://docs.sigstore.dev/quickstart/quickstart-cosign/",
    apiAccess: "no API",
    accessNote: "Public CLI documentation. Keyless signing can use OIDC identity and publishes transparency-log metadata; those are identity/privacy facts, not ordinary signup badges.",
  },
  "coral-reef-alliance": {
    primaryUrl: "https://coral.org/how-we-work/scientific-leadership/",
    name: "Coral Reef Alliance — Conservation Science",
    sourceType: "Conservation science and education resource",
    resourceType: "Research publications portal",
    browseCategory: "Earth, Environment & Climate",
    scienceDomains: ["Marine science", "Coral reefs", "Climate adaptation", "Conservation"],
    bestFor: "Applied coral-reef adaptation research, conservation methods, and science-to-practice education.",
    contentNote: "A nonprofit's applied conservation-science resource, not an independent literature index or blanket peer-review guarantee.",
  },
  "world-wildlife-fund": {
    primaryUrl: "https://www.worldwildlife.org/resources/peer-reviewed-publications/",
    name: "WWF Peer-Reviewed Publications",
    sourceType: "Conservation research publications portal",
    resourceType: "Research publications portal",
    browseCategory: "Earth, Environment & Climate",
    scienceDomains: ["Conservation science", "Biodiversity", "Ecology", "Climate"],
    bestFor: "Finding WWF-affiliated peer-reviewed conservation research with full citations and journal destinations.",
    reviewStatus: "peer review expected",
    hostsContent: "mixed",
    contentNote: "This curated portal points to peer-reviewed WWF-affiliated work; journal access and reuse remain article-specific.",
  },
  "eesi": {
    primaryUrl: "https://www.eesi.org/papers",
    name: "EESI White Papers, Fact Sheets & Issue Briefs",
    sourceType: "Climate and energy education resource",
    resourceType: "Standards, licensing, or educational resource",
    browseCategory: "Research Practice & Education",
    scienceDomains: ["Climate", "Energy", "Environmental policy", "Science communication"],
    bestFor: "Beginner-readable climate, energy, resilience, and environmental-policy fact sheets and issue briefs.",
    reviewStatus: "not applicable",
    hostsContent: "yes",
    contentNote: "An educational/policy publication library, not a peer-reviewed journal index; follow its cited primary evidence.",
  },
  "pure-earth": {
    primaryUrl: "https://www.pureearth.org/our-research/",
    name: "Pure Earth Research",
    sourceType: "Pollution research and reports portal",
    resourceType: "Research publications portal",
    browseCategory: "Earth, Environment & Climate",
    scienceDomains: ["Pollution", "Environmental health", "Lead", "Mercury"],
    bestFor: "Research, reports, and scientific publications about toxic pollution, lead exposure, mercury, and polluted sites.",
    reviewStatus: "mixed",
    hostsContent: "mixed",
    contentNote: "Combines peer-reviewed research, organizational reports, and technical resources; distinguish publication type and terms item by item.",
  },
  "wateraid-america": {
    primaryUrl: "https://www.wateraid.org/washmatters/resources",
    name: "WaterAid WASH Matters Publications",
    sourceType: "Water and sanitation research publications portal",
    resourceType: "Research publications portal",
    browseCategory: "Earth, Environment & Climate",
    scienceDomains: ["Water", "Sanitation", "Hygiene", "Public health", "Climate resilience"],
    bestFor: "Research reports, technical briefs, tools, and guidelines on water, sanitation, hygiene, and climate resilience.",
    reviewStatus: "mixed",
    hostsContent: "yes",
    contentNote: "A mixed organizational publication library; research reports, policy papers, toolkits, and guidelines are not all peer reviewed.",
  },
  "doctors-without-borders--msf": {
    primaryUrl: "https://scienceportal.msf.org/",
    name: "MSF Science Portal",
    sourceType: "Humanitarian medical research portal",
    resourceType: "Research publications portal",
    browseCategory: "Life Sciences & Health",
    scienceDomains: ["Medicine", "Epidemiology", "Global health", "Humanitarian health"],
    bestFor: "MSF research articles, conference materials, technical reports, protocols, and medical evidence by topic or country.",
    reviewStatus: "mixed",
    hostsContent: "mixed",
    contentNote: "Includes peer-reviewed journal articles and other expert/technical materials; content type and reuse terms must be checked per item.",
    termsUrl: "https://scienceportal.msf.org/terms-of-use",
  },
  "wikimedia-foundation": {
    primaryUrl: "https://research.wikimedia.org/",
    name: "Wikimedia Research",
    sourceType: "Open knowledge research program",
    resourceType: "Research publications portal",
    browseCategory: "Research Practice & Education",
    scienceDomains: ["Open knowledge", "Information science", "Knowledge integrity", "Human-computer interaction"],
    bestFor: "Open Wikimedia research, methods, datasets, tools, and studies of knowledge gaps and integrity.",
    reviewStatus: "mixed",
    hostsContent: "yes",
    contentNote: "Open research outputs from the Wikimedia Foundation and collaborators; method, review status, and license remain output-specific.",
  },
};

const openApiIds = new Set([
  "u-s-census-apis", "fred-api", "bls-public-data-api", "data-gov-uk", "data-gov-au", "data-gov-in", "data-gov-sg",
  "data-gov-my", "data-europa-eu--european-data-portal", "eurostat", "undata", "world-bank-data", "oecd-data-explorer",
  "faostat", "who-global-health-observatory", "cdc-wonder", "openml", "google-dataset-search", "nasa-open-data-portal",
  "noaa-ncei-access-data-service", "nasa-firms", "openstreetmap", "usgs-epa-water-quality-portal", "epa-tri--toxics-release-inventory",
  "gbif", "iucn-red-list", "inaturalist", "unep-data-resources--wesr", "u-s-census-microdata-api", "pubchem",
  "nist-data-repository", "nist-jarvis", "nasa-exoplanet-archive", "usgs-earthquake-catalog", "ncbi-datasets", "ncbi-e-utilities",
  "pubmed-apis", "ensembl", "rcsb-protein-data-bank", "worldwide-protein-data-bank", "pubmed", "pubmed-central--pmc",
  "crossref", "openalex", "core", "doaj", "arxiv", "software-heritage", "gh-archive", "common-crawl", "pypi", "npm-registry",
  "cran", "github", "gitlab", "codeberg", "stack-exchange", "wikipedia-dumps", "wikimedia-commons",
]);

const keyedApiIds = new Set([
  "fred", "imf-data-portal", "hdx--humanitarian-data-exchange", "hugging-face-datasets", "kaggle-datasets", "harvard-dataverse",
  "figshare", "registry-of-open-data-on-aws", "nasa-earthdata", "nasa-nsidc", "noaa-climate-data-online", "google-earth-engine-data-catalog",
  "google-earth-engine", "usda-nass-quick-stats", "usda-nass-api", "ipums", "materials-project", "nasa-ads", "nasa-ads-api",
  "semantic-scholar-api", "the-stack-v2",
]);

const institutionalIds = new Set(["web-of-science", "scopus", "dimensions"]);
const citizenScienceIds = new Set(["inaturalist", "ebird"]);
const literatureIndexIds = new Set(["nasa-ads", "pubmed", "crossref", "openalex", "semantic-scholar-api", "doaj", "web-of-science", "scopus", "dimensions"]);
const technicalCategoryIds = new Set(["Model Training Commons", "Code Datasets", "Local AI Tools", "Elysia Technical Foundations"]);

function unique(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function defaultBrowseCategory(source: AuditedLivingLibrarySource): LivingLibraryBrowseCategory {
  if (source.category === "Environmental Data") return "Earth, Environment & Climate";
  if (source.category === "Social & Economic Data") return "Social, Economic & Policy Data";
  if (source.category === "Physical Science Data") return "Physical Sciences & Space";
  if (source.category === "Biology & Health Data") return "Life Sciences & Health";
  if (source.category === "Research Papers & Scholarly Graphs") return "Scholarly Literature & Citations";
  if (technicalCategoryIds.has(source.category)) return "Code, Models & Technical Infrastructure";
  if (source.category === "Dataset Ethics & Licensing") return "Research Practice & Education";
  return "General & Government Data";
}

function defaultResourceType(source: AuditedLivingLibrarySource): LivingLibraryResourceType {
  const value = `${source.sourceType} ${source.name}`.toLowerCase();
  if (value.includes("preprint")) return "Preprint repository";
  if (value.includes("citizen-science")) return "Citizen-science platform";
  if (value.includes("journal directory")) return "Journal directory";
  if (value.includes("literature index") || value.includes("scholarly graph") || value.includes("literature api")) return "Literature index";
  if (value.includes("api") || value.includes("documentation")) return "API or developer documentation";
  if (value.includes("ml ") || value.includes("model") || value.includes("benchmark") || value.includes("code dataset")) return "ML dataset, model, or benchmark resource";
  if (value.includes("code") || value.includes("package") || value.includes("repository hosting") || value.includes("open-source tool") || value.includes("security")) return "Scientific software or code infrastructure";
  if (value.includes("database")) return "Scientific database";
  if (value.includes("research repository") || value.includes("literature repository")) return value.includes("literature") ? "Literature repository" : "Research data repository";
  if (value.includes("ethics") || value.includes("licens")) return "Standards, licensing, or educational resource";
  return "Data catalog or portal";
}

function defaultDomains(source: AuditedLivingLibrarySource, browseCategory: LivingLibraryBrowseCategory) {
  const categoryDomain: Record<LivingLibraryBrowseCategory, string> = {
    "General & Government Data": "Cross-domain data",
    "Earth, Environment & Climate": "Earth and environmental science",
    "Social, Economic & Policy Data": "Social and policy research",
    "Physical Sciences & Space": "Physical science",
    "Life Sciences & Health": "Life and health science",
    "Scholarly Literature & Citations": "Scholarly communication",
    "Code, Models & Technical Infrastructure": "Research computing",
    "Research Practice & Education": "Research practice",
  };
  return unique([categoryDomain[browseCategory], ...source.primaryTopics.slice(0, 4)]);
}

function defaultPublicAccess(source: AuditedLivingLibrarySource): LivingLibraryPublicAccess {
  if (institutionalIds.has(source.id)) return "institutional/subscription required";
  if (source.sourceType === "Documentation" || source.sourceType === "Open-source tool" || source.sourceType.includes("framework")) return "open";
  if (source.signupRequired === "No") return "open";
  if (source.signupRequired === "Yes") return "account required";
  if (source.signupRequired === "Optional") return "account optional";
  return "mixed/record-dependent";
}

function defaultApiAccess(source: AuditedLivingLibrarySource): LivingLibraryApiAccess {
  if (institutionalIds.has(source.id)) return "subscription/institutional";
  if (openApiIds.has(source.id)) return "open/no credential";
  if (keyedApiIds.has(source.id)) return "key/token required";
  if (source.apiAvailable === "No") return "no API";
  return source.apiAvailable === "Yes" ? "mixed" : "unknown/unverified";
}

function defaultCloudAccess(source: AuditedLivingLibrarySource): LivingLibraryCloudAccess {
  if (["ollama", "open-webui", "pgvector", "forgejo", "fastapi", "tauri"].includes(source.id)) return "optional";
  if (source.cloudRequired === "No") return "not required";
  if (source.cloudRequired === "Optional") return "optional";
  if (source.cloudRequired === "Yes") return "hosted service";
  return "mixed";
}

function defaultDownloadAccess(source: AuditedLivingLibrarySource): LivingLibraryDownloadAccess {
  if (source.bulkDownloadAvailable === "Yes") return "yes";
  if (source.bulkDownloadAvailable === "No") return "no";
  if (source.bulkDownloadAvailable === "Sometimes") return "collection-dependent";
  if (source.bulkDownloadAvailable === "Varies") return "record-dependent";
  return "unknown";
}

function defaultReviewStatus(source: AuditedLivingLibrarySource): LivingLibraryReviewStatus {
  if (source.id === "arxiv") return "preprint";
  if (citizenScienceIds.has(source.id)) return "citizen science";
  if (literatureIndexIds.has(source.id)) return "metadata/index only";
  if (source.sourceType.includes("repository") || source.sourceType.includes("archive") || source.sourceType.includes("portal")) return "repository with varying material";
  return "not applicable";
}

function defaultHostsContent(source: AuditedLivingLibrarySource) {
  const value = source.sourceType.toLowerCase();
  if (value.includes("index") || value.includes("directory") || source.id === "crossref" || source.id === "google-dataset-search") return "no" as const;
  if (value.includes("repository") || value.includes("archive") || value.includes("database")) return "yes" as const;
  return "mixed" as const;
}

function defaultCitationType(resourceType: LivingLibraryResourceType) {
  const mapping: Partial<Record<LivingLibraryResourceType, string>> = {
    "Data catalog or portal": "data portal",
    "Research data repository": "research data repository",
    "Scientific database": "scientific database",
    "Observatory or monitoring network": "observatory or monitoring resource",
    "Literature index": "scholarly index",
    "Scholarly metadata or citation infrastructure": "citation infrastructure",
    "Journal directory": "journal directory",
    "Preprint repository": "preprint repository",
    "Literature repository": "literature repository",
    "Citizen-science platform": "citizen-science platform",
    "API or developer documentation": "API or documentation resource",
    "Scientific software or code infrastructure": "software or project resource",
    "ML dataset, model, or benchmark resource": "dataset or benchmark resource",
    "Standards, licensing, or educational resource": "reference resource",
    "Research publications portal": "research publications portal",
  };
  return mapping[resourceType] ?? "scientific resource";
}

function sourceLinks(source: AuditedLivingLibrarySource, override: CatalogOverride, primaryUrl: string, legacy?: LegacyDisposition): LivingLibraryLink[] {
  return [
    legacy?.historicalUrl
      ? { role: "historical", label: `Historical context for ${override.name ?? source.name}`, url: primaryUrl, primary: true, caution: "Historical context only; this is not a current active resource destination." }
      : { role: "official", label: `Open ${override.name ?? source.name}`, url: primaryUrl, primary: true },
    ...(override.links ?? []),
  ];
}

function createCatalogSource(source: AuditedLivingLibrarySource): LivingLibrarySource {
  const override = overrides[source.id] ?? {};
  const legacy = legacyDispositions[source.id];
  const primaryUrl = override.primaryUrl ?? legacy?.historicalUrl ?? source.officialUrl;
  const browseCategory = override.browseCategory ?? defaultBrowseCategory(source);
  const resourceType = override.resourceType ?? defaultResourceType(source);
  const operator = override.operator ?? operatorOverrides[source.id]?.[0] ?? source.organization;
  const operatorType = override.operatorType ?? operatorOverrides[source.id]?.[1] ?? (source.category === "Trusted Data Portals" ? "official public infrastructure" : "resource operator");
  const publicAccess = legacy?.status === "retired" ? "retired/unavailable" : override.publicAccess ?? defaultPublicAccess(source);
  const aliases = unique([...(aliasesById[source.id] ?? []), source.organization !== operator ? source.organization : undefined]);
  const scienceDomains = override.scienceDomains ?? defaultDomains(source, browseCategory);
  const searchKeywords = unique([
    ...(vocabularyById[source.id] ?? []),
    ...source.primaryTopics,
    ...source.usefulFor,
    ...scienceDomains,
    browseCategory,
    resourceType,
  ]);
  const reviewStatus = override.reviewStatus ?? defaultReviewStatus(source);
  const hostsContent = override.hostsContent ?? defaultHostsContent(source);
  const apiAccess = legacy?.status === "retired" ? "unknown/unverified" : override.apiAccess ?? defaultApiAccess(source);
  const cloudAccess = override.cloudAccess ?? defaultCloudAccess(source);
  const downloadAccess = legacy?.status === "retired" ? "unknown" : override.downloadAccess ?? defaultDownloadAccess(source);
  const method = "2026-08-07 catalog audit: low-concurrency HTTP, browser verification for ambiguous responses, and official-source semantic review";

  return {
    ...source,
    ...Object.fromEntries(Object.entries(override).filter(([key]) => [
      "name", "organization", "sourceType", "bestFor", "whyItBelongs", "limitationsCautions", "licenseReuseNotes", "privacyEthicsWarnings", "citationAttributionNotes",
    ].includes(key))),
    officialUrl: primaryUrl,
    active: !legacy,
    aliases,
    searchKeywords,
    operator,
    operatorType,
    organization: operator,
    resourceType,
    browseCategory,
    category: browseCategory,
    sourceType: override.sourceType ?? resourceType,
    scienceDomains,
    geography: override.geography ?? (source.primaryTopics.some((topic) => /United States|U\.S\./i.test(topic)) ? ["United States"] : ["Global or record-dependent"]),
    languages: override.languages ?? ["English interface; record languages may vary"],
    links: sourceLinks(source, override, primaryUrl, legacy),
    access: {
      public: publicAccess,
      api: apiAccess,
      cloud: cloudAccess,
      download: downloadAccess,
      note: override.accessNote ?? "Public browsing, account access, API credentials, bulk download, and record-level permissions are separate; verify the intended workflow on the official resource.",
    },
    content: {
      reviewStatus,
      hostsContent,
      note: override.contentNote ?? "Content quality, provenance, review status, version, and hosting role can vary by record; this catalog listing is not an endorsement of every item.",
    },
    license: {
      summary: override.licenseReuseNotes ?? source.licenseReuseNotes,
      termsUrl: override.termsUrl,
      recordLevelVariation: override.recordLevelVariation ?? true,
      attributionRequired: override.attributionRequired ?? "varies",
      trainingCaution: override.trainingCaution ?? "Availability or bulk access does not by itself grant permission to redistribute, mine, or train models. Check the current record-level license and terms.",
    },
    lifecycle: {
      status: legacy?.status ?? "active",
      version: override.version,
      parentId: override.parentId,
      successorId: legacy?.successorId,
      legacyReason: legacy?.reason,
    },
    verification: {
      urlLastVerified: "2026-08-07",
      annotationLastVerified: "2026-08-07",
      licenseAccessLastVerified: "2026-08-07",
      method,
      status: override.verificationStatus ?? (legacy ? (legacy.status === "retired" && !legacy.historicalUrl ? "unavailable" : "legacy") : institutionalIds.has(source.id) || ["gbif", "iucn-red-list", "data-gov-in"].includes(source.id) ? "manual/gated" : "verified"),
      finalCanonicalUrl: primaryUrl,
      limitation: override.verificationLimitation ?? (institutionalIds.has(source.id) ? "Full authenticated functionality and entitlement scope were not independently verified without an account or subscription." : undefined),
    },
    citationType: override.citationType ?? defaultCitationType(resourceType),
  };
}

export const allLivingLibrarySources = auditedLivingLibraryRecords.map(createCatalogSource);
export const activeLivingLibrarySources = allLivingLibrarySources.filter((source) => source.active);
export const legacyLivingLibrarySources = allLivingLibrarySources.filter((source) => !source.active);

export const livingLibrarySourceAliases: Record<string, string> = {};
export const livingLibrarySourceSuccessors = Object.fromEntries(
  Object.entries(legacyDispositions).flatMap(([id, disposition]) => disposition.successorId ? [[id, disposition.successorId]] : []),
);

const sourceById = new Map(allLivingLibrarySources.map((source) => [source.id, source]));

export function resolveLivingLibrarySource(sourceId: string | null | undefined) {
  if (!sourceId) return undefined;
  const resolvedId = livingLibrarySourceAliases[sourceId] ?? sourceId;
  return sourceById.get(resolvedId);
}

export function livingLibraryCategorySlug(category: LivingLibraryBrowseCategory) {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function formatLivingLibraryAccessDate(value: Date = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function formatLivingLibraryCitation(source: LivingLibrarySource, accessDate: Date = new Date()) {
  const recordType = source.active ? source.citationType : `${source.citationType}; ${source.lifecycle.status} catalog record`;
  return `${source.operator}. ${source.name} [${recordType}]. ${source.officialUrl}. Accessed ${formatLivingLibraryAccessDate(accessDate)}.`;
}
