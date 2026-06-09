export type LivingLibraryAccessFlag = "Yes" | "No" | "Sometimes" | "Optional" | "Varies";

export type LivingLibrarySource = {
  id: string;
  name: string;
  officialUrl: string;
  organization: string;
  category: string;
  sourceType: string;
  bestFor: string;
  primaryTopics: string[];
  usefulFor: string[];
  signupRequired: string;
  cloudRequired: string;
  apiAvailable: string;
  bulkDownloadAvailable: string;
  licenseReuseNotes: string;
  privacyEthicsWarnings: string;
  citationAttributionNotes: string;
  whyItBelongs: string;
  limitationsCautions: string;
  riskLabels: string[];
  lastChecked: string;
};

export type LivingLibraryStarterPack = {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  sourceNames: string[];
  riskNotes: string;
  tags: string[];
};

export type LivingLibraryEthicsPrinciple = {
  title: string;
  body: string;
};

export type LivingLibraryAccountFunction = {
  name: string;
  status: string;
  copy: string;
};

export const livingLibraryPageCopy = {
  "heroEyebrow": "RESEARCH COMMONS",
  "heroTitle": "The Living Library",
  "heroBody": "A curated public research commons for official data portals, open science resources, model/data sources, code archives, stewardship organizations, and local-first AI foundations.",
  "doctrineCallout": "The Living Library stores metadata, annotations, access notes, risk labels, citations, and official links. It does not mirror giant datasets, certify that all data is training-safe, or connect public website resources to private Elysia memory.",
  "privateBoundary": "The Living Library belongs to Elysia Ecobotics Online, not the private local Elysia core. It cannot read private Elysia memory, local vaults, local files, private logs, or private project context.",
  "lastCheckedNote": "Last checked means the source link and basic listing were reviewed for this catalog pass. It does not mean every dataset, license, API endpoint, or downstream use has been legally audited.",
  "trainingSafetyWarning": "A listed source may be useful. It is not automatically safe for model training. Check license, provenance, privacy risks, access terms, attribution duties, and ethical context before use."
} as const;

export const livingLibraryEthicsPrinciples: LivingLibraryEthicsPrinciple[] = [
  {
    "title": "Public availability is not consent",
    "body": "A dataset being public, downloadable, or indexed does not automatically mean the people, communities, authors, or maintainers consented to every downstream use, especially model training."
  },
  {
    "title": "Open access is not the same as training-safe",
    "body": "Open reading access, open metadata, and open datasets can have different legal and ethical conditions. Check license, provenance, intended use, and exclusions."
  },
  {
    "title": "License compatibility matters",
    "body": "Attribution, share-alike, noncommercial, no-derivatives, database rights, code licenses, and dataset licenses can conflict with redistribution or AI training."
  },
  {
    "title": "Human and community data need extra care",
    "body": "Aggregated health, housing, demographic, refugee, neuroscience, justice, and community data can still encode vulnerability, stigma, or targeting risk."
  },
  {
    "title": "Code is not license-neutral",
    "body": "Public code can carry permissive, copyleft, proprietary, unknown, or conflicting licenses. Public repositories can also contain personal data, secrets, or author metadata."
  },
  {
    "title": "Citizen-science and screening tools are not final proof",
    "body": "Sources like iNaturalist, eBird, GBIF, OSM, and EJSCREEN are valuable, but they can have sampling bias, missingness, uncertainty, and interpretation limits."
  },
  {
    "title": "Cloud tools change the privacy boundary",
    "body": "Accounts, API tokens, cloud processing, billing metadata, and hosted notebooks can move user metadata outside local control. Use them deliberately, not silently."
  },
  {
    "title": "Use the training ladder",
    "body": "RAG/reference use is usually the safest first step. Fine-tuning, continued pretraining, and training from scratch require much stronger license, privacy, quality, and contamination checks."
  }
];

export const livingLibraryAccountFunctions: LivingLibraryAccountFunction[] = [
  {
    "name": "Save sources",
    "status": "Local-first now; account sync later",
    "copy": "Save useful source cards locally in this browser. Account-backed sync can come later after Supabase tables and RLS are intentionally designed."
  },
  {
    "name": "Create personal collections",
    "status": "Local-first now; account sync later",
    "copy": "Group saved sources into named collections for a project, class, research packet, or starter kit."
  },
  {
    "name": "Bookmark starter packs",
    "status": "Local-first now",
    "copy": "Bookmark curated starter packs such as Environmental Stewardship, Public-Interest Research, Local AI Builder, Open Science, or Conservation."
  },
  {
    "name": "Submit source suggestions",
    "status": "Draft/local or backend later",
    "copy": "Prepare a source suggestion with name, official URL, category, reason, and caution notes. Do not imply a live review queue unless Supabase support exists."
  },
  {
    "name": "Flag broken links",
    "status": "Draft/local or backend later",
    "copy": "Let users prepare a broken-link report. A real moderation queue requires a backend table and abuse controls."
  },
  {
    "name": "Save citations",
    "status": "Local-first now",
    "copy": "Save or copy a plain citation using source name, official URL, and access date. APA/BibTeX can come later."
  },
  {
    "name": "Export collection",
    "status": "Can work now client-side",
    "copy": "Export saved sources as Markdown or JSON with source name, URL, category, tags, cautions, and citation text."
  }
];

export const livingLibraryStarterPacks: LivingLibraryStarterPack[] = [
  {
    "id": "environmental-stewardship",
    "name": "Environmental Stewardship Starter Pack",
    "description": "A practical first shelf for climate, remote sensing, biodiversity, fire, water, and ecosystem mapping.",
    "bestFor": "Climate, remote sensing, biodiversity, fire, water, ecosystem mapping.",
    "sourceNames": [
      "NASA Earthdata",
      "NOAA Climate Data Online",
      "USGS EarthExplorer",
      "GBIF",
      "EPA EnviroAtlas",
      "USGS/EPA Water Quality Portal",
      "IUCN Red List",
      "NASA FIRMS"
    ],
    "riskNotes": "Some sources require accounts, APIs, large downloads, or careful interpretation. Biodiversity, fire, and screening data may have sampling bias or uncertainty.",
    "tags": [
      "environmental data",
      "mapping",
      "time-series modeling",
      "conservation",
      "science/reference"
    ]
  },
  {
    "id": "public-interest-research",
    "name": "Public-Interest Research Starter Pack",
    "description": "A civic research shelf for community analysis, policy, housing, economy, and public health.",
    "bestFor": "Community analysis, policy, housing, economy, public health.",
    "sourceNames": [
      "U.S. Census APIs",
      "FRED",
      "BLS Public Data API",
      "World Bank Data",
      "WHO Global Health Observatory",
      "UNICEF Data",
      "UNdata",
      "HUD User / HUD data"
    ],
    "riskNotes": "Human/community indicators can be sensitive. Use margins of error, geography, and aggregation limits carefully.",
    "tags": [
      "public policy",
      "RAG",
      "time-series modeling",
      "science/reference",
      "sensitive human data"
    ]
  },
  {
    "id": "local-ai-builder",
    "name": "Local AI Builder Starter Pack",
    "description": "A local-first AI shelf for RAG, prototyping, basic ML, dataset discovery, and search infrastructure.",
    "bestFor": "RAG, local prototyping, basic ML, dataset discovery.",
    "sourceNames": [
      "Hugging Face Datasets",
      "UCI Machine Learning Repository",
      "OpenML",
      "Ollama",
      "Open WebUI",
      "PostgreSQL Full Text Search",
      "pgvector",
      "Supabase Vector Columns"
    ],
    "riskNotes": "Model/data licenses vary. Cloud tools such as Hugging Face and Supabase can be useful, but private Elysia memory should not be sent there by default.",
    "tags": [
      "local AI",
      "RAG",
      "fine-tuning",
      "benchmarking",
      "data ethics"
    ]
  },
  {
    "id": "open-science",
    "name": "Open Science Starter Pack",
    "description": "A scholarly evidence shelf for literature maps, citations, papers, code, datasets, and evidence packets.",
    "bestFor": "Literature maps, citations, papers, code, datasets, evidence packets.",
    "sourceNames": [
      "Crossref",
      "OpenAlex",
      "CORE",
      "arXiv",
      "DOAJ",
      "Semantic Scholar API",
      "Papers with Code",
      "Zenodo",
      "Dryad",
      "OSF"
    ],
    "riskNotes": "Open access and public metadata are not the same as unrestricted full-text training rights. Check article and dataset licenses.",
    "tags": [
      "open science",
      "RAG",
      "science/reference",
      "code research",
      "licensing/training caution"
    ]
  },
  {
    "id": "conservation",
    "name": "Conservation Starter Pack",
    "description": "A conservation planning shelf for biodiversity, ecological mapping, environmental justice, and watershed context.",
    "bestFor": "Biodiversity, conservation planning, mapping, environmental justice.",
    "sourceNames": [
      "GBIF",
      "IUCN Red List",
      "EPA EnviroAtlas",
      "USGS/EPA Water Quality Portal",
      "EPA TRI / Toxics Release Inventory",
      "NASA Earthdata",
      "Copernicus Data Space Ecosystem",
      "OpenStreetMap"
    ],
    "riskNotes": "Species occurrence data, citizen-science data, and environmental screening tools are useful but not conclusive. Sensitive species and community context require caution.",
    "tags": [
      "conservation",
      "mapping",
      "environmental justice",
      "science/reference",
      "useful but not conclusive"
    ]
  }
];

