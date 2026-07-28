export const AUTH_SIGNUP_DIAGNOSTIC_CONTRACT = "2026-07-27.1";

export type AuthSignupResultCategory =
  | "not_started"
  | "pending"
  | "invalid_input"
  | "configuration_unavailable"
  | "network_error"
  | "provider_error"
  | "unexpected_error"
  | "unexpected_response"
  | "confirmation_required"
  | "confirmation_or_existing"
  | "signed_in";

export type AuthSignupPasswordClearReason =
  | "none"
  | "confirmed_new_user"
  | "immediate_session"
  | "input_event_during_pending"
  | "mode_change";

export type AuthSignupMessageCategory =
  | "none"
  | "pending"
  | Exclude<AuthSignupResultCategory, "not_started" | "pending">;

export type AuthSignupDiagnostic = {
  contract: typeof AUTH_SIGNUP_DIAGNOSTIC_CONTRACT;
  attemptId: string;
  route: "/commons-circle" | "/commons-circle/setup/profile" | "other";
  browserFamily: "brave" | "chromium" | "firefox" | "other";
  handlerStarted: boolean;
  validationPassed: boolean;
  signupCalled: boolean;
  requestStarted: boolean;
  requestCompleted: boolean;
  httpStatus?: number;
  safeCode?: string;
  resultCategory: AuthSignupResultCategory;
  pendingState: "idle" | "pending" | "settled";
  passwordClearReason: AuthSignupPasswordClearReason;
  passwordRestored: boolean;
  renderedMessageCategory: AuthSignupMessageCategory;
};

const storageKey = "elysia.website-account-signup.diagnostic.v1";
const eventName = "elysia:website-account-signup-diagnostic";
let memoryDiagnostic: AuthSignupDiagnostic | null = null;
let activeAttemptId: string | null = null;
const nativeFetch = globalThis.fetch.bind(globalThis);

function routeCategory(): AuthSignupDiagnostic["route"] {
  if (typeof window === "undefined") return "other";
  if (window.location.pathname === "/commons-circle") return "/commons-circle";
  if (window.location.pathname === "/commons-circle/setup/profile") return "/commons-circle/setup/profile";
  return "other";
}

function browserFamily(): AuthSignupDiagnostic["browserFamily"] {
  if (typeof navigator === "undefined") return "other";
  const browserNavigator = navigator as Navigator & { brave?: unknown };
  if (browserNavigator.brave) return "brave";
  if (/firefox/i.test(navigator.userAgent)) return "firefox";
  if (/chrom(?:e|ium)/i.test(navigator.userAgent)) return "chromium";
  return "other";
}

function safeAttemptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredDiagnostic(): AuthSignupDiagnostic | null {
  if (typeof sessionStorage === "undefined") return memoryDiagnostic;
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return memoryDiagnostic;
    const parsed = JSON.parse(stored) as Partial<AuthSignupDiagnostic>;
    if (
      parsed.contract !== AUTH_SIGNUP_DIAGNOSTIC_CONTRACT
      || typeof parsed.attemptId !== "string"
      || parsed.attemptId.length > 64
    ) {
      return memoryDiagnostic;
    }
    return parsed as AuthSignupDiagnostic;
  } catch {
    return memoryDiagnostic;
  }
}

function publishDiagnostic(diagnostic: AuthSignupDiagnostic) {
  memoryDiagnostic = diagnostic;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(diagnostic));
    } catch {
      // Private browsing may deny storage. The in-memory copy and event still work.
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AuthSignupDiagnostic>(eventName, { detail: diagnostic }));
  }
}

export function getAuthSignupDiagnostic() {
  return readStoredDiagnostic();
}

export function subscribeToAuthSignupDiagnostic(listener: (diagnostic: AuthSignupDiagnostic) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleDiagnostic = (event: Event) => {
    listener((event as CustomEvent<AuthSignupDiagnostic>).detail);
  };
  window.addEventListener(eventName, handleDiagnostic);
  return () => window.removeEventListener(eventName, handleDiagnostic);
}

