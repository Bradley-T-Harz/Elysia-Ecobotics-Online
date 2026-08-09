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

export function communeLinkPresentation(value: string) {
  const text = value.trim();
  const directHref = safeCommuneLinkHref(text);
  if (directHref) return { label: text, href: directHref };

  const separator = text.indexOf("|");
  if (separator > 0) {
    const label = text.slice(0, separator).trim();
    const candidateHref = text.slice(separator + 1).trim();
    const href = safeCommuneLinkHref(candidateHref);
    if (label && href) return { label, href };
  }

  return { label: text, href: null };
}
