const RECOVERY_KEY = "elysia.website.stale-chunk-recovery.v1";
const RECOVERY_WINDOW_MS = 30_000;

type RecoveryRecord = {
  attemptedAt: number;
  route: string;
};

function readRecoveryRecord(): RecoveryRecord | null {
  try {
    const candidate = JSON.parse(window.sessionStorage.getItem(RECOVERY_KEY) ?? "null") as Partial<RecoveryRecord> | null;
    if (!candidate || typeof candidate.attemptedAt !== "number" || typeof candidate.route !== "string") return null;
    return { attemptedAt: candidate.attemptedAt, route: candidate.route };
  } catch {
    return null;
  }
}
function writeRecoveryRecord(record: RecoveryRecord): boolean {
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function clearRecoveryRecord(): void {
  try {
    window.sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Privacy-hardened browsers may deny session storage. Recovery remains bounded
    // because those browsers take the visible retry path instead of reloading.
  }
}

function showRecoveryBoundary(): void {
  const root = document.getElementById("root");
  if (!root) return;

  const panel = document.createElement("main");
  panel.id = "stale-chunk-recovery";
  panel.className = "stale-chunk-recovery";
  panel.setAttribute("role", "alert");

  const heading = document.createElement("h1");
  heading.textContent = "This page needs a fresh copy";

  const message = document.createElement("p");
  message.textContent = "The website was updated while this page was open. Reload once more to continue with the current version.";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Reload current page";
  retry.addEventListener("click", () => {
    clearRecoveryRecord();
    window.location.reload();
  });

  panel.append(heading, message, retry);
  root.replaceChildren(panel);
}

export function installStaleChunkRecovery(): void {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();

    const now = Date.now();
    const route = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previous = readRecoveryRecord();
    const retryIsSafe = !previous || previous.route !== route || now - previous.attemptedAt > RECOVERY_WINDOW_MS;

    if (retryIsSafe && writeRecoveryRecord({ attemptedAt: now, route })) {
      window.location.reload();
      return;
    }

    clearRecoveryRecord();
    showRecoveryBoundary();
  });

  window.setTimeout(() => clearRecoveryRecord(), RECOVERY_WINDOW_MS);
}
