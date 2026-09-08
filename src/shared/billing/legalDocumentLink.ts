export function legalDocumentLink(document: { path: string; version: string } | null | undefined, fallback: string): string {
  if (!document) return fallback;
  if (!/^\/legal\/[a-z-]+$/.test(document.path) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(document.version)) return "/legal";
  return `${document.path}?version=${encodeURIComponent(document.version)}`;
}
