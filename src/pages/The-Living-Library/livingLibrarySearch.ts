import type {
  LivingLibraryApiAccess,
  LivingLibraryBrowseCategory,
  LivingLibraryDownloadAccess,
  LivingLibraryPublicAccess,
  LivingLibraryReviewStatus,
  LivingLibrarySource,
} from "./livingLibraryCatalog";

export type LivingLibrarySearchFilters = {
  category: LivingLibraryBrowseCategory | "all";
  resourceType: string | "all";
  publicAccess: LivingLibraryPublicAccess | "all";
  reviewStatus: LivingLibraryReviewStatus | "all";
  apiAccess: LivingLibraryApiAccess | "all";
  downloadAccess: LivingLibraryDownloadAccess | "all";
};

export type LivingLibrarySearchResult = {
  source: LivingLibrarySource;
  score: number;
  matchedIn: string[];
};

export const defaultLivingLibraryFilters: LivingLibrarySearchFilters = {
  category: "all",
  resourceType: "all",
  publicAccess: "all",
  reviewStatus: "all",
  apiAccess: "all",
  downloadAccess: "all",
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function stemToken(token: string) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function searchableTokens(value: string) {
  const normalized = normalizeText(value);
  return new Set(normalized.split(" ").flatMap((token) => unique([token, stemToken(token)])));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function fieldMatch(query: string, queryTokens: string[], fieldValue: string) {
  const normalized = normalizeText(fieldValue);
  if (!normalized) return { exact: false, phrase: false, tokenMatches: 0 };
  const fieldTokens = searchableTokens(normalized);
  const phrase = Boolean(query) && normalized.includes(query);
  const exact = normalized === query;
  const tokenMatches = queryTokens.filter((token) => fieldTokens.has(token) || normalized.includes(token)).length;
  return { exact, phrase, tokenMatches };
}

function sourceMatchesFilters(source: LivingLibrarySource, filters: LivingLibrarySearchFilters) {
  return (filters.category === "all" || source.browseCategory === filters.category)
    && (filters.resourceType === "all" || source.resourceType === filters.resourceType)
    && (filters.publicAccess === "all" || source.access.public === filters.publicAccess)
    && (filters.reviewStatus === "all" || source.content.reviewStatus === filters.reviewStatus)
    && (filters.apiAccess === "all" || source.access.api === filters.apiAccess)
    && (filters.downloadAccess === "all" || source.access.download === filters.downloadAccess);
}

export function searchLivingLibrarySources(
  sources: LivingLibrarySource[],
  rawQuery: string,
  filters: LivingLibrarySearchFilters = defaultLivingLibraryFilters,
) {
  const query = normalizeText(rawQuery);
  const queryTokens = unique(query.split(" ").filter(Boolean).flatMap((token) => [token, stemToken(token)]));
  const filtered = sources.filter((source) => sourceMatchesFilters(source, filters));
  if (!queryTokens.length) {
    return filtered
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((source) => ({ source, score: 0, matchedIn: [] }));
  }

  return filtered.flatMap<LivingLibrarySearchResult>((source) => {
    const weightedFields: Array<{ label: string; weight: number; values: string[] }> = [
      { label: "name", weight: 24, values: [source.name] },
      { label: "alias", weight: 20, values: source.aliases },
      { label: "operator", weight: 12, values: [source.operator] },
      { label: "resource type", weight: 10, values: [source.resourceType, source.sourceType] },
      { label: "field", weight: 9, values: [source.browseCategory, ...source.scienceDomains] },
      { label: "topic", weight: 8, values: source.primaryTopics },
      { label: "keyword", weight: 7, values: source.searchKeywords },
      { label: "best use", weight: 5, values: [source.bestFor, ...source.usefulFor] },
      { label: "access or content trait", weight: 4, values: [
        source.access.public,
        source.access.api,
        source.access.cloud,
        source.access.download,
        source.content.reviewStatus,
        source.content.hostsContent === "no" ? "index metadata only" : "hosts content",
      ] },
      { label: "description", weight: 2, values: [source.content.note, source.limitationsCautions, source.license.summary] },
      { label: "geography or language", weight: 2, values: [...source.geography, ...source.languages] },
    ];

    let score = 0;
    const matchedTokens = new Set<string>();
    const matchedIn: string[] = [];
    for (const field of weightedFields) {
      let fieldMatched = false;
      for (const value of field.values) {
        const match = fieldMatch(query, queryTokens, value);
        if (!match.exact && !match.phrase && !match.tokenMatches) continue;
        fieldMatched = true;
        score += match.tokenMatches * field.weight;
        if (match.phrase) score += field.weight * 2;
        if (match.exact) score += field.weight * 3;
        const normalized = normalizeText(value);
        queryTokens.forEach((token) => {
          if (searchableTokens(normalized).has(token) || normalized.includes(token)) matchedTokens.add(token);
        });
      }
      if (fieldMatched) matchedIn.push(field.label);
    }

    const allOriginalQueryTokens = query.split(" ").filter(Boolean).every((token) => matchedTokens.has(token) || matchedTokens.has(stemToken(token)));
    if (!allOriginalQueryTokens) return [];
    return [{ source, score, matchedIn: unique(matchedIn) }];
  }).sort((left, right) => right.score - left.score || left.source.name.localeCompare(right.source.name));
}

export function livingLibrarySearchParams(filters: LivingLibrarySearchFilters, query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.resourceType !== "all") params.set("type", filters.resourceType);
  if (filters.publicAccess !== "all") params.set("access", filters.publicAccess);
  if (filters.reviewStatus !== "all") params.set("content", filters.reviewStatus);
  if (filters.apiAccess !== "all") params.set("api", filters.apiAccess);
  if (filters.downloadAccess !== "all") params.set("download", filters.downloadAccess);
  return params;
}

function validValue<T extends string>(value: string | null, values: readonly T[], fallback: T) {
  return value && values.includes(value as T) ? value as T : fallback;
}

export function parseLivingLibrarySearchParams(
  params: URLSearchParams,
  sources: LivingLibrarySource[],
): { query: string; filters: LivingLibrarySearchFilters } {
  const categories = unique(sources.map((source) => source.browseCategory));
  const resourceTypes = unique(sources.map((source) => source.resourceType));
  const publicAccessValues = unique(sources.map((source) => source.access.public));
  const reviewStatuses = unique(sources.map((source) => source.content.reviewStatus));
  const apiAccessValues = unique(sources.map((source) => source.access.api));
  const downloadValues = unique(sources.map((source) => source.access.download));
  return {
    query: params.get("q") ?? "",
    filters: {
      category: validValue(params.get("category"), ["all", ...categories], "all"),
      resourceType: validValue(params.get("type"), ["all", ...resourceTypes], "all"),
      publicAccess: validValue(params.get("access"), ["all", ...publicAccessValues], "all"),
      reviewStatus: validValue(params.get("content"), ["all", ...reviewStatuses], "all"),
      apiAccess: validValue(params.get("api"), ["all", ...apiAccessValues], "all"),
      downloadAccess: validValue(params.get("download"), ["all", ...downloadValues], "all"),
    },
  };
}
