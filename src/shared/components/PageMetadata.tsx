import { useEffect } from "react";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";

const defaultMetadata = {
  title: "Elysia Ecobotics Online",
  description: "Elysia Ecobotics Online: public downloads, Marketplace, Developer Forge, Living Library, Commune, Commons Circle, and project documentation around Elysia.",
  canonicalUrl: `${ELYSIA_ECOBOTICS_ONLINE_URL}/`
};

type PageMetadataProps = {
  title: string;
  description: string;
  canonicalUrl: string;
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }
  element.href = href;
}

function applyMetadata({ title, description, canonicalUrl }: PageMetadataProps) {
  document.title = title;
  setMeta('meta[name="description"]', "name", "description", description);
  setMeta('meta[name="robots"]', "name", "robots", "index, follow");
  setMeta('meta[property="og:type"]', "property", "og:type", "website");
  setMeta('meta[property="og:site_name"]', "property", "og:site_name", "Elysia Ecobotics Online");
  setMeta('meta[property="og:title"]', "property", "og:title", title);
  setMeta('meta[property="og:description"]', "property", "og:description", description);
  setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary");
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  setCanonical(canonicalUrl);
}

export default function PageMetadata(props: PageMetadataProps) {
  useEffect(() => {
    applyMetadata(props);
    return () => applyMetadata(defaultMetadata);
  }, [props.title, props.description, props.canonicalUrl]);

  return null;
}
