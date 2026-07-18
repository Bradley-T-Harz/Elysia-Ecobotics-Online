import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    theme: "dark" | "light" | "auto";
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
    "timeout-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "elysia-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const onLoad = () => window.turnstile ? resolve() : reject(new Error("turnstile_unavailable"));
    const onError = () => reject(new Error("turnstile_unavailable"));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export default function TurnstileWidget({
  action,
  onTokenChange,
  resetKey,
}: {
  action: string;
  onTokenChange: (token: string | null) => void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

  useEffect(() => {
    onTokenChange(null);
    if (!siteKey) {
      setStatus("missing");
      return;
    }
    let active = true;
    let widgetId: string | null = null;
    setStatus("loading");
    void loadTurnstile()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          callback: (token) => {
            if (!active) return;
            setStatus("ready");
            onTokenChange(token);
          },
          "error-callback": () => {
            if (!active) return;
            setStatus("error");
            onTokenChange(null);
          },
          "expired-callback": () => {
            if (!active) return;
            setStatus("ready");
            onTokenChange(null);
          },
          "timeout-callback": () => {
            if (!active) return;
            setStatus("ready");
            onTokenChange(null);
          },
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        onTokenChange(null);
      });

    return () => {
      active = false;
      onTokenChange(null);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onTokenChange, resetKey, siteKey]);

  return (
    <div>
      <div ref={containerRef} aria-label="Human verification" />
      {status === "loading" && <p className="inline-status" aria-live="polite">Loading human verification…</p>}
      {status === "missing" && <p className="validation validation--bad">Human verification is not configured in this environment. The account request remains disabled.</p>}
      {status === "error" && <p className="validation validation--bad">Human verification could not load. No account request can be sent.</p>}
    </div>
  );
}