export const livingLibrarySources: LivingLibrarySource[] = [
  {
    "id": "data-gov",
    "name": "Data.gov",
    "officialUrl": "https://data.gov/",
    "organization": "Data.gov",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "U.S. federal open-data discovery and metadata search.",
    "primaryTopics": [
      "open data",
      "government",
      "United States",
      "public policy",
      "civic data"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Metadata and datasets vary by agency. Many U.S. federal works are public domain, but agency and dataset terms must still be checked.",
    "privacyEthicsWarnings": "Mostly public-sector metadata, but linked datasets may include sensitive or restricted fields.",
    "citationAttributionNotes": "Cite Data.gov, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core U.S. civic/public-interest discovery portal for federal datasets.",
    "limitationsCautions": "Metadata-first portal. Always follow through to the original agency source and dataset terms.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usaspending-gov",
    "name": "USAspending.gov",
    "officialUrl": "https://www.usaspending.gov/",
    "organization": "USAspending.gov",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "U.S. federal contracts, grants, loans, spending, and award data.",
    "primaryTopics": [
      "government spending",
      "contracts",
      "grants",
      "public finance",
      "accountability"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "time-series modeling"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official U.S. federal public spending data. Reuse should cite USAspending and original award context.",
    "privacyEthicsWarnings": "Award data can involve organizations, locations, and program recipients. Avoid stigmatizing inference.",
    "citationAttributionNotes": "Cite USAspending.gov, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong public finance and accountability source for civic research.",
    "limitationsCautions": "Spending data can be complex; obligation, outlay, award, and subaward concepts should not be conflated.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "u-s-census-apis",
    "name": "U.S. Census APIs",
    "officialUrl": "https://www.census.gov/data/developers.html",
    "organization": "U.S. Census APIs",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "Demographics, ACS, housing, economy, TIGER geography, and U.S. community data APIs.",
    "primaryTopics": [
      "demographics",
      "ACS",
      "housing",
      "economy",
      "geography",
      "United States"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official Census data are broadly reusable, but tables, geographies, margins of error, and API-specific rules must be cited correctly.",
    "privacyEthicsWarnings": "Aggregated data can still encode community vulnerability. Microdata and small-area data require careful interpretation.",
    "citationAttributionNotes": "Cite U.S. Census APIs, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Foundational source for U.S. community, demographic, housing, and socioeconomic analysis.",
    "limitationsCautions": "ACS estimates have margins of error; do not overinterpret small differences or small populations.",
    "riskLabels": [
      "Sensitive human data",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "hud-user--hud-data",
    "name": "HUD User / HUD data",
    "officialUrl": "https://www.huduser.gov/portal/datasets/hud-datasets.html",
    "organization": "HUD User",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "Housing, fair market rents, income limits, CHAS, crosswalks, and community development data.",
    "primaryTopics": [
      "housing",
      "rents",
      "income limits",
      "community development",
      "policy"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official HUD datasets have dataset-specific documentation and reuse notes; cite dataset name, year, and HUD source.",
    "privacyEthicsWarnings": "Housing data can affect vulnerable communities; avoid profiling or stigmatizing neighborhoods.",
    "citationAttributionNotes": "Cite HUD User / HUD data, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Essential housing and community data source for public-interest research.",
    "limitationsCautions": "Many HUD datasets are technical and require careful geography/year alignment.",
    "riskLabels": [
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "fred",
    "name": "FRED",
    "officialUrl": "https://fred.stlouisfed.org/",
    "organization": "FRED",
    "category": "Trusted Data Portals",
    "sourceType": "Economic data portal",
    "bestFor": "U.S. and global economic time series.",
    "primaryTopics": [
      "economics",
      "macroeconomics",
      "labor",
      "inflation",
      "finance",
      "time series"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Series originate from multiple providers. Check each series source and FRED citation guidance.",
    "privacyEthicsWarnings": "Macroeconomic data are usually aggregate, but interpretation can influence policy claims.",
    "citationAttributionNotes": "Cite FRED, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Central source for economic time-series discovery and charting.",
    "limitationsCautions": "Series definitions, revisions, seasonal adjustment, and source agencies matter.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "fred-api",
    "name": "FRED API",
    "officialUrl": "https://fred.stlouisfed.org/docs/api/fred/",
    "organization": "FRED API",
    "category": "Trusted Data Portals",
    "sourceType": "API documentation",
    "bestFor": "Programmatic access to FRED economic time series.",
    "primaryTopics": [
      "economics",
      "API",
      "time series",
      "macroeconomics"
    ],
    "usefulFor": [
      "time-series modeling",
      "RAG",
      "public policy"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "API use requires following FRED API terms and citing underlying data series sources.",
    "privacyEthicsWarnings": "API key/account metadata may leave local control when used.",
    "citationAttributionNotes": "Cite FRED API, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Necessary documentation for reproducible economic-data ingestion.",
    "limitationsCautions": "Requires an API key. Respect rate limits and series-specific source terms.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "bls-public-data-api",
    "name": "BLS Public Data API",
    "officialUrl": "https://www.bls.gov/developers/",
    "organization": "BLS Public Data API",
    "category": "Trusted Data Portals",
    "sourceType": "Government API documentation",
    "bestFor": "Labor, wages, prices, inflation, employment, and U.S. economic indicators.",
    "primaryTopics": [
      "labor",
      "wages",
      "inflation",
      "employment",
      "prices",
      "API"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official BLS public data. Cite BLS program, series, and access date.",
    "privacyEthicsWarnings": "Mostly aggregate labor/economic data, but interpretation should avoid simplistic local claims.",
    "citationAttributionNotes": "Cite BLS Public Data API, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core U.S. labor and inflation data source.",
    "limitationsCautions": "BLS series codes, survey programs, seasonal adjustment, and revisions need care.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "data-gov-uk",
    "name": "Data.gov.uk",
    "officialUrl": "https://www.data.gov.uk/",
    "organization": "Data.gov.uk",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "UK government datasets and public-sector discovery.",
    "primaryTopics": [
      "United Kingdom",
      "open data",
      "government",
      "public policy"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "mapping"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Many resources use the Open Government Licence, but dataset-specific terms and attribution still apply.",
    "privacyEthicsWarnings": "Public-sector datasets vary in sensitivity and aggregation.",
    "citationAttributionNotes": "Cite Data.gov.uk, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Main UK government open-data discovery portal.",
    "limitationsCautions": "Always verify the linked publisher, license, and update date.",
    "riskLabels": [
      "Attribution required",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "data-gov-au",
    "name": "Data.gov.au",
    "officialUrl": "https://data.gov.au/",
    "organization": "Data.gov.au",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "Australian government open data across environment, economy, infrastructure, and policy.",
    "primaryTopics": [
      "Australia",
      "open data",
      "government",
      "environment",
      "policy"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Reuse terms are source- or dataset-specific. Check the official license, terms of use, and dataset documentation before reuse or model training.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite Data.gov.au, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Key Australian open-data portal for public-interest research.",
    "limitationsCautions": "License, format, and update cadence vary by dataset.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "data-gov-in",
    "name": "Data.gov.in",
    "officialUrl": "https://www.data.gov.in/",
    "organization": "Data.gov.in",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "Indian government open data and public-sector datasets.",
    "primaryTopics": [
      "India",
      "open data",
      "government",
      "public policy"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "mapping"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Government Open Data License–India or dataset-specific terms may apply; verify before reuse.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite Data.gov.in, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Main Indian government open-data portal.",
    "limitationsCautions": "Registration/API usage and license details should be checked source-by-source.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "data-gov-sg",
    "name": "Data.gov.sg",
    "officialUrl": "https://data.gov.sg/",
    "organization": "Data.gov.sg",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "Singapore public datasets and APIs.",
    "primaryTopics": [
      "Singapore",
      "open data",
      "API",
      "government",
      "public policy"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "mapping",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Check Singapore open-data license and dataset-specific API/use terms.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite Data.gov.sg, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong public-data portal with API-oriented access.",
    "limitationsCautions": "Account/API details and license terms should be checked per dataset.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "data-gov-my",
    "name": "Data.gov.my",
    "officialUrl": "https://data.gov.my/",
    "organization": "Data.gov.my",
    "category": "Trusted Data Portals",
    "sourceType": "Government data portal",
    "bestFor": "Malaysian public-sector data and dashboards.",
    "primaryTopics": [
      "Malaysia",
      "open data",
      "government",
      "public policy"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "mapping"
    ],
    "signupRequired": "Varies",
    "cloudRequired": "Varies",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "License clarity should be checked carefully before reuse, especially for redistribution or training.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite Data.gov.my, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful Malaysian public-sector data source, but it should enter the Living Library with extra review.",
    "limitationsCautions": "Publish only with clear access and license notes after Bradley review.",
    "riskLabels": [
      "Extra review recommended",
      "Dataset-specific license",
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "data-europa-eu--european-data-portal",
    "name": "data.europa.eu / European Data Portal",
    "officialUrl": "https://data.europa.eu/",
    "organization": "data.europa.eu",
    "category": "Trusted Data Portals",
    "sourceType": "International data portal",
    "bestFor": "EU and European national/regional dataset discovery.",
    "primaryTopics": [
      "Europe",
      "EU",
      "open data",
      "government",
      "public policy"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Licenses vary across EU institutions and national/regional publishers.",
    "privacyEthicsWarnings": "Public datasets may include regional socioeconomic or administrative data requiring careful interpretation.",
    "citationAttributionNotes": "Cite data.europa.eu / European Data Portal, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Excellent EU-wide discovery layer for public datasets.",
    "limitationsCautions": "Follow through to the original publisher and dataset license.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "eurostat",
    "name": "Eurostat",
    "officialUrl": "https://ec.europa.eu/eurostat/",
    "organization": "Eurostat",
    "category": "Trusted Data Portals",
    "sourceType": "International statistics portal",
    "bestFor": "EU statistics for economy, demographics, environment, agriculture, labor, and regions.",
    "primaryTopics": [
      "Europe",
      "statistics",
      "economy",
      "demographics",
      "environment",
      "agriculture"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Eurostat reuse generally requires source acknowledgement; verify current terms.",
    "privacyEthicsWarnings": "Mostly aggregate statistics, but regional/social indicators can be misused if overinterpreted.",
    "citationAttributionNotes": "Cite Eurostat, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core EU statistical reference source.",
    "limitationsCautions": "Methods, geographies, time periods, and revisions matter.",
    "riskLabels": [
      "Attribution required",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "undata",
    "name": "UNdata",
    "officialUrl": "http://data.un.org/",
    "organization": "UNdata",
    "category": "Trusted Data Portals",
    "sourceType": "International statistics portal",
    "bestFor": "UN statistical databases and cross-country baseline indicators.",
    "primaryTopics": [
      "United Nations",
      "global statistics",
      "development",
      "demographics",
      "economy"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Check UN database-specific citation and reuse conditions.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite UNdata, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong global statistical reference source.",
    "limitationsCautions": "Use carefully across countries because definitions and reporting quality vary.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "world-bank-data",
    "name": "World Bank Data",
    "officialUrl": "https://data.worldbank.org/",
    "organization": "World Bank Data",
    "category": "Trusted Data Portals",
    "sourceType": "International data portal",
    "bestFor": "Global development indicators for poverty, education, infrastructure, health, economy, and environment.",
    "primaryTopics": [
      "development",
      "poverty",
      "health",
      "education",
      "economy",
      "infrastructure",
      "global"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "World Bank data are generally open, but datasets and third-party data may have specific terms.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite World Bank Data, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Foundational global development and public-interest data source.",
    "limitationsCautions": "Country-level indicators can hide local inequality and measurement differences.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "imf-data-portal",
    "name": "IMF Data Portal",
    "officialUrl": "https://data.imf.org/",
    "organization": "IMF Data Portal",
    "category": "Trusted Data Portals",
    "sourceType": "International data portal",
    "bestFor": "Macroeconomic, fiscal, and financial data.",
    "primaryTopics": [
      "macroeconomics",
      "finance",
      "fiscal data",
      "international",
      "SDMX"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Follow IMF data terms and cite dataset/series context.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite IMF Data Portal, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important source for international macroeconomic comparison.",
    "limitationsCautions": "Definitions and country reporting practices require careful interpretation.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "oecd-data-explorer",
    "name": "OECD Data Explorer",
    "officialUrl": "https://data-explorer.oecd.org/",
    "organization": "OECD Data Explorer",
    "category": "Trusted Data Portals",
    "sourceType": "International statistics portal",
    "bestFor": "International policy and statistical comparison across economy, education, labor, health, and environment.",
    "primaryTopics": [
      "OECD",
      "policy",
      "economy",
      "education",
      "labor",
      "health",
      "environment"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Check OECD terms, dataset notes, and citation guidance.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite OECD Data Explorer, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong comparative source for policy and social/economic indicators.",
    "limitationsCautions": "OECD-focused scope may not represent all global contexts equally.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "faostat",
    "name": "FAOSTAT",
    "officialUrl": "https://www.fao.org/faostat/",
    "organization": "FAOSTAT",
    "category": "Trusted Data Portals",
    "sourceType": "International data portal",
    "bestFor": "Agriculture, food, forestry, land, emissions, and food security data.",
    "primaryTopics": [
      "agriculture",
      "food systems",
      "forestry",
      "land",
      "food security",
      "global"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "FAO reuse and citation terms apply; check dataset-level metadata.",
    "privacyEthicsWarnings": "Use responsibly. Check whether the source includes personal, sensitive, community, or location data before analysis or model use.",
    "citationAttributionNotes": "Cite FAOSTAT, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong global eco-agricultural and food systems data source.",
    "limitationsCautions": "National reporting quality and definitions vary.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "hdx--humanitarian-data-exchange",
    "name": "HDX / Humanitarian Data Exchange",
    "officialUrl": "https://data.humdata.org/",
    "organization": "HDX",
    "category": "Trusted Data Portals",
    "sourceType": "Humanitarian data portal",
    "bestFor": "Humanitarian crisis datasets, operational data, and crisis-response information.",
    "primaryTopics": [
      "humanitarian",
      "crisis",
      "refugees",
      "disasters",
      "public health",
      "conflict"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "public policy",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset licenses vary widely. Check each dataset, organization, and usage constraint before reuse.",
    "privacyEthicsWarnings": "High caution: crisis data can expose vulnerable people or communities even when aggregated.",
    "citationAttributionNotes": "Cite HDX / Humanitarian Data Exchange, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important humanitarian data portal when used carefully and ethically.",
    "limitationsCautions": "Do not use for profiling, targeting, stigmatizing, or unsafe publication. Treat as sensitive until proven otherwise.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "who-global-health-observatory",
    "name": "WHO Global Health Observatory",
    "officialUrl": "https://www.who.int/data/gho",
    "organization": "WHO Global Health Observatory",
    "category": "Trusted Data Portals",
    "sourceType": "International health data portal",
    "bestFor": "Global health indicators and public-health reference data.",
    "primaryTopics": [
      "health",
      "global health",
      "indicators",
      "public health"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Follow WHO citation and reuse terms; check specific data product notes.",
    "privacyEthicsWarnings": "Mostly aggregate health indicators, but health data should be interpreted carefully.",
    "citationAttributionNotes": "Cite WHO Global Health Observatory, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong global health reference source.",
    "limitationsCautions": "Country comparisons depend on reporting practices and definitions.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "who-health-inequality-data-repository",
    "name": "WHO Health Inequality Data Repository",
    "officialUrl": "https://www.who.int/data/inequality-monitor",
    "organization": "WHO Health Inequality Data Repository",
    "category": "Trusted Data Portals",
    "sourceType": "International health data portal",
    "bestFor": "Disaggregated health inequality data and health equity indicators.",
    "primaryTopics": [
      "health inequality",
      "equity",
      "public health",
      "demographics",
      "global"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Follow WHO reuse/citation terms and dataset-specific guidance.",
    "privacyEthicsWarnings": "High caution: disaggregated human data can contribute to profiling or stigmatizing communities.",
    "citationAttributionNotes": "Cite WHO Health Inequality Data Repository, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important source for health equity and public-interest analysis.",
    "limitationsCautions": "Use with care and context; do not treat disparities as community defects.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "unicef-data",
    "name": "UNICEF Data",
    "officialUrl": "https://data.unicef.org/",
    "organization": "UNICEF Data",
    "category": "Trusted Data Portals",
    "sourceType": "International data portal",
    "bestFor": "Children’s health, education, welfare, development, and protection indicators.",
    "primaryTopics": [
      "children",
      "health",
      "education",
      "welfare",
      "development"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "time-series modeling"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Follow UNICEF data citation and reuse guidance.",
    "privacyEthicsWarnings": "Child-related indicators require strong ethical care, even when aggregate.",
    "citationAttributionNotes": "Cite UNICEF Data, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong child-development and public-interest data source.",
    "limitationsCautions": "Avoid sensational or stigmatizing use of child welfare indicators.",
    "riskLabels": [
      "Sensitive human data",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "cdc-wonder",
    "name": "CDC WONDER",
    "officialUrl": "https://wonder.cdc.gov/",
    "organization": "CDC WONDER",
    "category": "Trusted Data Portals",
    "sourceType": "Public health query system",
    "bestFor": "U.S. mortality and public-health query systems.",
    "primaryTopics": [
      "mortality",
      "public health",
      "United States",
      "epidemiology"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "time-series modeling",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Official CDC query outputs require correct citation of dataset, query parameters, and access date.",
    "privacyEthicsWarnings": "High caution: mortality and health data can enable harmful or stigmatizing inferences.",
    "citationAttributionNotes": "Cite CDC WONDER, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "High-value U.S. public-health reference and query source.",
    "limitationsCautions": "Suppressions, query parameters, geography, demographics, and cause coding matter.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "unhcr-refugee-data-finder",
    "name": "UNHCR Refugee Data Finder",
    "officialUrl": "https://www.unhcr.org/refugee-statistics/",
    "organization": "UNHCR Refugee Data Finder",
    "category": "Trusted Data Portals",
    "sourceType": "Humanitarian data portal",
    "bestFor": "Refugee, IDP, asylum, statelessness, and displacement data.",
    "primaryTopics": [
      "refugees",
      "displacement",
      "humanitarian",
      "migration",
      "conflict"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "public policy",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Follow UNHCR data and citation terms; check dataset and methodology notes.",
    "privacyEthicsWarnings": "High caution: displacement data involves vulnerable communities and contested political contexts.",
    "citationAttributionNotes": "Cite UNHCR Refugee Data Finder, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core displacement and refugee data source.",
    "limitationsCautions": "Do not use to profile or target displaced populations. Interpret with context.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "hugging-face-datasets",
    "name": "Hugging Face Datasets",
    "officialUrl": "https://huggingface.co/datasets",
    "organization": "Hugging Face Datasets",
    "category": "Model Training Commons",
    "sourceType": "ML dataset portal",
    "bestFor": "AI-ready datasets, dataset cards, NLP, vision, audio, and tabular datasets.",
    "primaryTopics": [
      "AI datasets",
      "NLP",
      "computer vision",
      "audio",
      "tabular",
      "model training"
    ],
    "usefulFor": [
      "RAG",
      "fine-tuning",
      "benchmarking",
      "computer vision",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Licenses and access conditions vary by dataset. Gated datasets may require accepting terms.",
    "privacyEthicsWarnings": "Some datasets may include personal data, copyrighted material, or sensitive content. Read dataset cards.",
    "citationAttributionNotes": "Cite Hugging Face Datasets, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Essential discovery hub for AI-ready datasets and dataset documentation.",
    "limitationsCautions": "Do not assume a dataset is training-safe because it is hosted on Hugging Face.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "kaggle-datasets",
    "name": "Kaggle Datasets",
    "officialUrl": "https://www.kaggle.com/datasets",
    "organization": "Kaggle Datasets",
    "category": "Model Training Commons",
    "sourceType": "ML dataset portal",
    "bestFor": "Beginner-friendly ML datasets, competitions, notebooks, and public dataset discovery.",
    "primaryTopics": [
      "machine learning",
      "datasets",
      "competitions",
      "tabular",
      "education"
    ],
    "usefulFor": [
      "RAG",
      "fine-tuning",
      "benchmarking",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Licenses vary by dataset and uploader. Check each dataset page.",
    "privacyEthicsWarnings": "User-uploaded datasets may include unclear provenance or sensitive data.",
    "citationAttributionNotes": "Cite Kaggle Datasets, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Accessible entry point for ML dataset exploration and education.",
    "limitationsCautions": "Account/API token required for many workflows; quality and licensing vary widely.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "openml",
    "name": "OpenML",
    "officialUrl": "https://www.openml.org/",
    "organization": "OpenML",
    "category": "Model Training Commons",
    "sourceType": "ML benchmark portal",
    "bestFor": "Machine-learning benchmark datasets, tasks, experiments, and reproducibility.",
    "primaryTopics": [
      "machine learning",
      "benchmarks",
      "tasks",
      "experiments",
      "reproducibility"
    ],
    "usefulFor": [
      "benchmarking",
      "fine-tuning",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset licenses vary. Check OpenML dataset metadata and original source.",
    "privacyEthicsWarnings": "Some datasets may contain human-related records; assess sensitivity before use.",
    "citationAttributionNotes": "Cite OpenML, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong reproducibility and benchmark source for ML work.",
    "limitationsCautions": "Metadata quality and license clarity can vary by uploaded dataset.",
    "riskLabels": [
      "Dataset-specific license",
      "Licensing/training caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "uci-machine-learning-repository",
    "name": "UCI Machine Learning Repository",
    "officialUrl": "https://archive.ics.uci.edu/",
    "organization": "UCI Machine Learning Repository",
    "category": "Model Training Commons",
    "sourceType": "ML dataset repository",
    "bestFor": "Classic small machine-learning datasets for teaching and benchmarking.",
    "primaryTopics": [
      "machine learning",
      "teaching",
      "benchmarks",
      "tabular"
    ],
    "usefulFor": [
      "benchmarking",
      "fine-tuning",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Check each dataset’s license, citation, and original source.",
    "privacyEthicsWarnings": "Some classic datasets contain human or medical attributes. Treat as sensitive where applicable.",
    "citationAttributionNotes": "Cite UCI Machine Learning Repository, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Foundational beginner and teaching shelf for ML.",
    "limitationsCautions": "Older datasets can be overused, contaminated, biased, or insufficiently documented.",
    "riskLabels": [
      "Dataset-specific license",
      "Licensing/training caution",
      "Sensitive human data"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "zenodo",
    "name": "Zenodo",
    "officialUrl": "https://zenodo.org/",
    "organization": "Zenodo",
    "category": "Model Training Commons",
    "sourceType": "Research repository",
    "bestFor": "DOI-linked datasets, software, papers, and research outputs.",
    "primaryTopics": [
      "open science",
      "research outputs",
      "DOI",
      "datasets",
      "software"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking",
      "fine-tuning"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Records specify their own licenses. Check each deposit before reuse.",
    "privacyEthicsWarnings": "Deposits can vary widely; some may have restricted or sensitive data.",
    "citationAttributionNotes": "Cite Zenodo, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong provenance/citation source for open science and reusable research outputs.",
    "limitationsCautions": "Repository presence does not guarantee quality or training-safety.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "dryad",
    "name": "Dryad",
    "officialUrl": "https://datadryad.org/",
    "organization": "Dryad",
    "category": "Model Training Commons",
    "sourceType": "Research repository",
    "bestFor": "Reusable open research datasets with strong data-sharing norms.",
    "primaryTopics": [
      "open science",
      "research datasets",
      "DOI",
      "biology",
      "ecology"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking",
      "conservation"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dryad datasets are often CC0, but verify record-level terms and citation guidance.",
    "privacyEthicsWarnings": "Research datasets vary. Check for human subjects, sensitive species, and location risks.",
    "citationAttributionNotes": "Cite Dryad, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good model for lawful reusable research data norms.",
    "limitationsCautions": "CC0 does not remove ethical duties around sensitive data.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "harvard-dataverse",
    "name": "Harvard Dataverse",
    "officialUrl": "https://dataverse.harvard.edu/",
    "organization": "Harvard Dataverse",
    "category": "Model Training Commons",
    "sourceType": "Research repository",
    "bestFor": "Research datasets, replication files, open and restricted data.",
    "primaryTopics": [
      "research data",
      "social science",
      "replication",
      "DOI",
      "open science"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking",
      "public policy"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Access and reuse terms vary by dataset and Dataverse collection.",
    "privacyEthicsWarnings": "May contain restricted, human-subject, or sensitive social data.",
    "citationAttributionNotes": "Cite Harvard Dataverse, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major scholarly data repository for research and replication.",
    "limitationsCautions": "Restricted files and human data require careful review.",
    "riskLabels": [
      "Sensitive human data",
      "Dataset-specific license",
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "osf",
    "name": "OSF",
    "officialUrl": "https://osf.io/",
    "organization": "OSF",
    "category": "Model Training Commons",
    "sourceType": "Research platform",
    "bestFor": "Research projects, protocols, preregistration, files, and open-science workflows.",
    "primaryTopics": [
      "open science",
      "protocols",
      "preregistration",
      "research projects",
      "files"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Project-level licenses and file terms vary.",
    "privacyEthicsWarnings": "Projects may include drafts, data, or materials with varied sensitivity.",
    "citationAttributionNotes": "Cite OSF, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good source for open-science workflows, protocols, and research context.",
    "limitationsCautions": "Not every OSF project is peer-reviewed or reuse-ready.",
    "riskLabels": [
      "Dataset-specific license",
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "figshare",
    "name": "Figshare",
    "officialUrl": "https://figshare.com/",
    "organization": "Figshare",
    "category": "Model Training Commons",
    "sourceType": "Research repository",
    "bestFor": "Datasets, figures, media, posters, and DOI-linked research outputs.",
    "primaryTopics": [
      "open science",
      "datasets",
      "figures",
      "media",
      "DOI"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "computer vision",
      "benchmarking"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Licenses vary by item. Check record-level license and citation.",
    "privacyEthicsWarnings": "Media and datasets can include human or sensitive content depending on record.",
    "citationAttributionNotes": "Cite Figshare, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful DOI-linked research-output shelf across data, figures, and media.",
    "limitationsCautions": "Repository hosting does not guarantee training permissions.",
    "riskLabels": [
      "Dataset-specific license",
      "Licensing/training caution",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "google-dataset-search",
    "name": "Google Dataset Search",
    "officialUrl": "https://datasetsearch.research.google.com/",
    "organization": "Google Dataset Search",
    "category": "Model Training Commons",
    "sourceType": "Dataset discovery tool",
    "bestFor": "Discovering datasets across the web.",
    "primaryTopics": [
      "dataset discovery",
      "search",
      "metadata"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Discovery only. The dataset’s original source controls license and reuse.",
    "privacyEthicsWarnings": "Search/discovery may route through Google services.",
    "citationAttributionNotes": "Cite Google Dataset Search, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Broad dataset discovery layer across many publishers.",
    "limitationsCautions": "Do not cite Dataset Search as the dataset source; verify the original publisher.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "registry-of-open-data-on-aws",
    "name": "Registry of Open Data on AWS",
    "officialUrl": "https://registry.opendata.aws/",
    "organization": "Registry of Open Data on AWS",
    "category": "Model Training Commons",
    "sourceType": "Cloud-hosted data registry",
    "bestFor": "Large public cloud-hosted datasets on AWS.",
    "primaryTopics": [
      "cloud data",
      "public datasets",
      "large datasets",
      "earth observation",
      "ML"
    ],
    "usefulFor": [
      "RAG",
      "fine-tuning",
      "benchmarking",
      "mapping",
      "computer vision",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset licenses vary. AWS hosting does not imply open training rights.",
    "privacyEthicsWarnings": "Cloud access may expose account, billing, region, or usage metadata.",
    "citationAttributionNotes": "Cite Registry of Open Data on AWS, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful index for large public datasets, especially geospatial and ML-scale resources.",
    "limitationsCautions": "Cloud-oriented. Check costs, license, and egress risks.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Licensing/training caution",
      "Dataset-specific license",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-earthdata",
    "name": "NASA Earthdata",
    "officialUrl": "https://www.earthdata.nasa.gov/",
    "organization": "NASA Earthdata",
    "category": "Environmental Data",
    "sourceType": "Earth observation portal",
    "bestFor": "Earth observation data across atmosphere, land, ocean, hydrology, and cryosphere.",
    "primaryTopics": [
      "climate",
      "remote sensing",
      "earth observation",
      "hydrology",
      "cryosphere"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "computer vision",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset-specific. Verify NASA dataset/product terms and citation requirements.",
    "privacyEthicsWarnings": "Usually public environmental data, but account/cloud workflows may expose user metadata.",
    "citationAttributionNotes": "Cite NASA Earthdata, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Top-tier environmental anchor for climate and Earth systems research.",
    "limitationsCautions": "Workflows can require Earthdata login, large downloads, APIs, or cloud tools.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-open-data-portal",
    "name": "NASA Open Data Portal",
    "officialUrl": "https://data.nasa.gov/",
    "organization": "NASA Open Data Portal",
    "category": "Environmental Data",
    "sourceType": "Government data portal",
    "bestFor": "Broad NASA public datasets and APIs.",
    "primaryTopics": [
      "NASA",
      "open data",
      "space",
      "earth science",
      "public data"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "mapping",
      "time-series modeling"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Dataset-specific NASA or publisher terms apply.",
    "privacyEthicsWarnings": "Mostly public data; check source data context.",
    "citationAttributionNotes": "Cite NASA Open Data Portal, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Broad NASA discovery layer beyond Earthdata-specific workflows.",
    "limitationsCautions": "Some resources redirect to specialized NASA archives.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-nsidc",
    "name": "NASA NSIDC",
    "officialUrl": "https://nsidc.org/",
    "organization": "NASA NSIDC",
    "category": "Environmental Data",
    "sourceType": "Earth observation portal",
    "bestFor": "Snow, ice, polar, cryosphere, and climate data.",
    "primaryTopics": [
      "cryosphere",
      "snow",
      "ice",
      "polar",
      "climate"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset-specific terms and citation requirements apply.",
    "privacyEthicsWarnings": "Environmental data; account/cloud workflows may expose metadata.",
    "citationAttributionNotes": "Cite NASA NSIDC, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong climate/glaciology and cryosphere source.",
    "limitationsCautions": "Earthdata login/workflows may apply for some datasets.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-earthdata-cloud",
    "name": "NASA Earthdata Cloud",
    "officialUrl": "https://www.earthdata.nasa.gov/technology/earthdata-cloud",
    "organization": "NASA Earthdata Cloud",
    "category": "Environmental Data",
    "sourceType": "Cloud data platform documentation",
    "bestFor": "Cloud access patterns and workflows for NASA Earthdata.",
    "primaryTopics": [
      "NASA",
      "cloud",
      "earth observation",
      "data access"
    ],
    "usefulFor": [
      "mapping",
      "time-series modeling",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset-specific NASA Earthdata terms apply.",
    "privacyEthicsWarnings": "Cloud workflows may involve account, usage, or compute metadata.",
    "citationAttributionNotes": "Cite NASA Earthdata Cloud, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important access documentation for cloud-oriented NASA environmental workflows.",
    "limitationsCautions": "Not a standalone dataset source. Treat as access/infrastructure guidance.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "noaa-climate-data-online",
    "name": "NOAA Climate Data Online",
    "officialUrl": "https://www.ncei.noaa.gov/cdo-web/",
    "organization": "NOAA Climate Data Online",
    "category": "Environmental Data",
    "sourceType": "Climate data portal",
    "bestFor": "Historical weather and climate records.",
    "primaryTopics": [
      "weather",
      "climate",
      "NOAA",
      "time series",
      "United States"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "mapping",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NOAA public data are broadly reusable, but cite dataset/source and check product guidance.",
    "privacyEthicsWarnings": "Environmental time-series data with station/location metadata.",
    "citationAttributionNotes": "Cite NOAA Climate Data Online, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core U.S. climate archive.",
    "limitationsCautions": "API token is needed for web services; station coverage and data quality vary.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "noaa-ncei-access-data-service",
    "name": "NOAA NCEI Access Data Service",
    "officialUrl": "https://www.ncei.noaa.gov/access/services/",
    "organization": "NOAA NCEI Access Data Service",
    "category": "Environmental Data",
    "sourceType": "Climate data API/service",
    "bestFor": "Environmental data access, subsetting, and time-series ingestion.",
    "primaryTopics": [
      "NOAA",
      "climate",
      "weather",
      "API",
      "subsetting"
    ],
    "usefulFor": [
      "time-series modeling",
      "mapping",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NOAA dataset/product citation guidance applies.",
    "privacyEthicsWarnings": "Environmental data; no major personal-data concern, but usage may be logged by service.",
    "citationAttributionNotes": "Cite NOAA NCEI Access Data Service, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong machine-readable path into NOAA environmental data.",
    "limitationsCautions": "Use correct dataset identifiers, station parameters, and units.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-firms",
    "name": "NASA FIRMS",
    "officialUrl": "https://firms.modaps.eosdis.nasa.gov/",
    "organization": "NASA FIRMS",
    "category": "Environmental Data",
    "sourceType": "Hazard data portal",
    "bestFor": "Near-real-time active fire and thermal anomaly data.",
    "primaryTopics": [
      "wildfire",
      "fire",
      "hazards",
      "remote sensing",
      "thermal anomalies"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NASA FIRMS citation and use guidance applies.",
    "privacyEthicsWarnings": "Fire data can affect communities and emergency response. Avoid sensational claims.",
    "citationAttributionNotes": "Cite NASA FIRMS, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Excellent wildfire and hazard monitoring source.",
    "limitationsCautions": "Thermal anomaly detections are not always confirmed fires; interpret with context.",
    "riskLabels": [
      "Useful but not conclusive",
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-earthexplorer",
    "name": "USGS EarthExplorer",
    "officialUrl": "https://earthexplorer.usgs.gov/",
    "organization": "USGS EarthExplorer",
    "category": "Environmental Data",
    "sourceType": "Earth observation portal",
    "bestFor": "Landsat, satellite imagery, aerial photos, and cartographic products.",
    "primaryTopics": [
      "remote sensing",
      "Landsat",
      "satellite imagery",
      "aerial imagery",
      "mapping"
    ],
    "usefulFor": [
      "mapping",
      "computer vision",
      "time-series modeling",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "USGS/NASA product terms and citation guidance apply; many Landsat products are public.",
    "privacyEthicsWarnings": "Imagery can reveal location-sensitive features; be cautious with sensitive habitats or private sites.",
    "citationAttributionNotes": "Cite USGS EarthExplorer, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core U.S. remote-sensing and geospatial archive.",
    "limitationsCautions": "Account required; imagery processing, cloud cover, projection, and product levels matter.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "copernicus-data-space-ecosystem",
    "name": "Copernicus Data Space Ecosystem",
    "officialUrl": "https://dataspace.copernicus.eu/",
    "organization": "Copernicus Data Space Ecosystem",
    "category": "Environmental Data",
    "sourceType": "Earth observation portal",
    "bestFor": "Sentinel data and European Earth observation access.",
    "primaryTopics": [
      "Copernicus",
      "Sentinel",
      "remote sensing",
      "Europe",
      "earth observation"
    ],
    "usefulFor": [
      "mapping",
      "computer vision",
      "time-series modeling",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Copernicus data policies and product-specific terms apply.",
    "privacyEthicsWarnings": "Cloud/account workflows may expose user metadata; imagery can have location sensitivity.",
    "citationAttributionNotes": "Cite Copernicus Data Space Ecosystem, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Powerful Sentinel and European Earth observation source.",
    "limitationsCautions": "Partly cloud-enabled and account/API dependent.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "google-earth-engine-data-catalog",
    "name": "Google Earth Engine Data Catalog",
    "officialUrl": "https://developers.google.com/earth-engine/datasets",
    "organization": "Google Earth Engine Data Catalog",
    "category": "Environmental Data",
    "sourceType": "Geospatial data catalog",
    "bestFor": "Earth science raster/vector datasets for analysis in Google Earth Engine.",
    "primaryTopics": [
      "earth engine",
      "remote sensing",
      "geospatial",
      "raster",
      "catalog"
    ],
    "usefulFor": [
      "mapping",
      "time-series modeling",
      "computer vision",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Dataset licenses vary; Earth Engine access does not grant training rights.",
    "privacyEthicsWarnings": "Uses Google Cloud/Earth Engine account workflows.",
    "citationAttributionNotes": "Cite Google Earth Engine Data Catalog, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Highly useful catalog for geospatial analysis and environmental modeling.",
    "limitationsCautions": "Google-cloud dependent; verify each dataset’s terms and export limits.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Licensing/training caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "google-earth-engine",
    "name": "Google Earth Engine",
    "officialUrl": "https://earthengine.google.com/",
    "organization": "Google Earth Engine",
    "category": "Environmental Data",
    "sourceType": "Geospatial platform",
    "bestFor": "Cloud-based geospatial analysis and Earth observation workflows.",
    "primaryTopics": [
      "geospatial analysis",
      "remote sensing",
      "cloud",
      "earth observation"
    ],
    "usefulFor": [
      "mapping",
      "time-series modeling",
      "computer vision",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Platform terms and dataset-specific licenses apply.",
    "privacyEthicsWarnings": "Cloud processing and account metadata leave local control.",
    "citationAttributionNotes": "Cite Google Earth Engine, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Powerful geospatial analysis platform for environmental research.",
    "limitationsCautions": "Not local-first; requires careful export, cost, and license thinking.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Licensing/training caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "google-bigquery-public-datasets",
    "name": "Google BigQuery Public Datasets",
    "officialUrl": "https://cloud.google.com/bigquery/public-data",
    "organization": "Google BigQuery Public Datasets",
    "category": "Environmental Data",
    "sourceType": "Cloud-hosted data registry",
    "bestFor": "Public datasets accessible through Google BigQuery.",
    "primaryTopics": [
      "cloud data",
      "BigQuery",
      "public datasets",
      "large datasets"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "benchmarking",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Dataset-specific licenses and Google Cloud terms apply.",
    "privacyEthicsWarnings": "Queries run through Google Cloud; account and billing metadata may apply.",
    "citationAttributionNotes": "Cite Google BigQuery Public Datasets, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for large-scale data access when cloud workflow is appropriate.",
    "limitationsCautions": "Not local-first by default; check costs, terms, and dataset provenance.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Licensing/training caution",
      "Dataset-specific license",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "openstreetmap",
    "name": "OpenStreetMap",
    "officialUrl": "https://www.openstreetmap.org/",
    "organization": "OpenStreetMap",
    "category": "Environmental Data",
    "sourceType": "Geospatial platform",
    "bestFor": "Global community map data.",
    "primaryTopics": [
      "mapping",
      "roads",
      "places",
      "geospatial",
      "community data"
    ],
    "usefulFor": [
      "mapping",
      "RAG",
      "public policy",
      "conservation",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "OpenStreetMap data use is governed by ODbL; attribution and share-alike obligations may apply.",
    "privacyEthicsWarnings": "Map data can reveal sensitive places or community infrastructure.",
    "citationAttributionNotes": "Cite OpenStreetMap, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Foundational open geospatial layer for mapping and civic/environmental analysis.",
    "limitationsCautions": "Community data can be uneven, incomplete, or outdated; ODbL obligations matter.",
    "riskLabels": [
      "Useful but not conclusive",
      "Attribution required",
      "Share-alike possible",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-national-hydrography",
    "name": "USGS National Hydrography",
    "officialUrl": "https://www.usgs.gov/national-hydrography",
    "organization": "USGS National Hydrography",
    "category": "Environmental Data",
    "sourceType": "Government geospatial data portal",
    "bestFor": "U.S. hydrography, drainage networks, and water features.",
    "primaryTopics": [
      "hydrology",
      "water",
      "watersheds",
      "streams",
      "geospatial"
    ],
    "usefulFor": [
      "mapping",
      "time-series modeling",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official USGS data; cite USGS product and version.",
    "privacyEthicsWarnings": "Environmental/geospatial data; sensitive site context may matter.",
    "citationAttributionNotes": "Cite USGS National Hydrography, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core hydrology and watershed mapping source.",
    "limitationsCautions": "Use correct versions and understand 3DHP/NHD/WBD product differences.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-3d-hydrography-program",
    "name": "USGS 3D Hydrography Program",
    "officialUrl": "https://www.usgs.gov/3d-hydrography-program",
    "organization": "USGS 3D Hydrography Program",
    "category": "Environmental Data",
    "sourceType": "Government geospatial data portal",
    "bestFor": "Modernized U.S. hydrography data and elevation-integrated water networks.",
    "primaryTopics": [
      "hydrography",
      "3DHP",
      "watersheds",
      "geospatial",
      "water"
    ],
    "usefulFor": [
      "mapping",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official USGS product citation guidance applies.",
    "privacyEthicsWarnings": "Geospatial environmental data; sensitive contexts may still matter.",
    "citationAttributionNotes": "Cite USGS 3D Hydrography Program, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important future-facing source for U.S. hydrography and watershed modeling.",
    "limitationsCautions": "Transition from older hydrography products may require product/version awareness.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-watershed-boundary-dataset",
    "name": "USGS Watershed Boundary Dataset",
    "officialUrl": "https://www.usgs.gov/national-hydrography/watershed-boundary-dataset",
    "organization": "USGS Watershed Boundary Dataset",
    "category": "Environmental Data",
    "sourceType": "Government geospatial data portal",
    "bestFor": "Watershed and hydrologic unit boundaries for the United States.",
    "primaryTopics": [
      "watersheds",
      "hydrologic units",
      "geospatial",
      "water"
    ],
    "usefulFor": [
      "mapping",
      "science/reference",
      "conservation",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official USGS dataset; cite version/date and source.",
    "privacyEthicsWarnings": "Geospatial boundaries can intersect communities and infrastructure.",
    "citationAttributionNotes": "Cite USGS Watershed Boundary Dataset, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Foundational for watershed-scale environmental analysis.",
    "limitationsCautions": "Hydrologic units are analytical boundaries, not political or ecological proof by themselves.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-epa-water-quality-portal",
    "name": "USGS/EPA Water Quality Portal",
    "officialUrl": "https://www.waterqualitydata.us/",
    "organization": "USGS/EPA Water Quality Portal",
    "category": "Environmental Data",
    "sourceType": "Environmental data portal",
    "bestFor": "U.S. surface-water chemistry, biology, and monitoring data.",
    "primaryTopics": [
      "water quality",
      "streams",
      "chemistry",
      "biology",
      "monitoring",
      "EPA",
      "USGS"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "science/reference",
      "conservation",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official portal combining partner water-quality data; cite originating organization, dataset, site, and access date.",
    "privacyEthicsWarnings": "Water-quality data can affect communities, landowners, and regulatory narratives.",
    "citationAttributionNotes": "Cite USGS/EPA Water Quality Portal, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core Aquaria-type source for U.S. water monitoring.",
    "limitationsCautions": "Sampling methods, detection limits, station history, and parameter codes matter.",
    "riskLabels": [
      "Useful but not conclusive",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "epa-enterprise-data-catalog",
    "name": "EPA Enterprise Data Catalog",
    "officialUrl": "https://edg.epa.gov/metadata/catalog/main/home.page",
    "organization": "EPA Enterprise Data Catalog",
    "category": "Environmental Data",
    "sourceType": "Government data catalog",
    "bestFor": "EPA environmental datasets, geospatial resources, pollution, water, enforcement, and metadata.",
    "primaryTopics": [
      "EPA",
      "pollution",
      "water",
      "geospatial",
      "environmental regulation"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "public policy",
      "science/reference",
      "environmental justice"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "EPA/public data terms and dataset-specific notes apply.",
    "privacyEthicsWarnings": "Environmental enforcement and facility data can affect communities and organizations.",
    "citationAttributionNotes": "Cite EPA Enterprise Data Catalog, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good registry for EPA environmental datasets and metadata.",
    "limitationsCautions": "Metadata catalog; follow through to source datasets and methodology.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "epa-enviroatlas",
    "name": "EPA EnviroAtlas",
    "officialUrl": "https://www.epa.gov/enviroatlas",
    "organization": "EPA EnviroAtlas",
    "category": "Environmental Data",
    "sourceType": "Environmental mapping tool",
    "bestFor": "Ecosystem services, maps, community indicators, and ecological planning data.",
    "primaryTopics": [
      "ecosystem services",
      "community indicators",
      "mapping",
      "EPA",
      "ecology"
    ],
    "usefulFor": [
      "mapping",
      "RAG",
      "public policy",
      "science/reference",
      "conservation",
      "environmental justice"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "EPA dataset/product terms and citation guidance apply.",
    "privacyEthicsWarnings": "Community indicators can be misused if treated as judgment about communities.",
    "citationAttributionNotes": "Cite EPA EnviroAtlas, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Excellent ecological planning and ecosystem-services source.",
    "limitationsCautions": "Indicators support screening/planning, not final proof of harm or benefit.",
    "riskLabels": [
      "Useful but not conclusive",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "epa-ejscreen",
    "name": "EPA EJSCREEN",
    "officialUrl": "https://www.epa.gov/ejscreen",
    "organization": "EPA EJSCREEN",
    "category": "Environmental Data",
    "sourceType": "Environmental justice screening tool",
    "bestFor": "Environmental justice screening, demographic, and environmental burden indicators.",
    "primaryTopics": [
      "environmental justice",
      "screening",
      "EPA",
      "pollution",
      "demographics"
    ],
    "usefulFor": [
      "mapping",
      "RAG",
      "public policy",
      "environmental justice",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "EPA product guidance and citation requirements apply.",
    "privacyEthicsWarnings": "High caution: screening indicators involve communities, demographics, and environmental burden.",
    "citationAttributionNotes": "Cite EPA EJSCREEN, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important environmental justice screening source.",
    "limitationsCautions": "Screening tool, not final proof of harm, causation, or legal violation.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Useful but not conclusive",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "epa-tri--toxics-release-inventory",
    "name": "EPA TRI / Toxics Release Inventory",
    "officialUrl": "https://www.epa.gov/toxics-release-inventory-tri-program",
    "organization": "EPA TRI",
    "category": "Environmental Data",
    "sourceType": "Government environmental data portal",
    "bestFor": "Industrial pollution and toxic release reporting.",
    "primaryTopics": [
      "pollution",
      "toxic releases",
      "industry",
      "EPA",
      "environmental justice"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "public policy",
      "environmental justice",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official EPA TRI data; cite reporting year, facility, chemical, and data source.",
    "privacyEthicsWarnings": "Facility and community context can be sensitive and politically consequential.",
    "citationAttributionNotes": "Cite EPA TRI / Toxics Release Inventory, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important source for pollution, public health context, and accountability research.",
    "limitationsCautions": "Reported releases are not the same as exposure, risk, or health outcome by themselves.",
    "riskLabels": [
      "Useful but not conclusive",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "gbif",
    "name": "GBIF",
    "officialUrl": "https://www.gbif.org/",
    "organization": "GBIF",
    "category": "Environmental Data",
    "sourceType": "Biodiversity database",
    "bestFor": "Global species occurrences and biodiversity datasets.",
    "primaryTopics": [
      "biodiversity",
      "species occurrences",
      "ecology",
      "conservation",
      "citizen science"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "science/reference",
      "conservation",
      "computer vision",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset licenses vary; cite GBIF DOI/download and contributing datasets.",
    "privacyEthicsWarnings": "Sensitive species/location data and sampling bias require care.",
    "citationAttributionNotes": "Cite GBIF, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Foundational biodiversity occurrence source.",
    "limitationsCautions": "Occurrence records can be biased, duplicated, misidentified, or spatially uneven.",
    "riskLabels": [
      "Useful but not conclusive",
      "Dataset-specific license",
      "Attribution required",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "iucn-red-list",
    "name": "IUCN Red List",
    "officialUrl": "https://www.iucnredlist.org/",
    "organization": "IUCN Red List",
    "category": "Environmental Data",
    "sourceType": "Conservation database",
    "bestFor": "Species conservation status, threat categories, and conservation assessments.",
    "primaryTopics": [
      "conservation",
      "species status",
      "threats",
      "biodiversity"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "conservation",
      "public policy"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "IUCN terms and API conditions apply. Assessments require proper citation.",
    "privacyEthicsWarnings": "Sensitive species data may have conservation and location risks.",
    "citationAttributionNotes": "Cite IUCN Red List, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong conservation reference source for species status.",
    "limitationsCautions": "API/account may be required; assessment status should not be overextended beyond scope.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "inaturalist",
    "name": "iNaturalist",
    "officialUrl": "https://www.inaturalist.org/",
    "organization": "iNaturalist",
    "category": "Environmental Data",
    "sourceType": "Citizen-science biodiversity platform",
    "bestFor": "Citizen-science species observations, photos, and community identifications.",
    "primaryTopics": [
      "biodiversity",
      "citizen science",
      "species observations",
      "photos",
      "mapping"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "computer vision",
      "science/reference",
      "conservation",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Observation, photo, and media licenses vary by user/content.",
    "privacyEthicsWarnings": "Location, observer, and sensitive species data require care.",
    "citationAttributionNotes": "Cite iNaturalist, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful biodiversity observation source with rich media and community IDs.",
    "limitationsCautions": "Spatial bias, ID uncertainty, missingness, and license variation matter.",
    "riskLabels": [
      "Useful but not conclusive",
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "ebird",
    "name": "eBird",
    "officialUrl": "https://ebird.org/",
    "organization": "eBird",
    "category": "Environmental Data",
    "sourceType": "Citizen-science biodiversity platform",
    "bestFor": "Bird observations and citizen-science bird distribution data.",
    "primaryTopics": [
      "birds",
      "citizen science",
      "biodiversity",
      "species observations",
      "conservation"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Access and reuse rules vary by data product; check eBird/Cornell terms.",
    "privacyEthicsWarnings": "Sensitive species and location data may be restricted.",
    "citationAttributionNotes": "Cite eBird, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major source for bird observation and distribution analysis.",
    "limitationsCautions": "Citizen-science sampling bias and access rules matter.",
    "riskLabels": [
      "Useful but not conclusive",
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "unep-data-resources--wesr",
    "name": "UNEP Data Resources / WESR",
    "officialUrl": "https://wesr.unep.org/",
    "organization": "UNEP Data Resources",
    "category": "Environmental Data",
    "sourceType": "International environmental data portal",
    "bestFor": "Environmental reports, sustainability data, global resources, and World Environment Situation Room.",
    "primaryTopics": [
      "environment",
      "sustainability",
      "UNEP",
      "global",
      "policy"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "conservation"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "UNEP/source-specific licenses and report terms apply.",
    "privacyEthicsWarnings": "Mostly global/regional environmental indicators; check context.",
    "citationAttributionNotes": "Cite UNEP Data Resources / WESR, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong global environmental policy and reference shelf.",
    "limitationsCautions": "Some resources are reports or dashboards rather than raw datasets.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usda-nass-quick-stats",
    "name": "USDA NASS Quick Stats",
    "officialUrl": "https://quickstats.nass.usda.gov/",
    "organization": "USDA NASS Quick Stats",
    "category": "Environmental Data",
    "sourceType": "Government agriculture data portal",
    "bestFor": "U.S. crops, livestock, farms, yields, acreage, and agricultural statistics.",
    "primaryTopics": [
      "agriculture",
      "crops",
      "livestock",
      "farms",
      "United States",
      "time series"
    ],
    "usefulFor": [
      "RAG",
      "time-series modeling",
      "mapping",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official USDA/NASS data; cite survey/census, year, and source.",
    "privacyEthicsWarnings": "Mostly aggregate agricultural data; local interpretation can affect communities/industries.",
    "citationAttributionNotes": "Cite USDA NASS Quick Stats, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core U.S. agriculture statistics source.",
    "limitationsCautions": "API key often required; survey methodology and geography matter.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usda-nass-api",
    "name": "USDA NASS API",
    "officialUrl": "https://quickstats.nass.usda.gov/api",
    "organization": "USDA NASS API",
    "category": "Environmental Data",
    "sourceType": "Government API documentation",
    "bestFor": "Programmatic access to USDA NASS Quick Stats.",
    "primaryTopics": [
      "agriculture",
      "API",
      "USDA",
      "time series"
    ],
    "usefulFor": [
      "time-series modeling",
      "mapping",
      "public policy",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NASS data/citation terms apply.",
    "privacyEthicsWarnings": "API/key metadata may leave local control.",
    "citationAttributionNotes": "Cite USDA NASS API, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for reproducible agricultural data workflows.",
    "limitationsCautions": "Requires API key and careful query construction.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "ipums",
    "name": "IPUMS",
    "officialUrl": "https://www.ipums.org/",
    "organization": "IPUMS",
    "category": "Social & Economic Data",
    "sourceType": "Research data repository",
    "bestFor": "Harmonized census and survey microdata.",
    "primaryTopics": [
      "census",
      "microdata",
      "surveys",
      "demographics",
      "social science"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Registration and project-specific terms apply. Follow IPUMS citation and use requirements.",
    "privacyEthicsWarnings": "High caution: microdata can encode sensitive human attributes and reidentification risk.",
    "citationAttributionNotes": "Cite IPUMS, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong source for harmonized demographic and social-science microdata.",
    "limitationsCautions": "Registration required; never treat microdata casually or as training-safe by default.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "u-s-census-microdata-api",
    "name": "U.S. Census Microdata API",
    "officialUrl": "https://www.census.gov/data/developers/data-sets.html",
    "organization": "U.S. Census Microdata API",
    "category": "Social & Economic Data",
    "sourceType": "Government API documentation",
    "bestFor": "Programmatic access to Census datasets including ACS and microdata-related endpoints.",
    "primaryTopics": [
      "census",
      "microdata",
      "API",
      "demographics",
      "housing"
    ],
    "usefulFor": [
      "RAG",
      "public policy",
      "science/reference",
      "mapping",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Census dataset/product terms and API guidance apply.",
    "privacyEthicsWarnings": "Microdata and small-area data require privacy-aware handling.",
    "citationAttributionNotes": "Cite U.S. Census Microdata API, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful API documentation for Census data workflows.",
    "limitationsCautions": "Check dataset scope, geography, variables, margins of error, and privacy constraints.",
    "riskLabels": [
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pubchem",
    "name": "PubChem",
    "officialUrl": "https://pubchem.ncbi.nlm.nih.gov/",
    "organization": "PubChem",
    "category": "Physical Science Data",
    "sourceType": "Chemistry database",
    "bestFor": "Chemical compounds, structures, properties, bioactivity, and linked chemical data.",
    "primaryTopics": [
      "chemistry",
      "compounds",
      "bioactivity",
      "structures",
      "properties"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "PubChem records aggregate multiple contributors; check record/source details and NCBI policies.",
    "privacyEthicsWarnings": "Chemical data can be dual-use in some contexts; avoid unsafe synthesis or misuse framing.",
    "citationAttributionNotes": "Cite PubChem, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core open chemistry and compound reference source.",
    "limitationsCautions": "Linked source records vary in provenance and quality.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nist-chemistry-webbook",
    "name": "NIST Chemistry WebBook",
    "officialUrl": "https://webbook.nist.gov/chemistry/",
    "organization": "NIST Chemistry WebBook",
    "category": "Physical Science Data",
    "sourceType": "Scientific reference database",
    "bestFor": "Thermochemical, thermophysical, and ion energetics reference data.",
    "primaryTopics": [
      "chemistry",
      "thermodynamics",
      "spectra",
      "NIST",
      "reference"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "NIST data citation and standard reference guidance apply.",
    "privacyEthicsWarnings": "Low personal-data concern; scientific accuracy and scope matter.",
    "citationAttributionNotes": "Cite NIST Chemistry WebBook, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Reference/validation source for physical chemistry data.",
    "limitationsCautions": "Not a generic training pile; use as authoritative reference with proper citation.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "materials-project",
    "name": "Materials Project",
    "officialUrl": "https://materialsproject.org/",
    "organization": "Materials Project",
    "category": "Physical Science Data",
    "sourceType": "Materials science database",
    "bestFor": "Computed materials properties, crystal structures, batteries, catalysts, and materials discovery.",
    "primaryTopics": [
      "materials science",
      "crystals",
      "batteries",
      "catalysts",
      "simulation"
    ],
    "usefulFor": [
      "RAG",
      "benchmarking",
      "science/reference",
      "fine-tuning"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Materials Project terms and citation requirements apply.",
    "privacyEthicsWarnings": "Low personal-data concern; respect API and data terms.",
    "citationAttributionNotes": "Cite Materials Project, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong ML/materials source for computational materials research.",
    "limitationsCautions": "Account/API key required; computed data depends on methodology.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nist-data-repository",
    "name": "NIST Data Repository",
    "officialUrl": "https://data.nist.gov/",
    "organization": "NIST Data Repository",
    "category": "Physical Science Data",
    "sourceType": "Research repository",
    "bestFor": "Measurement science, engineering, chemistry, physics, and standards-adjacent datasets.",
    "primaryTopics": [
      "NIST",
      "measurement",
      "engineering",
      "standards",
      "research data"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NIST/public dataset terms and record-specific licenses apply.",
    "privacyEthicsWarnings": "Mostly scientific/engineering data; check record context.",
    "citationAttributionNotes": "Cite NIST Data Repository, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good standards-adjacent repository for measurement and engineering datasets.",
    "limitationsCautions": "Dataset scope and documentation vary by record.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nist-jarvis",
    "name": "NIST JARVIS",
    "officialUrl": "https://jarvis.nist.gov/",
    "organization": "NIST JARVIS",
    "category": "Physical Science Data",
    "sourceType": "Materials science database",
    "bestFor": "Materials discovery, simulation data, and machine-learning resources.",
    "primaryTopics": [
      "materials science",
      "simulation",
      "ML",
      "crystals",
      "NIST"
    ],
    "usefulFor": [
      "RAG",
      "benchmarking",
      "fine-tuning",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Check JARVIS/NIST terms, citations, and dataset-specific notes.",
    "privacyEthicsWarnings": "Low personal-data concern; computational methods and provenance matter.",
    "citationAttributionNotes": "Cite NIST JARVIS, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong computational materials resource.",
    "limitationsCautions": "Understand computed-data limitations before training or benchmarking.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "open-catalyst-project",
    "name": "Open Catalyst Project",
    "officialUrl": "https://opencatalystproject.org/",
    "organization": "Open Catalyst Project",
    "category": "Physical Science Data",
    "sourceType": "ML dataset project",
    "bestFor": "Catalysis and materials machine-learning datasets.",
    "primaryTopics": [
      "catalysis",
      "materials",
      "machine learning",
      "simulation",
      "chemistry"
    ],
    "usefulFor": [
      "benchmarking",
      "fine-tuning",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Project-specific dataset licenses and citation terms apply.",
    "privacyEthicsWarnings": "Low personal-data concern; ML benchmark use should follow project guidance.",
    "citationAttributionNotes": "Cite Open Catalyst Project, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important AI/materials research dataset project.",
    "limitationsCautions": "Large technical datasets require understanding of methods and benchmark constraints.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-exoplanet-archive",
    "name": "NASA Exoplanet Archive",
    "officialUrl": "https://exoplanetarchive.ipac.caltech.edu/",
    "organization": "NASA Exoplanet Archive",
    "category": "Physical Science Data",
    "sourceType": "Astronomy database",
    "bestFor": "Exoplanet tables, stellar/planetary data, and astronomy APIs.",
    "primaryTopics": [
      "astronomy",
      "exoplanets",
      "planetary science",
      "NASA",
      "tables"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "time-series modeling"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NASA/IPAC citation and data-use guidance apply.",
    "privacyEthicsWarnings": "Low personal-data concern.",
    "citationAttributionNotes": "Cite NASA Exoplanet Archive, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong planetary science and exoplanet reference source.",
    "limitationsCautions": "Astronomical parameters can be updated; cite access date/version.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-ads",
    "name": "NASA ADS",
    "officialUrl": "https://ui.adsabs.harvard.edu/",
    "organization": "NASA ADS",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Literature index",
    "bestFor": "Astronomy and physics literature search and citation metadata.",
    "primaryTopics": [
      "astronomy",
      "physics",
      "literature",
      "citations",
      "NASA"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Metadata and linked content terms vary. Respect publisher and API terms.",
    "privacyEthicsWarnings": "Account/API workflows may expose user metadata.",
    "citationAttributionNotes": "Cite NASA ADS, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Essential astronomy/physics literature discovery tool.",
    "limitationsCautions": "Full-text availability and reuse rights vary by linked source.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nasa-ads-api",
    "name": "NASA ADS API",
    "officialUrl": "https://ui.adsabs.harvard.edu/help/api/",
    "organization": "NASA ADS API",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "API documentation",
    "bestFor": "Programmatic access to ADS literature metadata.",
    "primaryTopics": [
      "astronomy",
      "physics",
      "literature API",
      "citations"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "ADS API terms and linked publisher terms apply.",
    "privacyEthicsWarnings": "API token/account metadata may leave local control.",
    "citationAttributionNotes": "Cite NASA ADS API, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for reproducible literature maps in astronomy and physics.",
    "limitationsCautions": "Token required; do not scrape linked full texts without rights.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Licensing/training caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-earthquake-catalog",
    "name": "USGS Earthquake Catalog",
    "officialUrl": "https://earthquake.usgs.gov/earthquakes/search/",
    "organization": "USGS Earthquake Catalog",
    "category": "Physical Science Data",
    "sourceType": "Geophysical data portal",
    "bestFor": "Earthquake event data and geophysical hazard analysis.",
    "primaryTopics": [
      "earthquakes",
      "geophysics",
      "hazards",
      "USGS",
      "Terraflux"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "time-series modeling",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Official USGS data citation and product guidance apply.",
    "privacyEthicsWarnings": "Hazard data can affect communities; communicate risk carefully.",
    "citationAttributionNotes": "Cite USGS Earthquake Catalog, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good Terraflux/geophysical source for earthquake data.",
    "limitationsCautions": "Magnitude, depth, uncertainty, and update status matter.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "usgs-volcano-data",
    "name": "USGS Volcano Data",
    "officialUrl": "https://www.usgs.gov/programs/VHP/data",
    "organization": "USGS Volcano Data",
    "category": "Physical Science Data",
    "sourceType": "Geophysical data portal",
    "bestFor": "Volcano and geohazard monitoring data.",
    "primaryTopics": [
      "volcanoes",
      "geohazards",
      "USGS",
      "monitoring",
      "Terraflux"
    ],
    "usefulFor": [
      "RAG",
      "mapping",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "USGS citation and product-specific terms apply.",
    "privacyEthicsWarnings": "Hazard communication can affect communities and should avoid alarmism.",
    "citationAttributionNotes": "Cite USGS Volcano Data, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good Terraflux/geophysics source for volcanic hazards.",
    "limitationsCautions": "Monitoring data and hazard levels require expert context.",
    "riskLabels": [
      "Useful but not conclusive",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "esa",
    "name": "ESA",
    "officialUrl": "https://www.esa.int/",
    "organization": "ESA",
    "category": "Physical Science Data",
    "sourceType": "Space agency portal",
    "bestFor": "European Space Agency missions, programs, space science, and Earth observation links.",
    "primaryTopics": [
      "space",
      "ESA",
      "earth observation",
      "space science"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Content/data terms vary by ESA program and product.",
    "privacyEthicsWarnings": "Low personal-data concern; check linked platform terms.",
    "citationAttributionNotes": "Cite ESA, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major institutional source for European space and Earth observation context.",
    "limitationsCautions": "General agency portal, not a single dataset catalog.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "esa-earth-online--earth-observation-gateway",
    "name": "ESA Earth Online / Earth Observation Gateway",
    "officialUrl": "https://earth.esa.int/eogateway",
    "organization": "ESA Earth Online",
    "category": "Environmental Data",
    "sourceType": "Earth observation portal",
    "bestFor": "ESA Earth observation missions, data access, tools, and documentation.",
    "primaryTopics": [
      "ESA",
      "earth observation",
      "remote sensing",
      "satellite data"
    ],
    "usefulFor": [
      "mapping",
      "science/reference",
      "computer vision",
      "time-series modeling"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "ESA product-specific terms, access rules, and citations apply.",
    "privacyEthicsWarnings": "Account/cloud workflows may expose user metadata.",
    "citationAttributionNotes": "Cite ESA Earth Online / Earth Observation Gateway, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important ESA Earth-observation data and documentation gateway.",
    "limitationsCautions": "Access requirements vary by mission/product.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "ncbi-datasets",
    "name": "NCBI Datasets",
    "officialUrl": "https://www.ncbi.nlm.nih.gov/datasets/",
    "organization": "NCBI Datasets",
    "category": "Biology & Health Data",
    "sourceType": "Biological database",
    "bestFor": "Genomes, genes, biological sequences, and organism metadata.",
    "primaryTopics": [
      "genomics",
      "genes",
      "sequences",
      "biology",
      "NCBI"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking",
      "fine-tuning"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "NCBI records aggregate multiple sources. Check source organisms, annotations, and citation guidance.",
    "privacyEthicsWarnings": "Genomic data can be sensitive when human-related; public biological data still needs ethics review.",
    "citationAttributionNotes": "Cite NCBI Datasets, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core biology and genomics source.",
    "limitationsCautions": "Annotation quality, assembly versions, and human-genomic sensitivity matter.",
    "riskLabels": [
      "Dataset-specific license",
      "Sensitive human data"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "ncbi-e-utilities",
    "name": "NCBI E-utilities",
    "officialUrl": "https://www.ncbi.nlm.nih.gov/books/NBK25501/",
    "organization": "NCBI E-utilities",
    "category": "Biology & Health Data",
    "sourceType": "API documentation",
    "bestFor": "Programmatic access to NCBI databases and linked biomedical resources.",
    "primaryTopics": [
      "NCBI",
      "API",
      "biology",
      "biomedical literature",
      "metadata"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "NCBI usage policies, rate limits, and database-specific citation rules apply.",
    "privacyEthicsWarnings": "Queries may touch biomedical topics; do not use for private health inference.",
    "citationAttributionNotes": "Cite NCBI E-utilities, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Essential API layer for reproducible biological and biomedical workflows.",
    "limitationsCautions": "Respect rate limits and source-specific licenses.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pubmed-apis",
    "name": "PubMed APIs",
    "officialUrl": "https://www.ncbi.nlm.nih.gov/books/NBK25499/",
    "organization": "PubMed APIs",
    "category": "Biology & Health Data",
    "sourceType": "API documentation",
    "bestFor": "Programmatic access to PubMed and NCBI literature metadata.",
    "primaryTopics": [
      "PubMed",
      "API",
      "biomedical literature",
      "metadata"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "PubMed metadata and linked article licenses vary; full text is not automatically reusable.",
    "privacyEthicsWarnings": "Biomedical queries can be sensitive if tied to user history.",
    "citationAttributionNotes": "Cite PubMed APIs, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for biomedical literature mapping and citation workflows.",
    "limitationsCautions": "Metadata access is not full-text training permission.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "ensembl",
    "name": "Ensembl",
    "officialUrl": "https://www.ensembl.org/",
    "organization": "Ensembl",
    "category": "Biology & Health Data",
    "sourceType": "Genomics database",
    "bestFor": "Reference genomes, gene models, variation data, and genomics APIs.",
    "primaryTopics": [
      "genomics",
      "genes",
      "variation",
      "reference genomes",
      "biology"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Check Ensembl terms, dataset citations, and genome-specific annotations.",
    "privacyEthicsWarnings": "Human variation data requires careful ethical framing.",
    "citationAttributionNotes": "Cite Ensembl, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong genomics API and reference genome source.",
    "limitationsCautions": "Genome versions and annotation releases matter.",
    "riskLabels": [
      "Dataset-specific license",
      "Sensitive human data",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "rcsb-protein-data-bank",
    "name": "RCSB Protein Data Bank",
    "officialUrl": "https://www.rcsb.org/",
    "organization": "RCSB Protein Data Bank",
    "category": "Biology & Health Data",
    "sourceType": "Structural biology database",
    "bestFor": "3D biological macromolecular structures.",
    "primaryTopics": [
      "proteins",
      "structural biology",
      "macromolecules",
      "3D structures"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking",
      "computer vision"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "PDB usage/citation guidance applies; individual entries have deposition metadata.",
    "privacyEthicsWarnings": "Low personal-data concern, but biomedical misuse context can matter.",
    "citationAttributionNotes": "Cite RCSB Protein Data Bank, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core structural biology source.",
    "limitationsCautions": "Structures have experimental method, resolution, and validation constraints.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "worldwide-protein-data-bank",
    "name": "Worldwide Protein Data Bank",
    "officialUrl": "https://www.wwpdb.org/",
    "organization": "Worldwide Protein Data Bank",
    "category": "Biology & Health Data",
    "sourceType": "Structural biology archive stewardship",
    "bestFor": "Global PDB archive stewardship and structural biology coordination.",
    "primaryTopics": [
      "protein data bank",
      "structural biology",
      "archive",
      "stewardship"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "PDB archive policies and citation guidance apply.",
    "privacyEthicsWarnings": "Low personal-data concern.",
    "citationAttributionNotes": "Cite Worldwide Protein Data Bank, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Global stewardship layer for PDB archive coordination.",
    "limitationsCautions": "Use RCSB or partner portals for many user-facing searches.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pubmed",
    "name": "PubMed",
    "officialUrl": "https://pubmed.ncbi.nlm.nih.gov/",
    "organization": "PubMed",
    "category": "Biology & Health Data",
    "sourceType": "Literature index",
    "bestFor": "Biomedical literature metadata and abstracts.",
    "primaryTopics": [
      "biomedical literature",
      "medicine",
      "biology",
      "health",
      "citations"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "PubMed metadata is not the same as full-text reuse rights. Article licenses vary.",
    "privacyEthicsWarnings": "Medical topics can be sensitive; avoid personal diagnostic inference from literature search alone.",
    "citationAttributionNotes": "Cite PubMed, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong biomedical literature discovery and citation source.",
    "limitationsCautions": "Abstracts and metadata are not complete evidence; read methods and full texts when allowed.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pubmed-central--pmc",
    "name": "PubMed Central / PMC",
    "officialUrl": "https://pmc.ncbi.nlm.nih.gov/",
    "organization": "PubMed Central",
    "category": "Biology & Health Data",
    "sourceType": "Open-access literature repository",
    "bestFor": "Open full-text biomedical and life-science papers.",
    "primaryTopics": [
      "biomedical papers",
      "open access",
      "full text",
      "life sciences"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "fine-tuning",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Article-specific licenses vary. Open access does not always mean unrestricted training or reuse.",
    "privacyEthicsWarnings": "Biomedical content can be sensitive and should not be used for personalized medical advice without proper guardrails.",
    "citationAttributionNotes": "Cite PubMed Central / PMC, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important open full-text biomedical repository.",
    "limitationsCautions": "Check each article license before redistribution or training.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "openneuro",
    "name": "OpenNeuro",
    "officialUrl": "https://openneuro.org/",
    "organization": "OpenNeuro",
    "category": "Biology & Health Data",
    "sourceType": "Research repository",
    "bestFor": "BIDS-compliant MRI, PET, MEG, EEG, and neuroscience data.",
    "primaryTopics": [
      "neuroscience",
      "MRI",
      "EEG",
      "MEG",
      "PET",
      "human subjects"
    ],
    "usefulFor": [
      "RAG",
      "benchmarking",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset-specific licenses and subject-use constraints apply.",
    "privacyEthicsWarnings": "High caution: human neuroimaging data can be sensitive despite de-identification.",
    "citationAttributionNotes": "Cite OpenNeuro, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful neuroscience dataset source for research and benchmarking.",
    "limitationsCautions": "Human-subject ethics, consent, de-identification, and dataset terms must be reviewed.",
    "riskLabels": [
      "High caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "crossref",
    "name": "Crossref",
    "officialUrl": "https://www.crossref.org/",
    "organization": "Crossref",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Scholarly graph",
    "bestFor": "DOI metadata, citation linking, publishers, funders, and scholarly infrastructure.",
    "primaryTopics": [
      "DOI",
      "metadata",
      "citations",
      "scholarly graph"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "code research"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Crossref metadata has reuse terms; linked content licenses vary.",
    "privacyEthicsWarnings": "Low personal-data concern for public metadata.",
    "citationAttributionNotes": "Cite Crossref, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core DOI metadata and citation-linking source.",
    "limitationsCautions": "Metadata is not full-text permission.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "openalex",
    "name": "OpenAlex",
    "officialUrl": "https://openalex.org/",
    "organization": "OpenAlex",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Scholarly graph",
    "bestFor": "Works, authors, institutions, funders, venues, concepts, and scholarly graph data.",
    "primaryTopics": [
      "scholarly graph",
      "citations",
      "authors",
      "institutions",
      "metadata"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Check OpenAlex license and attribution guidance.",
    "privacyEthicsWarnings": "Public scholarly metadata can still implicate people and institutions.",
    "citationAttributionNotes": "Cite OpenAlex, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Excellent open scholarly graph for literature maps.",
    "limitationsCautions": "Metadata errors and disambiguation issues can occur.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "semantic-scholar-api",
    "name": "Semantic Scholar API",
    "officialUrl": "https://www.semanticscholar.org/product/api",
    "organization": "Semantic Scholar API",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Literature API",
    "bestFor": "AI-indexed scientific papers, authors, citations, abstracts, and literature navigation.",
    "primaryTopics": [
      "scientific literature",
      "AI search",
      "citations",
      "API"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "benchmarking"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "API terms and linked paper licenses apply.",
    "privacyEthicsWarnings": "API usage may expose query metadata.",
    "citationAttributionNotes": "Cite Semantic Scholar API, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for research navigation and citation exploration.",
    "limitationsCautions": "API metadata is not full-text reuse permission.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Licensing/training caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "core",
    "name": "CORE",
    "officialUrl": "https://core.ac.uk/",
    "organization": "CORE",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Open-access literature index",
    "bestFor": "Open-access papers and metadata.",
    "primaryTopics": [
      "open access",
      "papers",
      "metadata",
      "repositories"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "fine-tuning",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Full-text and metadata licenses vary by source repository and article.",
    "privacyEthicsWarnings": "Scholarly content can include sensitive topics; training use needs license review.",
    "citationAttributionNotes": "Cite CORE, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good open-access literature RAG and metadata source.",
    "limitationsCautions": "Open access does not automatically mean training-safe.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "doaj",
    "name": "DOAJ",
    "officialUrl": "https://doaj.org/",
    "organization": "DOAJ",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Journal directory",
    "bestFor": "Open-access journal discovery and quality signals.",
    "primaryTopics": [
      "open access",
      "journals",
      "publishing",
      "metadata"
    ],
    "usefulFor": [
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Journal and article licenses vary; DOAJ helps discover them.",
    "privacyEthicsWarnings": "Low personal-data concern.",
    "citationAttributionNotes": "Cite DOAJ, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good source for finding open-access journals and publication venues.",
    "limitationsCautions": "Directory entry is not the same as evaluating every article’s evidence quality.",
    "riskLabels": [
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "arxiv",
    "name": "arXiv",
    "officialUrl": "https://arxiv.org/",
    "organization": "arXiv",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Preprint repository",
    "bestFor": "Preprints in computer science, physics, math, statistics, quantitative biology, and related fields.",
    "primaryTopics": [
      "preprints",
      "computer science",
      "physics",
      "math",
      "statistics"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "fine-tuning",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Paper licenses vary. Preprint availability does not automatically grant training or redistribution rights.",
    "privacyEthicsWarnings": "Low personal-data concern for papers, but author/research-context data remains public personal metadata.",
    "citationAttributionNotes": "Cite arXiv, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major scientific preprint reference source.",
    "limitationsCautions": "Preprints are not necessarily peer reviewed; full-text training needs license review.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "papers-with-code",
    "name": "Papers with Code",
    "officialUrl": "https://paperswithcode.com/",
    "organization": "Papers with Code",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Research/code benchmark portal",
    "bestFor": "Papers, code, datasets, methods, benchmarks, and leaderboards.",
    "primaryTopics": [
      "papers",
      "code",
      "datasets",
      "benchmarks",
      "machine learning"
    ],
    "usefulFor": [
      "RAG",
      "benchmarking",
      "code research",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Linked papers, code, and datasets each have separate licenses.",
    "privacyEthicsWarnings": "Mostly public research metadata; linked datasets/code can carry risks.",
    "citationAttributionNotes": "Cite Papers with Code, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Excellent paper-code-dataset linking tool.",
    "limitationsCautions": "Leaderboards and linked repos need verification; license varies by item.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "web-of-science",
    "name": "Web of Science",
    "officialUrl": "https://www.webofscience.com/",
    "organization": "Web of Science",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Proprietary literature index",
    "bestFor": "Proprietary scholarly citation database.",
    "primaryTopics": [
      "scholarly index",
      "citations",
      "proprietary"
    ],
    "usefulFor": [
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Proprietary access and reuse restrictions apply.",
    "privacyEthicsWarnings": "Institutional account usage may be tracked.",
    "citationAttributionNotes": "Cite Web of Science, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Listed only as a cautionary/proprietary reference, not as an open Living Library default.",
    "limitationsCautions": "Do not present as open. Use only with clear proprietary-access warning.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Commercial-use restrictions possible",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "scopus",
    "name": "Scopus",
    "officialUrl": "https://www.scopus.com/",
    "organization": "Scopus",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Proprietary literature index",
    "bestFor": "Proprietary abstract and citation database.",
    "primaryTopics": [
      "scholarly index",
      "citations",
      "proprietary"
    ],
    "usefulFor": [
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Proprietary access and reuse restrictions apply.",
    "privacyEthicsWarnings": "Institutional account usage may be tracked.",
    "citationAttributionNotes": "Cite Scopus, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful to identify as proprietary/caution, not as a clean open source.",
    "limitationsCautions": "Do not list as open default.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Commercial-use restrictions possible",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "dimensions",
    "name": "Dimensions",
    "officialUrl": "https://www.dimensions.ai/",
    "organization": "Dimensions",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Mixed/proprietary scholarly platform",
    "bestFor": "Research discovery, grants, publications, patents, and scholarly analytics.",
    "primaryTopics": [
      "scholarly analytics",
      "grants",
      "publications",
      "patents",
      "proprietary"
    ],
    "usefulFor": [
      "science/reference",
      "public policy"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Mixed/proprietary access. Terms vary by product and account.",
    "privacyEthicsWarnings": "Institutional/account usage may be tracked.",
    "citationAttributionNotes": "Cite Dimensions, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Can be mentioned as a cautionary scholarly analytics platform.",
    "limitationsCautions": "Not a clean open default for the Living Library.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Commercial-use restrictions possible",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "microsoft-academic-graph-legacy",
    "name": "Microsoft Academic Graph, legacy",
    "officialUrl": "https://www.microsoft.com/en-us/research/project/microsoft-academic-graph/",
    "organization": "Microsoft Academic Graph, legacy",
    "category": "Research Papers & Scholarly Graphs",
    "sourceType": "Legacy scholarly graph",
    "bestFor": "Legacy/discontinued scholarly graph reference.",
    "primaryTopics": [
      "scholarly graph",
      "legacy",
      "discontinued"
    ],
    "usefulFor": [
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Legacy/discontinued; do not treat as active data source.",
    "privacyEthicsWarnings": "Low current practical use.",
    "citationAttributionNotes": "Cite Microsoft Academic Graph, legacy, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful only as historical context for scholarly graph evolution.",
    "limitationsCautions": "Skip as an active Living Library source.",
    "riskLabels": [
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "software-heritage",
    "name": "Software Heritage",
    "officialUrl": "https://www.softwareheritage.org/",
    "organization": "Software Heritage",
    "category": "Code Datasets",
    "sourceType": "Code archive",
    "bestFor": "Source-code preservation, provenance, and archival identifiers.",
    "primaryTopics": [
      "software preservation",
      "code archive",
      "provenance",
      "open source"
    ],
    "usefulFor": [
      "code research",
      "RAG",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Archived code retains original licenses. Public archive does not mean AI-training-safe.",
    "privacyEthicsWarnings": "Code archives can contain personal data, credentials, comments, and author metadata.",
    "citationAttributionNotes": "Cite Software Heritage, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important source-code preservation and provenance infrastructure.",
    "limitationsCautions": "Use for provenance and research with licensing/PII caution, not broad scraping by default.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "gh-archive",
    "name": "GH Archive",
    "officialUrl": "https://www.gharchive.org/",
    "organization": "GH Archive",
    "category": "Code Datasets",
    "sourceType": "Code ecosystem event archive",
    "bestFor": "Public GitHub event streams and ecosystem analysis.",
    "primaryTopics": [
      "GitHub",
      "events",
      "software ecosystem",
      "metadata"
    ],
    "usefulFor": [
      "code research",
      "time-series modeling",
      "benchmarking",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "GitHub event data is metadata; linked code retains its own licenses.",
    "privacyEthicsWarnings": "Event streams include public user/activity metadata.",
    "citationAttributionNotes": "Cite GH Archive, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good for ecosystem analysis and software activity research.",
    "limitationsCautions": "Not a clean code-training source; do not confuse events with licensed code reuse.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "bigcode",
    "name": "BigCode",
    "officialUrl": "https://www.bigcode-project.org/",
    "organization": "BigCode",
    "category": "Code Datasets",
    "sourceType": "AI/code research project",
    "bestFor": "Open code-LLM research, dataset documentation, and responsible AI/code tooling.",
    "primaryTopics": [
      "code models",
      "LLM",
      "AI research",
      "licensing",
      "opt-out"
    ],
    "usefulFor": [
      "code research",
      "benchmarking",
      "fine-tuning",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Project datasets and models have specific licenses, opt-out, and governance notes.",
    "privacyEthicsWarnings": "Code datasets can include personal data and licensing conflicts.",
    "citationAttributionNotes": "Cite BigCode, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful reference for responsible code-data practices and code-LM research.",
    "limitationsCautions": "Display licensing, opt-out, PII, and version warnings clearly.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "the-stack",
    "name": "The Stack",
    "officialUrl": "https://huggingface.co/datasets/bigcode/the-stack",
    "organization": "The Stack",
    "category": "Code Datasets",
    "sourceType": "Code dataset",
    "bestFor": "Large code dataset for code-language-model research.",
    "primaryTopics": [
      "code dataset",
      "LLM",
      "programming",
      "machine learning"
    ],
    "usefulFor": [
      "code research",
      "fine-tuning",
      "benchmarking",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset license, allowed use, opt-out/versioning details, and individual code licenses must be reviewed.",
    "privacyEthicsWarnings": "May contain personal data or code artifacts with sensitive context.",
    "citationAttributionNotes": "Cite The Stack, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important code-LM research dataset, but only with strong warnings.",
    "limitationsCautions": "Not casual beginner source; never imply training-safe without reading documentation.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "the-stack-v2",
    "name": "The Stack v2",
    "officialUrl": "https://huggingface.co/datasets/bigcode/the-stack-v2",
    "organization": "The Stack v2",
    "category": "Code Datasets",
    "sourceType": "Code dataset",
    "bestFor": "Large code dataset for code-language-model research.",
    "primaryTopics": [
      "code dataset",
      "LLM",
      "programming",
      "machine learning"
    ],
    "usefulFor": [
      "code research",
      "fine-tuning",
      "benchmarking",
      "high caution"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Dataset license, provenance, opt-out, and individual repository licenses require careful review.",
    "privacyEthicsWarnings": "Can include public author metadata, comments, and possible personal data.",
    "citationAttributionNotes": "Cite The Stack v2, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Relevant code-LM research dataset requiring high-caution handling.",
    "limitationsCautions": "Do not frame as casual training data. Licensing and opt-out details must be visible.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "common-crawl",
    "name": "Common Crawl",
    "officialUrl": "https://commoncrawl.org/",
    "organization": "Common Crawl",
    "category": "Code Datasets",
    "sourceType": "Web-scale corpus",
    "bestFor": "Web-scale crawl corpus.",
    "primaryTopics": [
      "web crawl",
      "corpus",
      "NLP",
      "large-scale data"
    ],
    "usefulFor": [
      "RAG",
      "fine-tuning",
      "benchmarking",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Crawl data contains pages with many underlying copyrights and terms; legal status varies by use.",
    "privacyEthicsWarnings": "Very high caution: web data may contain personal, copyrighted, sensitive, or unwanted content.",
    "citationAttributionNotes": "Cite Common Crawl, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major web-corpus reference and high-caution example.",
    "limitationsCautions": "Not a casual training recommendation; requires legal, privacy, filtering, and ethics review.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pypi",
    "name": "PyPI",
    "officialUrl": "https://pypi.org/",
    "organization": "PyPI",
    "category": "Code Datasets",
    "sourceType": "Package registry",
    "bestFor": "Python package metadata and code distribution.",
    "primaryTopics": [
      "Python",
      "packages",
      "software",
      "metadata",
      "code"
    ],
    "usefulFor": [
      "code research",
      "RAG",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Licenses vary by package. Package availability does not grant training or redistribution rights.",
    "privacyEthicsWarnings": "Packages can include author metadata, supply-chain risks, and embedded files.",
    "citationAttributionNotes": "Cite PyPI, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core Python ecosystem registry for package discovery and metadata.",
    "limitationsCautions": "Use packages under their licenses and watch for supply-chain risk.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Sensitive human data",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "npm-registry",
    "name": "npm Registry",
    "officialUrl": "https://www.npmjs.com/",
    "organization": "npm Registry",
    "category": "Code Datasets",
    "sourceType": "Package registry",
    "bestFor": "JavaScript package metadata and code distribution.",
    "primaryTopics": [
      "JavaScript",
      "packages",
      "npm",
      "software",
      "metadata"
    ],
    "usefulFor": [
      "code research",
      "RAG",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Licenses vary by package.",
    "privacyEthicsWarnings": "Packages can contain author metadata and supply-chain risk.",
    "citationAttributionNotes": "Cite npm Registry, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core JavaScript ecosystem registry.",
    "limitationsCautions": "License and supply-chain risks vary widely.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Sensitive human data",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "cran",
    "name": "CRAN",
    "officialUrl": "https://cran.r-project.org/",
    "organization": "CRAN",
    "category": "Code Datasets",
    "sourceType": "Package registry",
    "bestFor": "R packages, documentation, metadata, and source distribution.",
    "primaryTopics": [
      "R",
      "packages",
      "statistics",
      "software",
      "metadata"
    ],
    "usefulFor": [
      "code research",
      "science/reference",
      "RAG"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Varies",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Licenses vary by package; CRAN packages include license metadata.",
    "privacyEthicsWarnings": "Mostly software packages; author metadata and code-license concerns apply.",
    "citationAttributionNotes": "Cite CRAN, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core R ecosystem package registry.",
    "limitationsCautions": "Better curated than some registries, but still license-specific.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Attribution required"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "github",
    "name": "GitHub",
    "officialUrl": "https://github.com/",
    "organization": "GitHub",
    "category": "Code Datasets",
    "sourceType": "Repository hosting",
    "bestFor": "Repository hosting, issue tracking, releases, and public code metadata.",
    "primaryTopics": [
      "code hosting",
      "git",
      "repositories",
      "software",
      "open source"
    ],
    "usefulFor": [
      "code research",
      "RAG",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Public repository availability does not mean code is licensed for training or reuse.",
    "privacyEthicsWarnings": "Public repos can include personal data, secrets, issues, comments, and author metadata.",
    "citationAttributionNotes": "Cite GitHub, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major source of software projects and metadata.",
    "limitationsCautions": "Always check repository license, history, issues, and terms; do not treat public as training-safe.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "gitlab",
    "name": "GitLab",
    "officialUrl": "https://gitlab.com/",
    "organization": "GitLab",
    "category": "Code Datasets",
    "sourceType": "Repository hosting",
    "bestFor": "Repository hosting, DevOps, issues, releases, and public code metadata.",
    "primaryTopics": [
      "code hosting",
      "git",
      "repositories",
      "software",
      "open source"
    ],
    "usefulFor": [
      "code research",
      "RAG",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Repository licenses vary. Public visibility is not reuse permission.",
    "privacyEthicsWarnings": "Public projects can include personal data and development history.",
    "citationAttributionNotes": "Cite GitLab, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major repository hosting and project-management platform.",
    "limitationsCautions": "Check licenses, terms, and project context before reuse or training.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "codeberg",
    "name": "Codeberg",
    "officialUrl": "https://codeberg.org/",
    "organization": "Codeberg",
    "category": "Code Datasets",
    "sourceType": "Repository hosting",
    "bestFor": "Nonprofit-oriented repository hosting and public code projects.",
    "primaryTopics": [
      "code hosting",
      "git",
      "repositories",
      "open source"
    ],
    "usefulFor": [
      "code research",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Varies",
    "licenseReuseNotes": "Repository licenses vary.",
    "privacyEthicsWarnings": "Public projects can include author metadata and issue history.",
    "citationAttributionNotes": "Cite Codeberg, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful open-source hosting alternative.",
    "limitationsCautions": "Public does not automatically mean training-safe.",
    "riskLabels": [
      "Licensing/training caution",
      "Dataset-specific license",
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "forgejo",
    "name": "Forgejo",
    "officialUrl": "https://forgejo.org/",
    "organization": "Forgejo",
    "category": "Elysia Technical Foundations",
    "sourceType": "Open-source tool",
    "bestFor": "Self-hostable Git forge software and federated software development infrastructure.",
    "primaryTopics": [
      "git forge",
      "self-hosting",
      "software development",
      "open source"
    ],
    "usefulFor": [
      "local AI",
      "code research",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Forgejo software has its own open-source license; hosted repositories still have project-specific licenses.",
    "privacyEthicsWarnings": "Self-hosting can reduce cloud exposure if configured carefully.",
    "citationAttributionNotes": "Cite Forgejo, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Relevant to Elysia’s developer forge and local-first software stewardship.",
    "limitationsCautions": "Running a forge requires security, backup, and moderation planning.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "stack-exchange-data-dump",
    "name": "Stack Exchange Data Dump",
    "officialUrl": "https://archive.org/details/stackexchange",
    "organization": "Stack Exchange Data Dump",
    "category": "Code Datasets",
    "sourceType": "Community knowledge archive",
    "bestFor": "Stack Exchange Q&A text and code snippets.",
    "primaryTopics": [
      "Q&A",
      "technical knowledge",
      "Stack Exchange",
      "archive",
      "code snippets"
    ],
    "usefulFor": [
      "RAG",
      "code research",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Stack Exchange content is generally CC BY-SA; attribution and share-alike obligations apply.",
    "privacyEthicsWarnings": "May include public user content, names, comments, and personal details.",
    "citationAttributionNotes": "Cite Stack Exchange Data Dump, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major technical/community knowledge corpus.",
    "limitationsCautions": "License obligations and personal-data concerns are significant.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Attribution required",
      "Share-alike possible"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "stack-overflow",
    "name": "Stack Overflow",
    "officialUrl": "https://stackoverflow.com/",
    "organization": "Stack Overflow",
    "category": "Code Datasets",
    "sourceType": "Community knowledge site",
    "bestFor": "Technical programming Q&A.",
    "primaryTopics": [
      "programming",
      "Q&A",
      "code snippets",
      "technical knowledge"
    ],
    "usefulFor": [
      "RAG",
      "code research",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Content licenses require attribution and may have share-alike obligations.",
    "privacyEthicsWarnings": "Public user content and profiles may be included.",
    "citationAttributionNotes": "Cite Stack Overflow, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Key technical Q&A source for programming and troubleshooting.",
    "limitationsCautions": "Do not copy or train without understanding license obligations.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Attribution required",
      "Share-alike possible"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "stack-exchange",
    "name": "Stack Exchange",
    "officialUrl": "https://stackexchange.com/",
    "organization": "Stack Exchange",
    "category": "Code Datasets",
    "sourceType": "Community knowledge network",
    "bestFor": "Network of community Q&A sites across technical and nontechnical topics.",
    "primaryTopics": [
      "Q&A",
      "community knowledge",
      "technical knowledge",
      "public content"
    ],
    "usefulFor": [
      "RAG",
      "science/reference",
      "code research",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Content licenses generally require attribution and may include share-alike terms.",
    "privacyEthicsWarnings": "Public user content and identities may be included.",
    "citationAttributionNotes": "Cite Stack Exchange, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Broad community knowledge source.",
    "limitationsCautions": "Licensing and quality vary by site/question/answer.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Attribution required",
      "Share-alike possible"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "wikipedia-dumps",
    "name": "Wikipedia Dumps",
    "officialUrl": "https://dumps.wikimedia.org/",
    "organization": "Wikipedia Dumps",
    "category": "Code Datasets",
    "sourceType": "Knowledge corpus",
    "bestFor": "Wikipedia dump files and Wikimedia project exports.",
    "primaryTopics": [
      "Wikipedia",
      "encyclopedia",
      "corpus",
      "open knowledge"
    ],
    "usefulFor": [
      "RAG",
      "fine-tuning",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Wikipedia text is CC BY-SA; attribution and share-alike obligations apply.",
    "privacyEthicsWarnings": "May include biographies and public personal information.",
    "citationAttributionNotes": "Cite Wikipedia Dumps, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Major open knowledge corpus and reference source.",
    "limitationsCautions": "Training/reuse must respect attribution/share-alike; content quality varies by article.",
    "riskLabels": [
      "Licensing/training caution",
      "Attribution required",
      "Share-alike possible",
      "Sensitive human data"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "wikimedia-commons",
    "name": "Wikimedia Commons",
    "officialUrl": "https://commons.wikimedia.org/",
    "organization": "Wikimedia Commons",
    "category": "Code Datasets",
    "sourceType": "Open media repository",
    "bestFor": "Free media files, images, audio, video, and metadata.",
    "primaryTopics": [
      "media",
      "images",
      "audio",
      "video",
      "open knowledge"
    ],
    "usefulFor": [
      "RAG",
      "computer vision",
      "science/reference",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Licenses vary by file; many require attribution and some share-alike.",
    "privacyEthicsWarnings": "Media may include identifiable people, places, or cultural materials.",
    "citationAttributionNotes": "Cite Wikimedia Commons, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Large open media source with detailed licensing.",
    "limitationsCautions": "Check license for every file; Commons is not one uniform license.",
    "riskLabels": [
      "Licensing/training caution",
      "Sensitive human data",
      "Attribution required",
      "Share-alike possible",
      "Dataset-specific license",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "ollama",
    "name": "Ollama",
    "officialUrl": "https://ollama.com/",
    "organization": "Ollama",
    "category": "Local AI Tools",
    "sourceType": "Open-source tool",
    "bestFor": "Local model runtime for running and serving LLMs.",
    "primaryTopics": [
      "local AI",
      "LLM",
      "model runtime",
      "privacy",
      "developer tools"
    ],
    "usefulFor": [
      "local AI",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Ollama software and each model pulled through it have separate licenses.",
    "privacyEthicsWarnings": "Local runtime can keep prompts local, but model downloads and registries may involve network access.",
    "citationAttributionNotes": "Cite Ollama, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core local-first tool for Elysia-style private AI systems.",
    "limitationsCautions": "Model licenses vary; local runtime does not make every model unrestricted.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "open-webui",
    "name": "Open WebUI",
    "officialUrl": "https://openwebui.com/",
    "organization": "Open WebUI",
    "category": "Local AI Tools",
    "sourceType": "Open-source tool",
    "bestFor": "Self-hosted interface for local/private model workflows.",
    "primaryTopics": [
      "local AI",
      "self-hosting",
      "UI",
      "LLM"
    ],
    "usefulFor": [
      "local AI",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Software license and plugin/model integrations should be checked.",
    "privacyEthicsWarnings": "Self-hosting can be private if configured correctly; integrations may change boundary.",
    "citationAttributionNotes": "Cite Open WebUI, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good local/private model interface and prototyping tool.",
    "limitationsCautions": "Do not let UI integrations bypass local privacy doctrine.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "postgresql-full-text-search",
    "name": "PostgreSQL Full Text Search",
    "officialUrl": "https://www.postgresql.org/docs/current/textsearch.html",
    "organization": "PostgreSQL Full Text Search",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Lexical search, ranking, dictionaries, and highlighting in PostgreSQL.",
    "primaryTopics": [
      "search",
      "PostgreSQL",
      "full text",
      "database",
      "local AI"
    ],
    "usefulFor": [
      "local AI",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "PostgreSQL documentation/software licensing applies.",
    "privacyEthicsWarnings": "Local database search can stay private if self-hosted.",
    "citationAttributionNotes": "Cite PostgreSQL Full Text Search, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Strong metadata-first search foundation for public catalogs and local systems.",
    "limitationsCautions": "Lexical search complements but does not replace semantic search.",
    "riskLabels": [],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pgvector",
    "name": "pgvector",
    "officialUrl": "https://github.com/pgvector/pgvector",
    "organization": "pgvector",
    "category": "Elysia Technical Foundations",
    "sourceType": "Open-source tool",
    "bestFor": "Vector search in PostgreSQL.",
    "primaryTopics": [
      "vector search",
      "PostgreSQL",
      "embeddings",
      "RAG"
    ],
    "usefulFor": [
      "local AI",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "pgvector open-source license applies.",
    "privacyEthicsWarnings": "Can run locally; cloud-hosted Postgres changes privacy boundary.",
    "citationAttributionNotes": "Cite pgvector, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good semantic search layer for local and public-site retrieval systems.",
    "limitationsCautions": "Embedding model choice and data storage still require privacy discipline.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "supabase-vector-columns",
    "name": "Supabase Vector Columns",
    "officialUrl": "https://supabase.com/docs/guides/ai/vector-columns",
    "organization": "Supabase Vector Columns",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "pgvector-backed vector search in Supabase.",
    "primaryTopics": [
      "Supabase",
      "vector search",
      "pgvector",
      "RAG",
      "cloud"
    ],
    "usefulFor": [
      "RAG",
      "local AI",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Supabase terms and pgvector behavior apply.",
    "privacyEthicsWarnings": "Cloud database service. Do not use for private Elysia memory by default.",
    "citationAttributionNotes": "Cite Supabase Vector Columns, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for public website search and metadata retrieval, not private core memory.",
    "limitationsCautions": "Keep public-site vectors separate from private Elysia vectors.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "supabase-rls",
    "name": "Supabase RLS",
    "officialUrl": "https://supabase.com/docs/guides/database/postgres/row-level-security",
    "organization": "Supabase RLS",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Row-level security and user authorization in Supabase/Postgres.",
    "primaryTopics": [
      "Supabase",
      "RLS",
      "authorization",
      "database security"
    ],
    "usefulFor": [
      "local AI",
      "software trust",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Supabase terms apply.",
    "privacyEthicsWarnings": "Security-sensitive cloud configuration. Misconfigured RLS can expose data.",
    "citationAttributionNotes": "Cite Supabase RLS, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Critical for public accounts, marketplace, community, and library features.",
    "limitationsCautions": "RLS is not optional for user/account data.",
    "riskLabels": [
      "Cloud/account/token caution",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "supabase-storage",
    "name": "Supabase Storage",
    "officialUrl": "https://supabase.com/docs/guides/storage",
    "organization": "Supabase Storage",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Cloud file storage, buckets, policies, and asset hosting.",
    "primaryTopics": [
      "Supabase",
      "storage",
      "uploads",
      "buckets",
      "cloud"
    ],
    "usefulFor": [
      "local AI",
      "software trust",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Supabase terms and bucket policy rules apply.",
    "privacyEthicsWarnings": "Cloud storage. Never store private Elysia memory or secrets here by default.",
    "citationAttributionNotes": "Cite Supabase Storage, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for public site media, add-on assets, and carefully governed uploads.",
    "limitationsCautions": "Bucket policies must be explicit; public/private confusion is dangerous.",
    "riskLabels": [
      "Cloud/account/token caution",
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "cloudflare-r2",
    "name": "Cloudflare R2",
    "officialUrl": "https://developers.cloudflare.com/r2/",
    "organization": "Cloudflare R2",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Object storage for release archives, binaries, and large public files.",
    "primaryTopics": [
      "Cloudflare",
      "object storage",
      "release archives",
      "public files"
    ],
    "usefulFor": [
      "release security",
      "software trust",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Cloudflare terms and object-specific licenses apply.",
    "privacyEthicsWarnings": "Cloud object storage. Good for public releases, not private memory.",
    "citationAttributionNotes": "Cite Cloudflare R2, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good for downloads and public binary/archive mirrors.",
    "limitationsCautions": "Do not use as private vault or hidden memory mirror.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "cloudflare-queues",
    "name": "Cloudflare Queues",
    "officialUrl": "https://developers.cloudflare.com/queues/",
    "organization": "Cloudflare Queues",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Cloud background job queues.",
    "primaryTopics": [
      "Cloudflare",
      "queues",
      "background jobs",
      "cloud"
    ],
    "usefulFor": [
      "software trust",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Cloudflare terms apply.",
    "privacyEthicsWarnings": "Cloud job metadata leaves local control.",
    "citationAttributionNotes": "Cite Cloudflare Queues, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for public-site metadata refresh, moderation tasks, and async workflows.",
    "limitationsCautions": "Do not queue private Elysia memory or secrets.",
    "riskLabels": [
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "cloudflare-durable-objects",
    "name": "Cloudflare Durable Objects",
    "officialUrl": "https://developers.cloudflare.com/durable-objects/",
    "organization": "Cloudflare Durable Objects",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Stateful serverless coordination and realtime collaboration state.",
    "primaryTopics": [
      "Cloudflare",
      "stateful serverless",
      "realtime",
      "collaboration"
    ],
    "usefulFor": [
      "software trust",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Cloudflare terms apply.",
    "privacyEthicsWarnings": "Cloud state. Keep public collaboration separate from private core.",
    "citationAttributionNotes": "Cite Cloudflare Durable Objects, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for future Commune realtime features.",
    "limitationsCautions": "Should not hold private Elysia identity or memory by default.",
    "riskLabels": [
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "cloudflare-turnstile",
    "name": "Cloudflare Turnstile",
    "officialUrl": "https://developers.cloudflare.com/turnstile/",
    "organization": "Cloudflare Turnstile",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Anti-bot form protection.",
    "primaryTopics": [
      "Cloudflare",
      "anti-bot",
      "forms",
      "security"
    ],
    "usefulFor": [
      "software trust",
      "science/reference"
    ],
    "signupRequired": "Yes",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Cloudflare terms apply.",
    "privacyEthicsWarnings": "External verification service; server-side validation is required.",
    "citationAttributionNotes": "Cite Cloudflare Turnstile, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Useful for public suggestions, forms, and spam resistance.",
    "limitationsCautions": "Do not treat as sole abuse control.",
    "riskLabels": [
      "Cloud/account/token caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "fastapi",
    "name": "FastAPI",
    "officialUrl": "https://fastapi.tiangolo.com/",
    "organization": "FastAPI",
    "category": "Elysia Technical Foundations",
    "sourceType": "Open-source tool",
    "bestFor": "Python API framework for docs-first services and typed APIs.",
    "primaryTopics": [
      "Python",
      "API",
      "backend",
      "documentation",
      "services"
    ],
    "usefulFor": [
      "local AI",
      "software trust",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "FastAPI open-source license applies.",
    "privacyEthicsWarnings": "Can run locally; cloud deployment changes boundary.",
    "citationAttributionNotes": "Cite FastAPI, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good local/API service layer for Elysia systems.",
    "limitationsCautions": "Security depends on deployment and endpoint design.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "tauri",
    "name": "Tauri",
    "officialUrl": "https://tauri.app/",
    "organization": "Tauri",
    "category": "Elysia Technical Foundations",
    "sourceType": "Open-source tool",
    "bestFor": "Desktop app shell and distribution framework.",
    "primaryTopics": [
      "desktop",
      "Rust",
      "webview",
      "app shell",
      "distribution"
    ],
    "usefulFor": [
      "local AI",
      "software trust",
      "release security",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Tauri software license and plugin licenses apply.",
    "privacyEthicsWarnings": "Local desktop shell can support local-first design if permissions are narrow.",
    "citationAttributionNotes": "Cite Tauri, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Relevant for Elysia desktop app distribution.",
    "limitationsCautions": "Native capabilities must be permission-gated.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "docker-security-docs",
    "name": "Docker security docs",
    "officialUrl": "https://docs.docker.com/engine/security/",
    "organization": "Docker security docs",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Container threat model, daemon risk, rootless mode, and Docker hardening guidance.",
    "primaryTopics": [
      "Docker",
      "containers",
      "security",
      "sandboxing"
    ],
    "usefulFor": [
      "software trust",
      "local AI",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Docker documentation terms apply.",
    "privacyEthicsWarnings": "Local container security is configuration-dependent.",
    "citationAttributionNotes": "Cite Docker security docs, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important for sandboxing risky work.",
    "limitationsCautions": "Containers are not magic isolation. Docker socket exposure is dangerous.",
    "riskLabels": [
      "High caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "apparmor",
    "name": "AppArmor",
    "officialUrl": "https://ubuntu.com/server/docs/security-apparmor",
    "organization": "AppArmor",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Linux mandatory access control and application confinement.",
    "primaryTopics": [
      "Linux",
      "security",
      "AppArmor",
      "sandboxing",
      "Ubuntu"
    ],
    "usefulFor": [
      "software trust",
      "local AI",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Ubuntu documentation terms apply.",
    "privacyEthicsWarnings": "Local confinement improves privacy and damage control.",
    "citationAttributionNotes": "Cite AppArmor, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good local hardening layer for Elysia workers.",
    "limitationsCautions": "Profiles must be tested; misconfiguration can break or under-protect services.",
    "riskLabels": [],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "the-update-framework--tuf",
    "name": "The Update Framework / TUF",
    "officialUrl": "https://theupdateframework.io/",
    "organization": "The Update Framework",
    "category": "Elysia Technical Foundations",
    "sourceType": "Security/trust framework",
    "bestFor": "Secure update system design and supply-chain compromise resistance.",
    "primaryTopics": [
      "secure updates",
      "supply chain",
      "software trust",
      "signing"
    ],
    "usefulFor": [
      "software trust",
      "release security",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "TUF project/docs licenses apply.",
    "privacyEthicsWarnings": "Low personal-data concern.",
    "citationAttributionNotes": "Cite The Update Framework / TUF, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Very relevant for Elysia release integrity and update trust.",
    "limitationsCautions": "Requires careful implementation and key management.",
    "riskLabels": [],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "sigstore-cosign",
    "name": "Sigstore Cosign",
    "officialUrl": "https://docs.sigstore.dev/cosign/overview/",
    "organization": "Sigstore Cosign",
    "category": "Elysia Technical Foundations",
    "sourceType": "Security/trust framework",
    "bestFor": "Artifact signing and verification with Cosign/Sigstore.",
    "primaryTopics": [
      "signing",
      "artifacts",
      "supply chain",
      "release security"
    ],
    "usefulFor": [
      "software trust",
      "release security",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Sigstore/Cosign project licenses and service terms apply.",
    "privacyEthicsWarnings": "Keyless signing and transparency logs can publish identity/build metadata.",
    "citationAttributionNotes": "Cite Sigstore Cosign, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good for signed releases, packages, and artifact verification.",
    "limitationsCautions": "Transparency and identity model should be understood before use.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "tauri-updater-docs",
    "name": "Tauri updater docs",
    "officialUrl": "https://v2.tauri.app/plugin/updater/",
    "organization": "Tauri updater docs",
    "category": "Elysia Technical Foundations",
    "sourceType": "Documentation",
    "bestFor": "Desktop update signing and updater behavior for Tauri apps.",
    "primaryTopics": [
      "Tauri",
      "updates",
      "desktop",
      "signing",
      "release security"
    ],
    "usefulFor": [
      "software trust",
      "release security",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Tauri documentation and plugin license terms apply.",
    "privacyEthicsWarnings": "Updater endpoint design can expose app/version metadata.",
    "citationAttributionNotes": "Cite Tauri updater docs, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Important because updater signatures and channels matter for Elysia releases.",
    "limitationsCautions": "Do not ship auto-update without strong signing, rollback, and release policy.",
    "riskLabels": [
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "creative-commons",
    "name": "Creative Commons",
    "officialUrl": "https://creativecommons.org/",
    "organization": "Creative Commons",
    "category": "Dataset Ethics & Licensing",
    "sourceType": "Licensing/ethics resource",
    "bestFor": "License education, open licensing, attribution, share-alike, and reuse rules.",
    "primaryTopics": [
      "licensing",
      "open knowledge",
      "attribution",
      "share-alike",
      "copyright"
    ],
    "usefulFor": [
      "data ethics",
      "science/reference",
      "RAG"
    ],
    "signupRequired": "No",
    "cloudRequired": "No",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Creative Commons provides license frameworks; each work still has its own selected license.",
    "privacyEthicsWarnings": "Low personal-data concern.",
    "citationAttributionNotes": "Cite Creative Commons, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Core licensing literacy source for the Living Library.",
    "limitationsCautions": "CC licenses are not interchangeable; attribution and share-alike details matter.",
    "riskLabels": [
      "Attribution required",
      "Share-alike possible",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "hugging-face-dataset-cards",
    "name": "Hugging Face Dataset Cards",
    "officialUrl": "https://huggingface.co/docs/hub/datasets-cards",
    "organization": "Hugging Face Dataset Cards",
    "category": "Dataset Ethics & Licensing",
    "sourceType": "Documentation",
    "bestFor": "Dataset metadata, documentation practices, and dataset-card guidance.",
    "primaryTopics": [
      "dataset cards",
      "metadata",
      "AI datasets",
      "documentation"
    ],
    "usefulFor": [
      "data ethics",
      "RAG",
      "science/reference"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Documentation guidance only; dataset licenses remain dataset-specific.",
    "privacyEthicsWarnings": "Dataset cards can surface privacy, bias, and intended-use notes.",
    "citationAttributionNotes": "Cite Hugging Face Dataset Cards, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good model for dataset metadata and responsible description.",
    "limitationsCautions": "A dataset card is helpful, but not a legal audit.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "software-heritage-legal--policy-area",
    "name": "Software Heritage legal / policy area",
    "officialUrl": "https://www.softwareheritage.org/legal/",
    "organization": "Software Heritage legal",
    "category": "Dataset Ethics & Licensing",
    "sourceType": "Licensing/ethics resource",
    "bestFor": "Legal and policy information for source-code preservation.",
    "primaryTopics": [
      "software heritage",
      "legal",
      "code archive",
      "policy"
    ],
    "usefulFor": [
      "data ethics",
      "code research",
      "software trust"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Explains policies but does not override original code licenses.",
    "privacyEthicsWarnings": "Code archives can include personal data and historical metadata.",
    "citationAttributionNotes": "Cite Software Heritage legal / policy area, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good caution around code archives and personal-data/licensing complexity.",
    "limitationsCautions": "Preservation does not equal unrestricted training permission.",
    "riskLabels": [
      "Licensing/training caution",
      "Sensitive human data",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "bigcode-documentation",
    "name": "BigCode documentation",
    "officialUrl": "https://www.bigcode-project.org/docs/",
    "organization": "BigCode documentation",
    "category": "Dataset Ethics & Licensing",
    "sourceType": "Documentation",
    "bestFor": "Code dataset documentation, governance, licensing, opt-out, and responsible AI/code practices.",
    "primaryTopics": [
      "code datasets",
      "LLM",
      "licensing",
      "opt-out",
      "documentation"
    ],
    "usefulFor": [
      "data ethics",
      "code research",
      "software trust",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Project documentation; dataset/model terms still need item-level checking.",
    "privacyEthicsWarnings": "Code datasets may include PII and author metadata.",
    "citationAttributionNotes": "Cite BigCode documentation, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good cautionary documentation for code training and opt-out issues.",
    "limitationsCautions": "Use as education, not blanket permission.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "common-crawl-documentation",
    "name": "Common Crawl documentation",
    "officialUrl": "https://commoncrawl.org/documentation/",
    "organization": "Common Crawl documentation",
    "category": "Dataset Ethics & Licensing",
    "sourceType": "Documentation",
    "bestFor": "Documentation for Common Crawl web corpus access and structure.",
    "primaryTopics": [
      "web corpus",
      "documentation",
      "large-scale data",
      "web crawl"
    ],
    "usefulFor": [
      "data ethics",
      "RAG",
      "fine-tuning",
      "high caution"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "Yes",
    "licenseReuseNotes": "Documentation does not resolve underlying webpage copyright/privacy terms.",
    "privacyEthicsWarnings": "Web-scale corpus can contain personal, copyrighted, or sensitive content.",
    "citationAttributionNotes": "Cite Common Crawl documentation, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good high-caution web-corpus example.",
    "limitationsCautions": "Do not frame as training-safe without legal/ethical filtering.",
    "riskLabels": [
      "High caution",
      "Licensing/training caution",
      "Sensitive human data",
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "sigstore",
    "name": "Sigstore",
    "officialUrl": "https://www.sigstore.dev/",
    "organization": "Sigstore",
    "category": "Dataset Ethics & Licensing",
    "sourceType": "Security/trust framework",
    "bestFor": "Software signing, transparency, and supply-chain integrity ecosystem.",
    "primaryTopics": [
      "signing",
      "supply chain",
      "transparency",
      "software trust"
    ],
    "usefulFor": [
      "software trust",
      "release security",
      "science/reference"
    ],
    "signupRequired": "Sometimes",
    "cloudRequired": "Optional",
    "apiAvailable": "Yes",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Sigstore project and service terms apply.",
    "privacyEthicsWarnings": "Transparency logs can expose metadata depending on workflow.",
    "citationAttributionNotes": "Cite Sigstore, the official URL, dataset title/version when available, and access date.",
    "whyItBelongs": "Good software trust and artifact integrity source.",
    "limitationsCautions": "Understand identity/transparency tradeoffs before use.",
    "riskLabels": [
      "Cloud/account/token caution",
      "Dataset-specific license"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "rainforest-trust",
    "name": "Rainforest Trust",
    "officialUrl": "https://www.rainforesttrust.org/",
    "organization": "Rainforest Trust",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "land protection and biodiversity conservation.",
    "primaryTopics": [
      "conservation",
      "biodiversity",
      "land protection"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Rainforest Trust by name with its official URL and access date.",
    "whyItBelongs": "Rainforest Trust belongs as a stewardship reference because it is relevant to land protection and biodiversity conservation.",
    "limitationsCautions": "Strong candidate, but still verify current campaigns, finances, and program details.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "amazon-conservation-team",
    "name": "Amazon Conservation Team",
    "officialUrl": "https://www.amazonteam.org/",
    "organization": "Amazon Conservation Team",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "conservation with Indigenous and local community partnership.",
    "primaryTopics": [
      "Amazon",
      "Indigenous communities",
      "conservation"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Amazon Conservation Team by name with its official URL and access date.",
    "whyItBelongs": "Amazon Conservation Team belongs as a stewardship reference because it is relevant to conservation with indigenous and local community partnership.",
    "limitationsCautions": "Strong candidate; verify current status, programs, and community-partnership framing.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "coral-reef-alliance",
    "name": "Coral Reef Alliance",
    "officialUrl": "https://coral.org/",
    "organization": "Coral Reef Alliance",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "reef resilience and marine conservation.",
    "primaryTopics": [
      "coral reefs",
      "marine conservation",
      "climate resilience"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Coral Reef Alliance by name with its official URL and access date.",
    "whyItBelongs": "Coral Reef Alliance belongs as a stewardship reference because it is relevant to reef resilience and marine conservation.",
    "limitationsCautions": "Good marine slot; verify current programs and regions.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "world-wildlife-fund",
    "name": "World Wildlife Fund",
    "officialUrl": "https://www.worldwildlife.org/",
    "organization": "World Wildlife Fund",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "global conservation.",
    "primaryTopics": [
      "conservation",
      "wildlife",
      "global environment"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference World Wildlife Fund by name with its official URL and access date.",
    "whyItBelongs": "World Wildlife Fund belongs as a stewardship reference because it is relevant to global conservation.",
    "limitationsCautions": "Large institutional brand; verify fit, overhead, controversies, and current concerns.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "sierra-club-foundation",
    "name": "Sierra Club Foundation",
    "officialUrl": "https://www.sierraclubfoundation.org/",
    "organization": "Sierra Club Foundation",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "environmental advocacy support.",
    "primaryTopics": [
      "environmental advocacy",
      "climate",
      "conservation"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Sierra Club Foundation by name with its official URL and access date.",
    "whyItBelongs": "Sierra Club Foundation belongs as a stewardship reference because it is relevant to environmental advocacy support.",
    "limitationsCautions": "Advocacy-coded. Use neutral wording and no implied nonpartisan consensus.",
    "riskLabels": [
      "Advocacy/positioning caution",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "nrdc",
    "name": "NRDC",
    "officialUrl": "https://www.nrdc.org/",
    "organization": "NRDC",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "environmental law, policy, and advocacy.",
    "primaryTopics": [
      "environmental law",
      "policy",
      "advocacy",
      "climate"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference NRDC by name with its official URL and access date.",
    "whyItBelongs": "NRDC belongs as a stewardship reference because it is relevant to environmental law, policy, and advocacy.",
    "limitationsCautions": "Advocacy-heavy. Useful, but present neutrally.",
    "riskLabels": [
      "Advocacy/positioning caution",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "earthjustice",
    "name": "Earthjustice",
    "officialUrl": "https://earthjustice.org/",
    "organization": "Earthjustice",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "environmental law and litigation.",
    "primaryTopics": [
      "environmental law",
      "litigation",
      "policy"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Earthjustice by name with its official URL and access date.",
    "whyItBelongs": "Earthjustice belongs as a stewardship reference because it is relevant to environmental law and litigation.",
    "limitationsCautions": "Legal/advocacy organization, not direct-service charity.",
    "riskLabels": [
      "Advocacy/positioning caution",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "eesi",
    "name": "EESI",
    "officialUrl": "https://www.eesi.org/",
    "organization": "EESI",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "climate and energy policy education.",
    "primaryTopics": [
      "climate",
      "energy",
      "policy education"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference EESI by name with its official URL and access date.",
    "whyItBelongs": "EESI belongs as a stewardship reference because it is relevant to climate and energy policy education.",
    "limitationsCautions": "Knowledge/policy education org, not direct service.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "digdeep-right-to-water-project",
    "name": "DIGDEEP Right to Water Project",
    "officialUrl": "https://www.digdeep.org/",
    "organization": "DIGDEEP Right to Water Project",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "U.S. water access and the Navajo Water Project.",
    "primaryTopics": [
      "water access",
      "environmental justice",
      "Navajo water"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference DIGDEEP Right to Water Project by name with its official URL and access date.",
    "whyItBelongs": "DIGDEEP Right to Water Project belongs as a stewardship reference because it is relevant to u.s. water access and the navajo water project.",
    "limitationsCautions": "Very aligned; verify current project details and donation flow.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "pure-earth",
    "name": "Pure Earth",
    "officialUrl": "https://www.pureearth.org/",
    "organization": "Pure Earth",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "toxic pollution and lead exposure reduction.",
    "primaryTopics": [
      "pollution",
      "lead",
      "toxic exposure",
      "public health"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Pure Earth by name with its official URL and access date.",
    "whyItBelongs": "Pure Earth belongs as a stewardship reference because it is relevant to toxic pollution and lead exposure reduction.",
    "limitationsCautions": "Very aligned; verify current program details.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "wateraid-america",
    "name": "WaterAid America",
    "officialUrl": "https://www.wateraid.org/us/",
    "organization": "WaterAid America",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "water, sanitation, and hygiene.",
    "primaryTopics": [
      "water",
      "sanitation",
      "hygiene",
      "global development"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference WaterAid America by name with its official URL and access date.",
    "whyItBelongs": "WaterAid America belongs as a stewardship reference because it is relevant to water, sanitation, and hygiene.",
    "limitationsCautions": "Strong water candidate; verify U.S. entity/program details.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "we-act-for-environmental-justice",
    "name": "WE ACT for Environmental Justice",
    "officialUrl": "https://www.weact.org/",
    "organization": "WE ACT for Environmental Justice",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "environmental justice and community organizing.",
    "primaryTopics": [
      "environmental justice",
      "community organizing",
      "pollution"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference WE ACT for Environmental Justice by name with its official URL and access date.",
    "whyItBelongs": "WE ACT for Environmental Justice belongs as a stewardship reference because it is relevant to environmental justice and community organizing.",
    "limitationsCautions": "Advocacy/community organizing. Use careful neutral wording.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "first-nations-development-institute",
    "name": "First Nations Development Institute",
    "officialUrl": "https://www.firstnations.org/",
    "organization": "First Nations Development Institute",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "Native-led community, economic, food systems, and cultural support.",
    "primaryTopics": [
      "Indigenous communities",
      "food systems",
      "economic development"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference First Nations Development Institute by name with its official URL and access date.",
    "whyItBelongs": "First Nations Development Institute belongs as a stewardship reference because it is relevant to native-led community, economic, food systems, and cultural support.",
    "limitationsCautions": "Very strong fit; verify current programs and Native-led framing.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "indspire",
    "name": "Indspire",
    "officialUrl": "https://indspire.ca/",
    "organization": "Indspire",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "Indigenous education in Canada.",
    "primaryTopics": [
      "Indigenous education",
      "Canada",
      "scholarships"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Indspire by name with its official URL and access date.",
    "whyItBelongs": "Indspire belongs as a stewardship reference because it is relevant to indigenous education in canada.",
    "limitationsCautions": "Strong education/stewardship fit; Canada-specific.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "fistula-foundation",
    "name": "Fistula Foundation",
    "officialUrl": "https://fistulafoundation.org/",
    "organization": "Fistula Foundation",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "women’s health and fistula surgery.",
    "primaryTopics": [
      "women's health",
      "surgery",
      "global health"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Fistula Foundation by name with its official URL and access date.",
    "whyItBelongs": "Fistula Foundation belongs as a stewardship reference because it is relevant to women’s health and fistula surgery.",
    "limitationsCautions": "Strong direct-service candidate; verify current ratings and programs.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "every-mother-counts",
    "name": "Every Mother Counts",
    "officialUrl": "https://everymothercounts.org/",
    "organization": "Every Mother Counts",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "maternal health.",
    "primaryTopics": [
      "maternal health",
      "pregnancy",
      "global health"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Every Mother Counts by name with its official URL and access date.",
    "whyItBelongs": "Every Mother Counts belongs as a stewardship reference because it is relevant to maternal health.",
    "limitationsCautions": "Strong nonreligious maternal-health candidate; verify current programs.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "camfed-usa-foundation",
    "name": "CAMFED USA Foundation",
    "officialUrl": "https://camfed.org/us/",
    "organization": "CAMFED USA Foundation",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "girls’ education and young women’s leadership.",
    "primaryTopics": [
      "girls education",
      "women",
      "development"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference CAMFED USA Foundation by name with its official URL and access date.",
    "whyItBelongs": "CAMFED USA Foundation belongs as a stewardship reference because it is relevant to girls’ education and young women’s leadership.",
    "limitationsCautions": "Strong practical development candidate; verify U.S. affiliate info.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "miraclefeet",
    "name": "MiracleFeet",
    "officialUrl": "https://www.miraclefeet.org/",
    "organization": "MiracleFeet",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "clubfoot treatment for children.",
    "primaryTopics": [
      "children's health",
      "clubfoot",
      "global health"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference MiracleFeet by name with its official URL and access date.",
    "whyItBelongs": "MiracleFeet belongs as a stewardship reference because it is relevant to clubfoot treatment for children.",
    "limitationsCautions": "Strong direct-service health candidate; verify current program details.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "family-promise",
    "name": "Family Promise",
    "officialUrl": "https://familypromise.org/",
    "organization": "Family Promise",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "family homelessness prevention, shelter, and stability.",
    "primaryTopics": [
      "family homelessness",
      "housing",
      "children",
      "stability"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Family Promise by name with its official URL and access date.",
    "whyItBelongs": "Family Promise belongs as a stewardship reference because it is relevant to family homelessness prevention, shelter, and stability.",
    "limitationsCautions": "Strong U.S. family-stability candidate; verify local/national structure.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "new-incentives",
    "name": "New Incentives",
    "officialUrl": "https://www.newincentives.org/",
    "organization": "New Incentives",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "childhood vaccination incentives.",
    "primaryTopics": [
      "vaccination",
      "children's health",
      "evidence-minded charity"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference New Incentives by name with its official URL and access date.",
    "whyItBelongs": "New Incentives belongs as a stewardship reference because it is relevant to childhood vaccination incentives.",
    "limitationsCautions": "Strong evidence-minded candidate; verify current evidence and program status.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "women-for-women-international",
    "name": "Women for Women International",
    "officialUrl": "https://www.womenforwomen.org/",
    "organization": "Women for Women International",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "support for women survivors of war.",
    "primaryTopics": [
      "women",
      "war recovery",
      "livelihoods",
      "humanitarian"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Women for Women International by name with its official URL and access date.",
    "whyItBelongs": "Women for Women International belongs as a stewardship reference because it is relevant to support for women survivors of war.",
    "limitationsCautions": "Strong conflict recovery candidate; verify program regions and current status.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "sudanese-american-physicians-association",
    "name": "Sudanese American Physicians Association",
    "officialUrl": "https://sapa-usa.org/",
    "organization": "Sudanese American Physicians Association",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "Sudan medical relief.",
    "primaryTopics": [
      "Sudan",
      "medical relief",
      "humanitarian"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Sudanese American Physicians Association by name with its official URL and access date.",
    "whyItBelongs": "Sudanese American Physicians Association belongs as a stewardship reference because it is relevant to sudan medical relief.",
    "limitationsCautions": "Strong conflict medical-relief candidate; context is politically and humanitarianly sensitive.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "palestine-children-s-relief-fund",
    "name": "Palestine Children’s Relief Fund",
    "officialUrl": "https://www.pcrf.net/",
    "organization": "Palestine Children’s Relief Fund",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "medical and humanitarian aid for children.",
    "primaryTopics": [
      "children",
      "medical relief",
      "Palestine",
      "humanitarian"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Palestine Children’s Relief Fund by name with its official URL and access date.",
    "whyItBelongs": "Palestine Children’s Relief Fund belongs as a stewardship reference because it is relevant to medical and humanitarian aid for children.",
    "limitationsCautions": "Strong direct-service candidate; politically sensitive context requires neutral wording.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "razom-for-ukraine",
    "name": "Razom for Ukraine",
    "officialUrl": "https://www.razomforukraine.org/",
    "organization": "Razom for Ukraine",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "Ukraine relief, health, and emergency support.",
    "primaryTopics": [
      "Ukraine",
      "humanitarian",
      "health",
      "relief"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Razom for Ukraine by name with its official URL and access date.",
    "whyItBelongs": "Razom for Ukraine belongs as a stewardship reference because it is relevant to ukraine relief, health, and emergency support.",
    "limitationsCautions": "Strong but politically visible; use neutral wording.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "halo-trust-usa",
    "name": "HALO Trust USA",
    "officialUrl": "https://www.halousa.org/",
    "organization": "HALO Trust USA",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "mine clearance and unexploded ordnance harm reduction.",
    "primaryTopics": [
      "mine clearance",
      "UXO",
      "conflict recovery",
      "harm reduction"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference HALO Trust USA by name with its official URL and access date.",
    "whyItBelongs": "HALO Trust USA belongs as a stewardship reference because it is relevant to mine clearance and unexploded ordnance harm reduction.",
    "limitationsCautions": "Strong practical harm-reduction candidate; verify U.S. site and current campaigns.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "refugepoint",
    "name": "RefugePoint",
    "officialUrl": "https://www.refugepoint.org/",
    "organization": "RefugePoint",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "refugee solutions and resettlement support.",
    "primaryTopics": [
      "refugees",
      "resettlement",
      "humanitarian"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference RefugePoint by name with its official URL and access date.",
    "whyItBelongs": "RefugePoint belongs as a stewardship reference because it is relevant to refugee solutions and resettlement support.",
    "limitationsCautions": "Strong refugee-support candidate; handle refugee topics carefully.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "international-rescue-committee",
    "name": "International Rescue Committee",
    "officialUrl": "https://www.rescue.org/",
    "organization": "International Rescue Committee",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "humanitarian relief and refugee support.",
    "primaryTopics": [
      "humanitarian",
      "refugees",
      "crisis response"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference International Rescue Committee by name with its official URL and access date.",
    "whyItBelongs": "International Rescue Committee belongs as a stewardship reference because it is relevant to humanitarian relief and refugee support.",
    "limitationsCautions": "Major organization; useful but not intimate/local. Verify current ratings and program details.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "doctors-without-borders--msf",
    "name": "Doctors Without Borders / MSF",
    "officialUrl": "https://www.doctorswithoutborders.org/",
    "organization": "Doctors Without Borders",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "medical humanitarian relief.",
    "primaryTopics": [
      "medical relief",
      "humanitarian",
      "conflict",
      "health"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Doctors Without Borders / MSF by name with its official URL and access date.",
    "whyItBelongs": "Doctors Without Borders / MSF belongs as a stewardship reference because it is relevant to medical humanitarian relief.",
    "limitationsCautions": "Major trusted medical relief org; politically visible in contested crises.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "care-international",
    "name": "CARE International",
    "officialUrl": "https://www.care-international.org/",
    "organization": "CARE International",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "gender, poverty, and humanitarian work.",
    "primaryTopics": [
      "humanitarian",
      "poverty",
      "gender",
      "global development"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference CARE International by name with its official URL and access date.",
    "whyItBelongs": "CARE International belongs as a stewardship reference because it is relevant to gender, poverty, and humanitarian work.",
    "limitationsCautions": "Major humanitarian org; do not describe as a data portal.",
    "riskLabels": [
      "Advocacy/positioning caution",
      "Extra review recommended"
    ],
    "lastChecked": "2026-06-09"
  },
  {
    "id": "wikimedia-foundation",
    "name": "Wikimedia Foundation",
    "officialUrl": "https://wikimediafoundation.org/",
    "organization": "Wikimedia Foundation",
    "category": "Stewardship Organizations",
    "sourceType": "Stewardship organization",
    "bestFor": "free knowledge and open information infrastructure.",
    "primaryTopics": [
      "free knowledge",
      "open information",
      "Wikimedia"
    ],
    "usefulFor": [
      "stewardship",
      "science/reference",
      "public policy"
    ],
    "signupRequired": "No",
    "cloudRequired": "Yes",
    "apiAvailable": "No",
    "bulkDownloadAvailable": "No",
    "licenseReuseNotes": "Organization website terms apply. This listing is informational and does not imply affiliation, sponsorship, or partnership.",
    "privacyEthicsWarnings": "If donating or signing up, data leaves Elysia Ecobotics Online and goes to the organization or its payment/CRM providers.",
    "citationAttributionNotes": "Reference Wikimedia Foundation by name with its official URL and access date.",
    "whyItBelongs": "Wikimedia Foundation belongs as a stewardship reference because it is relevant to free knowledge and open information infrastructure.",
    "limitationsCautions": "Strong Living Library alignment; verify donation and governance details.",
    "riskLabels": [
      "Advocacy/positioning caution"
    ],
    "lastChecked": "2026-06-09"
  }
];
