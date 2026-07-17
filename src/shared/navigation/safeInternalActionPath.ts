/**
 * Notification action URLs are database content. Keep them inside this SPA and
 * reject protocol-relative, backslash-normalized, and control-character input.
 */
export function safeInternalActionPath(value?: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const parsed = new URL(value, "https://elysia.invalid");
    if (parsed.origin !== "https://elysia.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
