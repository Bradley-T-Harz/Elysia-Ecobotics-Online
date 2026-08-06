import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifyBuiltArtifacts = process.argv.includes("--built");
const expectedImageUrl = "https://elysiaecobotics.com/images/social/Elysia_Ecobotics_Link_Image.png";
const expectedImageAlt = "Elysia Ecobotics™ eco-futurist circuit-city exchanging energy and data with a living forest.";
const expectedImageSha256 = "c50584f3afd10138055cddd4cacdecd33f67540265330982a5237785651a7f7b";
const homepageTitle = "Elysia Ecobotics Online";
const homepageDescription = "Elysia Ecobotics Online: public downloads, Marketplace, Developer Forge, Living Library, Commune, Commons Circle, and project documentation around Elysia.";
const artisanTitle = "Elysia Artisan Collective | Elysia Ecobotics Online";
const artisanDescription = "Meet the Elysia Artisan Collective, a separate creative commons for credited human-made, AI-assisted, generative, hybrid, and difficult-to-classify art.";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
}

function metaContents(html, attributeName, key) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => attribute(tag, attributeName) === key)
    .map((tag) => attribute(tag, "content"));
}

function expectSingleMeta(html, attributeName, key, expectedContent, label) {
  const contents = metaContents(html, attributeName, key);
  assert.equal(contents.length, 1, `${label} must contain exactly one ${key} tag.`);
  assert.equal(contents[0], expectedContent, `${label} has an incorrect ${key} value.`);
}

function expectCanonical(html, expectedHref, label) {
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => attribute(tag, "rel") === "canonical")
    .map((tag) => attribute(tag, "href"));
  assert.deepEqual(canonicals, [expectedHref], `${label} must contain exactly one correct canonical link.`);
}

function verifyImageMetadata(html, label) {
  const openGraphImageMetadata = {
    "og:image": expectedImageUrl,
    "og:image:secure_url": expectedImageUrl,
    "og:image:type": "image/png",
    "og:image:width": "1733",
    "og:image:height": "907",
    "og:image:alt": expectedImageAlt
  };
  for (const [key, value] of Object.entries(openGraphImageMetadata)) {
    expectSingleMeta(html, "property", key, value, label);
  }
  expectSingleMeta(html, "name", "twitter:card", "summary_large_image", label);
  expectSingleMeta(html, "name", "twitter:image", expectedImageUrl, label);
  expectSingleMeta(html, "name", "twitter:image:alt", expectedImageAlt, label);
}

function verifyHomepage(html, label) {
  expectCanonical(html, "https://elysiaecobotics.com/", label);
  expectSingleMeta(html, "property", "og:type", "website", label);
  expectSingleMeta(html, "property", "og:site_name", homepageTitle, label);
  expectSingleMeta(html, "property", "og:title", homepageTitle, label);
  expectSingleMeta(html, "property", "og:description", homepageDescription, label);
  expectSingleMeta(html, "property", "og:url", "https://elysiaecobotics.com/", label);
  expectSingleMeta(html, "name", "twitter:title", homepageTitle, label);
  expectSingleMeta(html, "name", "twitter:description", homepageDescription, label);
  verifyImageMetadata(html, label);
}

function verifyArtisan(html, label) {
  expectCanonical(html, "https://elysiaecobotics.com/artisan-collective", label);
  expectSingleMeta(html, "property", "og:title", artisanTitle, label);
  expectSingleMeta(html, "property", "og:description", artisanDescription, label);
  expectSingleMeta(html, "property", "og:url", "https://elysiaecobotics.com/artisan-collective", label);
  expectSingleMeta(html, "name", "twitter:title", artisanTitle, label);
  expectSingleMeta(html, "name", "twitter:description", artisanDescription, label);
  verifyImageMetadata(html, label);
}

async function readText(relativePath) {
  return fs.readFile(path.join(repositoryRoot, relativePath), "utf8");
}

async function readBytes(relativePath) {
  return fs.readFile(path.join(repositoryRoot, relativePath));
}

function verifyPng(bytes, label) {
  assert.equal(sha256(bytes), expectedImageSha256, `${label} does not match the approved SHA-256.`);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${label} is not a PNG.`);
  assert.equal(bytes.readUInt32BE(16), 1733, `${label} has an incorrect width.`);
  assert.equal(bytes.readUInt32BE(20), 907, `${label} has an incorrect height.`);
}

const [homepageHtml, artisanHtml, publicImage, metadataHelper, siteUrls] = await Promise.all([
  readText("index.html"),
  readText("artisan-collective.html"),
  readBytes("public/images/social/Elysia_Ecobotics_Link_Image.png"),
  readText("src/shared/components/PageMetadata.tsx"),
  readText("src/config/siteUrls.ts")
]);

verifyHomepage(homepageHtml, "index.html");
verifyArtisan(artisanHtml, "artisan-collective.html");
verifyPng(publicImage, "public social-preview image");

assert.match(siteUrls, /ELYSIA_ECOBOTICS_SOCIAL_PREVIEW_IMAGE_URL/, "The social-preview URL must live in the existing URL registry.");
assert.match(metadataHelper, /ELYSIA_ECOBOTICS_SOCIAL_PREVIEW_IMAGE_URL/, "PageMetadata must consume the registered social-preview URL.");
for (const marker of [
  'meta[property="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[property="og:image:type"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'meta[property="og:image:alt"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:alt"]',
  "summary_large_image"
]) assert(metadataHelper.includes(marker), `PageMetadata is missing ${marker}.`);

if (verifyBuiltArtifacts) {
  const [builtHomepageHtml, builtArtisanHtml, builtImage] = await Promise.all([
    readText("dist/index.html"),
    readText("dist/artisan-collective.html"),
    readBytes("dist/images/social/Elysia_Ecobotics_Link_Image.png")
  ]);
  verifyHomepage(builtHomepageHtml, "dist/index.html");
  verifyArtisan(builtArtisanHtml, "dist/artisan-collective.html");
  verifyPng(builtImage, "built social-preview image");
}

console.log(`Social-preview metadata and ${verifyBuiltArtifacts ? "source/built" : "source"} asset contract ok.`);
