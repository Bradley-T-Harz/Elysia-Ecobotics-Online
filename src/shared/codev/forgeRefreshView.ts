/** View metadata for the explicit Codev refresh. No source, credentials or grants. */
import type { OwnershipSelection } from "../addons/publisherOwnership";
import { unsafeWorkspaceText, canonicalWorkspacePath } from "./workspace";
export type ForgeRefreshView = {
  route: string;
  selectedDraftId: string | null;
  activeFilePath: string | null;
  blankName: string;
  ownership: OwnershipSelection;
  scrollY: number;
};
const prefix = "elysia.codev.forge-refresh-view.v1.";
const loaded = new Map<string, ForgeRefreshView | null>();
const key = (accountId: string, browserId: string) =>
  prefix + JSON.stringify([accountId, browserId]);
export function storeForgeRefreshView(
  accountId: string,
  browserId: string,
  view: ForgeRefreshView,
) {
  if (
    !view.route.startsWith("/developer-forge/drafts") ||
    view.route !== location.pathname
  )
    throw new Error(
      "The Forge route changed. Keep this draft open and retry sync.",
    );
  if (view.activeFilePath) canonicalWorkspacePath(view.activeFilePath);
  const record = { accountId, browserId, view, expiresAt: Date.now() + 300000 };
  const text = JSON.stringify(record);
  if (text.length > 8000 || unsafeWorkspaceText(text))
    throw new Error(
      "The current view could not be safely preserved. Keep the draft open.",
    );
  sessionStorage.setItem(key(accountId, browserId), text);
}
export function consumeForgeRefreshView(
  accountId: string | null,
  browserId: string,
): ForgeRefreshView | null {
  if (!accountId) return null;
  const id = key(accountId, browserId);
  if (loaded.has(id)) return loaded.get(id)!;
  let view: ForgeRefreshView | null = null;
  try {
    const raw = sessionStorage.getItem(id);
    sessionStorage.removeItem(id);
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (raw && raw.length <= 8000 && navigation?.type === "reload") {
      const record = JSON.parse(raw);
      const candidate = record.view;
      if (
        record.accountId === accountId &&
        record.browserId === browserId &&
        Number.isFinite(record.expiresAt) &&
        record.expiresAt > Date.now() &&
        candidate?.route === location.pathname &&
        typeof candidate.blankName === "string" &&
        candidate.blankName.length <= 1000 &&
        (candidate.selectedDraftId === null ||
          (typeof candidate.selectedDraftId === "string" &&
            candidate.selectedDraftId.length <= 160)) &&
        (candidate.activeFilePath === null ||
          (typeof candidate.activeFilePath === "string" &&
            canonicalWorkspacePath(candidate.activeFilePath))) &&
        Number.isFinite(candidate.scrollY) &&
        candidate.scrollY >= 0 &&
        candidate.scrollY <= 1000000 &&
        typeof candidate.ownership?.creatorAttribution === "string" &&
        candidate.ownership.creatorAttribution.length <= 200 &&
        (candidate.ownership.publisherId === null ||
          (typeof candidate.ownership.publisherId === "string" &&
            candidate.ownership.publisherId.length <= 160))
      ) {
        view = candidate;
      }
    }
  } catch {
    /* Invalid view metadata never creates a workspace or authority. */
  }
  loaded.set(id, view);
  return view;
}
