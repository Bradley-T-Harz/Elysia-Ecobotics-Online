export type NavigationAction = "POP" | "PUSH" | "REPLACE";

export type RouteEntryDirective =
  | { behavior: "top" }
  | { behavior: "preserve" }
  | { behavior: "target"; targetId: string };

export type RouteEntryLocation = {
  hash: string;
  pathname: string;
  search: string;
  state: unknown;
};

const approvedTargetIds = new Set([
  "coding-workbench-heading",
  "commune-feed",
  "commune-local-drafts",
  "commune-post-composer",
  "commune-rooms",
  "customization-studio",
  "privacy-lanterns",
  "release-availability",
  "support-checkout",
]);

export function targetIdFromHash(hash: string) {
  if (!hash.startsWith("#") || hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

export function isApprovedRouteTarget(targetId: string) {
  return approvedTargetIds.has(targetId)
    || targetId.startsWith("forge-")
    || targetId.startsWith("library-");
}

function explicitDirective(state: unknown): RouteEntryDirective | null {
  if (!state || typeof state !== "object" || !("routeEntry" in state)) return null;
  const routeEntry = (state as { routeEntry?: unknown }).routeEntry;
  if (routeEntry === "top") return { behavior: "top" };
  if (routeEntry === "preserve") return { behavior: "preserve" };
  if (!routeEntry || typeof routeEntry !== "object") return null;
  const targetId = (routeEntry as { targetId?: unknown }).targetId;
  return typeof targetId === "string" && isApprovedRouteTarget(targetId)
    ? { behavior: "target", targetId }
    : null;
}

const preservedQueryKeysByPath = new Map<string, Set<string>>([
  ["/commons-circle/signals/inbox", new Set(["view"])],
  ["/commons-circle/signals/notifications", new Set(["filter"])],
  ["/commons-circle/signals/requests-reviews", new Set(["domain", "state"])],
]);

function queryKeys(search: string) {
  return new Set(new URLSearchParams(search).keys());
}

function isDeclaredInPageQueryChange(pathname: string, previousSearch: string, currentSearch: string) {
  const allowedKeys = preservedQueryKeysByPath.get(pathname);
  if (!allowedKeys) return false;
  const involvedKeys = new Set([...queryKeys(previousSearch), ...queryKeys(currentSearch)]);
  return involvedKeys.size > 0 && [...involvedKeys].every((key) => allowedKeys.has(key));
}

export function resolveRouteEntryDirective({
  initialHistoryTraversal,
  isInitialEntry,
  location,
  navigationAction,
  previousLocation,
}: {
  initialHistoryTraversal: boolean;
  isInitialEntry: boolean;
  location: RouteEntryLocation;
  navigationAction: NavigationAction;
  previousLocation: RouteEntryLocation | null;
}): RouteEntryDirective {
  if ((navigationAction === "POP" && !isInitialEntry) || (isInitialEntry && initialHistoryTraversal)) {
    return { behavior: "preserve" };
  }

  const stateDirective = explicitDirective(location.state);
  if (stateDirective) return stateDirective;

  const hashTargetId = targetIdFromHash(location.hash);
  if (hashTargetId && isApprovedRouteTarget(hashTargetId)) {
    return { behavior: "target", targetId: hashTargetId };
  }

  if (
    previousLocation
    && previousLocation.pathname === location.pathname
    && previousLocation.search !== location.search
    && !location.hash
    && isDeclaredInPageQueryChange(location.pathname, previousLocation.search, location.search)
  ) {
    return { behavior: "preserve" };
  }

  return { behavior: "top" };
}
