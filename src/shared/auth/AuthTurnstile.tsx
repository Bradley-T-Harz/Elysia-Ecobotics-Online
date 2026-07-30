import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { authCaptchaConfig, type AuthCaptchaMode } from "./authCaptcha";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    appearance: "always";
    execution: "render";
    theme: "auto";
    language: "auto";
    size: "flexible";
    "response-field": false;
    retry: "auto";
    "refresh-expired": "auto";
    "refresh-timeout": "auto";
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
    "timeout-callback": () => void;
    "unsupported-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

type AuthTurnstileState =
  | "loading"
  | "ready"
  | "verified"
  | "expired"
  | "failed"
  | "unsupported"
  | "unconfigured";

export type AuthTurnstileHandle = {
  focus: () => void;
};

type AuthTurnstileProps = {
  action: string;
  mode?: AuthCaptchaMode;
  onTokenChange: (token: string | null) => void;
  resetKey: number;
};

const SCRIPT_SOURCE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_TIMEOUT_MS = 12_000;
let authScriptPromise: Promise<TurnstileApi> | null = null;

function currentApi(): TurnstileApi | undefined {
  return (window as typeof window & { turnstile?: TurnstileApi }).turnstile;
}

function existingTurnstileScript(): HTMLScriptElement | null {
  return Array.from(document.scripts).find((script) =>
    script.src.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js")
  ) ?? null;
}

function loadTurnstile(): Promise<TurnstileApi> {
  const available = currentApi();
  if (available) return Promise.resolve(available);
  if (authScriptPromise) return authScriptPromise;

  authScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = existingTurnstileScript();
    const script = existing ?? document.createElement("script");
    let settled = false;
    let pollId = 0;
    let timeoutId = 0;

    const cleanUp = () => {
      script.removeEventListener("load", check);
      script.removeEventListener("error", fail);
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };
    const check = () => {
      const api = currentApi();
      if (!api || settled) return;
      settled = true;
      cleanUp();
      resolve(api);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanUp();
      if (!existing) script.remove();
      reject(new Error("auth_turnstile_unavailable"));
    };

    script.addEventListener("load", check);
    script.addEventListener("error", fail);
    pollId = window.setInterval(check, 50);
    timeoutId = window.setTimeout(fail, SCRIPT_TIMEOUT_MS);
    if (!existing) {
      script.id = "elysia-auth-turnstile-script";
      script.src = SCRIPT_SOURCE;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    check();
  }).catch((error) => {
    authScriptPromise = null;
    throw error;
  });

  return authScriptPromise;
}

function stateCopy(state: AuthTurnstileState): string {
  if (state === "loading") return "Loading account safety verification…";
  if (state === "verified") return "Account safety verification is ready for this request.";
  if (state === "expired") return "The verification expired and is refreshing. Complete it again if prompted.";
  if (state === "unsupported") return "This browser cannot run the account safety verification.";
  if (state === "unconfigured") return "Account safety verification is not configured in this environment.";
  if (state === "failed") return "Account safety verification could not load. A privacy or content blocker may be preventing it.";
  return "Complete the account safety verification before continuing.";
}

export const AuthTurnstile = forwardRef<AuthTurnstileHandle, AuthTurnstileProps>(
  function AuthTurnstile(
    {
      action,
      mode = authCaptchaConfig.mode,
      onTokenChange,
      resetKey,
    },
    forwardedRef,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const regionRef = useRef<HTMLDivElement | null>(null);
    const callbackRef = useRef(onTokenChange);
    const [state, setState] = useState<AuthTurnstileState>("loading");
    const [retryKey, setRetryKey] = useState(0);
    callbackRef.current = onTokenChange;

    useImperativeHandle(forwardedRef, () => ({
      focus: () => regionRef.current?.focus(),
    }), []);

    useEffect(() => {
      callbackRef.current(null);
      if (mode === "off") return;
      const siteKey = authCaptchaConfig.siteKey;
      if (!siteKey || !/^[a-z][a-z0-9_]{2,31}$/.test(action)) {
        setState("unconfigured");
        return;
      }

      let active = true;
      let widgetId: string | null = null;
      setState("loading");

      void loadTurnstile()
        .then((api) => {
          if (!active || !containerRef.current) return;
          containerRef.current.replaceChildren();
          setState("ready");
          widgetId = api.render(containerRef.current, {
            sitekey: siteKey,
            action,
            appearance: "always",
            execution: "render",
            theme: "auto",
            language: "auto",
            size: "flexible",
            "response-field": false,
            retry: "auto",
            "refresh-expired": "auto",
            "refresh-timeout": "auto",
            callback: (token) => {
              if (!active) return;
              if (!token || token.length > 2_048) {
                callbackRef.current(null);
                setState("failed");
                return;
              }
              callbackRef.current(token);
              setState("verified");
            },
            "error-callback": () => {
              if (!active) return;
              callbackRef.current(null);
              setState("failed");
            },
            "expired-callback": () => {
              if (!active) return;
              callbackRef.current(null);
              setState("expired");
            },
            "timeout-callback": () => {
              if (!active) return;
              callbackRef.current(null);
              setState("expired");
            },
            "unsupported-callback": () => {
              if (!active) return;
              callbackRef.current(null);
              setState("unsupported");
            },
          });
        })
        .catch(() => {
          if (!active) return;
          callbackRef.current(null);
          setState("failed");
        });

      return () => {
        active = false;
        callbackRef.current(null);
        const api = currentApi();
        if (widgetId && api) api.remove(widgetId);
        containerRef.current?.replaceChildren();
      };
    }, [action, mode, resetKey, retryKey]);

    if (mode === "off") return null;
    const failed = state === "failed" || state === "unsupported" || state === "unconfigured";

    return (
      <div
        className="auth-turnstile-field"
        ref={regionRef}
        tabIndex={-1}
        aria-label="Account safety verification"
      >
        <div className="auth-turnstile-widget" ref={containerRef} aria-label="Account safety challenge" />
        <p
          className={failed ? "validation validation--bad" : "inline-status"}
          role={failed ? "alert" : "status"}
          aria-live={failed ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {stateCopy(state)}
        </p>
        {failed ? (
          <button
            className="auth-turnstile-retry"
            type="button"
            onClick={() => {
              callbackRef.current(null);
              setRetryKey((value) => value + 1);
            }}
          >
            Retry verification
          </button>
        ) : null}
      </div>
    );
  },
);
