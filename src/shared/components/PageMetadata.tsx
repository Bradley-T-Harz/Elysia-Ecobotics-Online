import { useEffect } from "react";
import {
  ELYSIA_ECOBOTICS_ONLINE_URL,
  ELYSIA_ECOBOTICS_SOCIAL_PREVIEW_IMAGE_URL
} from "../../config/siteUrls";

const socialPreviewMetadata = {
  socialImageUrl: ELYSIA_ECOBOTICS_SOCIAL_PREVIEW_IMAGE_URL,
  socialImageType: "image/png",
  socialImageWidth: "1733",
  socialImageHeight: "907",
  socialImageAlt: "Elysia Ecobotics™ eco-futurist circuit-city exchanging energy and data with a living forest."
};

const defaultMetadata = {
  title: "Elysia Ecobotics Online",
  description: "Elysia Ecobotics Online: public downloads, Marketplace, Developer Forge, Living Library, Commune, Commons Circle, and project documentation around Elysia.",
  canonicalUrl: `${ELYSIA_ECOBOTICS_ONLINE_URL}/`,
  ...socialPreviewMetadata
};

type PageMetadataProps = {
  title: string;
  description: string;
  canonicalUrl: string;
  socialImageUrl?: string;
  socialImageType?: string;
  socialImageWidth?: string;
  socialImageHeight?: string;
  socialImageAlt?: string;
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

function applyMetadata({
  title,
  description,
  canonicalUrl,
  socialImageUrl = socialPreviewMetadata.socialImageUrl,
  socialImageType = socialPreviewMetadata.socialImageType,
  socialImageWidth = socialPreviewMetadata.socialImageWidth,
  socialImageHeight = socialPreviewMetadata.socialImageHeight,
  socialImageAlt = socialPreviewMetadata.socialImageAlt
}: PageMetadataProps) {
  document.title = title;
  setMeta('meta[name="description"]', "name", "description", description);
  setMeta('meta[name="robots"]', "name", "robots", "index, follow");
  setMeta('meta[property="og:type"]', "property", "og:type", "website");
  setMeta('meta[property="og:site_name"]', "property", "og:site_name", "Elysia Ecobotics Online");
  setMeta('meta[property="og:title"]', "property", "og:title", title);
  setMeta('meta[property="og:description"]', "property", "og:description", description);
  setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  setMeta('meta[property="og:image"]', "property", "og:image", socialImageUrl);
  setMeta('meta[property="og:image:secure_url"]', "property", "og:image:secure_url", socialImageUrl);
  setMeta('meta[property="og:image:type"]', "property", "og:image:type", socialImageType);
  setMeta('meta[property="og:image:width"]', "property", "og:image:width", socialImageWidth);
  setMeta('meta[property="og:image:height"]', "property", "og:image:height", socialImageHeight);
  setMeta('meta[property="og:image:alt"]', "property", "og:image:alt", socialImageAlt);
  setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  setMeta('meta[name="twitter:image"]', "name", "twitter:image", socialImageUrl);
  setMeta('meta[name="twitter:image:alt"]', "name", "twitter:image:alt", socialImageAlt);
  setCanonical(canonicalUrl);
}

export default function PageMetadata(props: PageMetadataProps) {
  useEffect(() => {
    applyMetadata(props);
    return () => applyMetadata(defaultMetadata);
  }, [
    props.title,
    props.description,
    props.canonicalUrl,
    props.socialImageUrl,
    props.socialImageType,
    props.socialImageWidth,
    props.socialImageHeight,
    props.socialImageAlt
  ]);

  return null;
}
