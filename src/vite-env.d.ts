/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_CAPTCHA_MODE?: "off" | "preflight" | "required";
  readonly VITE_AUTH_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
