export function parseCommuneLinksInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function safeCommuneLinkHref(value: string) {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}