export function beginAuthSignupDiagnostic(): AuthSignupDiagnostic {
  const diagnostic: AuthSignupDiagnostic = {
    contract: AUTH_SIGNUP_DIAGNOSTIC_CONTRACT,
    attemptId: safeAttemptId(),
    route: routeCategory(),
    browserFamily: browserFamily(),
    handlerStarted: true,
    validationPassed: false,
    signupCalled: false,
    requestStarted: false,
    requestCompleted: false,
    resultCategory: "pending",
    pendingState: "pending",
    passwordClearReason: "none",
    passwordRestored: false,
    renderedMessageCategory: "pending"
  };
  activeAttemptId = diagnostic.attemptId;
  publishDiagnostic(diagnostic);
  return diagnostic;
}

export function updateAuthSignupDiagnostic(
  attemptId: string,
  update: Partial<Omit<AuthSignupDiagnostic, "contract" | "attemptId" | "route" | "browserFamily">>
) {
  const current = readStoredDiagnostic();
  if (!current || current.attemptId !== attemptId) return;
  publishDiagnostic({ ...current, ...update });
}

export function finishAuthSignupDiagnostic(attemptId: string) {
  updateAuthSignupDiagnostic(attemptId, { pendingState: "settled" });
  if (activeAttemptId === attemptId) activeAttemptId = null;
}

function isSignupRequest(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    );
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    return method === "POST" && url.pathname.endsWith("/auth/v1/signup");
  } catch {
    return false;
  }
}

export const observedAuthFetch: typeof fetch = async (input, init) => {
  const attemptId = activeAttemptId;
  if (!attemptId || !isSignupRequest(input, init)) return nativeFetch(input, init);

  updateAuthSignupDiagnostic(attemptId, {
    signupCalled: true,
    requestStarted: true
  });
  try {
    const response = await nativeFetch(input, init);
    updateAuthSignupDiagnostic(attemptId, {
      requestCompleted: true,
      httpStatus: response.status
    });
    return response;
  } catch (error) {
    updateAuthSignupDiagnostic(attemptId, {
      requestCompleted: true,
      resultCategory: "unexpected_error"
    });
    throw error;
  }
};

export function safeAuthDiagnosticCode(code: string | undefined) {
  if (!code) return undefined;
  const normalized = code.trim().toLowerCase();
  return /^[a-z0-9_]{1,64}$/.test(normalized) ? normalized : "unclassified";
}

export function authSignupDiagnosticSummary(diagnostic: AuthSignupDiagnostic) {
  const reference = diagnostic.attemptId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const status = diagnostic.pendingState === "pending"
    ? "request pending"
    : diagnostic.resultCategory.replace(/_/g, " ");
  return `Attempt ${reference}: ${status}.`;
}

export function restoredAuthSignupMessage(diagnostic: AuthSignupDiagnostic | null) {
  if (!diagnostic) return "";
  switch (diagnostic.renderedMessageCategory) {
    case "pending":
      return diagnostic.pendingState === "pending"
        ? "A Website Account request was interrupted before its result could be displayed. Your password was not retained; check for an account email before retrying."
        : "";
    case "invalid_input":
      return "Enter a valid email and a password of at least 6 characters before creating a Website Account.";
    case "configuration_unavailable":
      return "Website Account creation is temporarily unavailable because authentication is not configured.";
    case "provider_error":
      return "The Website Account sign-up request was not accepted. Enter your password to retry after checking the attempt status below.";
    case "network_error":
      return "The Website Account sign-up request could not reach authentication. Enter your password to retry after checking your connection.";
    case "unexpected_error":
      return "The Website Account sign-up request could not finish safely. Enter your password to retry.";
    case "unexpected_response":
      return "The Website Account sign-up response could not be verified safely. Check the attempt status below before retrying.";
    case "confirmation_required":
      return "Account created. Check your email to confirm it before signing in.";
    case "confirmation_or_existing":
      return "If this address can create a new account, check its inbox. Otherwise, sign in or recover the account.";
    case "signed_in":
      return "The Website Account sign-up completed with a session.";
    default:
      return "";
  }
}
