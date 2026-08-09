import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { communeLinkPresentation, parseCommuneLinksInput, safeCommuneLinkHref } from "../src/shared/communeLinks.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");
const [page, api, reviewClient, adminPage, styles, schema] = await Promise.all([
  read("src/pages/The-Elysia-Commune/index.tsx"),
  read("src/pages/The-Elysia-Commune/communeAccountApi.ts"),
  read("src/shared/review/reviewClient.ts"),
  read("src/pages/Admin/index.tsx"),
  read("src/styles.css"),
  read("supabase/schema.sql"),
]);

const first = "https://example.com/first?keep=One%20Two";
const second = "http://example.org/second#fragment";
const third = "https://example.net/third/";
assert.deepEqual(
  parseCommuneLinksInput(`  ${first}  \n\n ${second}\n   \n${third} `),
  [first, second, third],
  "newline parsing must trim, ignore blank lines, and preserve order without rewriting URLs",
);
assert.deepEqual(parseCommuneLinksInput(first), [first], "one-link input must remain compatible");
assert.deepEqual(parseCommuneLinksInput(`${first}, ${second}`), [first, second], "legacy comma-separated input must remain compatible");
assert.deepEqual(parseCommuneLinksInput("\n , \n"), [], "blank input must not create payload entries");
assert.equal(safeCommuneLinkHref(first), first, "valid HTTPS links should render as links without rewriting");
assert.equal(safeCommuneLinkHref(second), second, "valid HTTP links should render as links without rewriting");
assert.equal(safeCommuneLinkHref("mailto:person@example.com"), null, "non-HTTP stored values must render as text, not unsafe anchors");
assert.equal(safeCommuneLinkHref("not a url"), null, "legacy arbitrary text must render safely as text");
assert.deepEqual(communeLinkPresentation("The Elysia Commune | https://elysiaecobotics.com/commune"), { label: "The Elysia Commune", href: "https://elysiaecobotics.com/commune" }, "labeled HTTP(S) links should hide the raw URL while preserving the safe destination");
assert.deepEqual(communeLinkPresentation(first), { label: first, href: first }, "unlabeled legacy URLs must remain clickable and unchanged");
assert.deepEqual(communeLinkPresentation("Unsafe label | javascript:alert(1)"), { label: "Unsafe label | javascript:alert(1)", href: null }, "unsafe labeled destinations must remain inert text");
assert.deepEqual(communeLinkPresentation("Malformed label | not a url"), { label: "Malformed label | not a url", href: null }, "malformed labeled values must remain visible inert text");

assert(page.includes("function CommuneLinksField"), "shared Links field component missing");
assert.equal((page.match(/<CommuneLinksField\b/g) ?? []).length, 2, "PostComposer and CommunityVoteComposer must share exactly one Links field implementation");
assert(page.includes('<textarea id={id} rows={4}') && page.includes("One link per line."), "Links field must be a labeled multiline textarea with concise guidance");
assert(page.includes("aria-describedby={descriptionId}"), "Links helper must be programmatically associated");
assert(!page.includes('<span>Links</span><input'), "no generic single-line Links input may remain");
const sharedField = page.slice(page.indexOf("function CommuneLinksField"), page.indexOf("function CommuneLinksList"));
assert(!/onKeyDown|preventDefault|onSubmit/.test(sharedField), "Links textarea must keep native Enter and Shift+Enter behavior");
assert(page.includes('<CommuneLinksList links={form.links} label="Links preview"'), "both composers must preview parsed links");
assert(page.includes("<CommuneLinksList links={additionalLinks}"), "post detail must render submitted generic links");
assert(page.includes("<CommuneLinksList links={item.links} label=\"Submitted links\""), "Commune moderation must render submitted links");
assert(reviewClient.includes("content_links: row.links ?? []"), "shared admin review enrichment must carry the stored link array");
assert(adminPage.includes("selectedItem.content_links?.length") && adminPage.includes("safeCommuneLinkHref"), "admin review detail must render submitted links safely");

const sharedPostComposerRooms = [
  "media_garden",
  "troubleshooting",
  "code_sharing",
  "community_network",
  "job_post",
  "research_note",
  "elysia_iteration_showcase",
  "official_update",
];
for (const postType of sharedPostComposerRooms) {
  assert(page.includes(`backendValue: "${postType}"`), `missing shared PostComposer room: ${postType}`);
}
assert(page.includes('type.backendValue === "community_vote"') && page.includes("<CommunityVoteComposer"), "Community Voting Room must retain its separate composer while using the shared Links field");
assert(page.includes('type.backendValue === "repository_showcase"') && page.includes("<RepositoryShowcaseForm"), "Repository Showcase must retain its dedicated creation form");
assert(page.includes("Repo URL") && !page.slice(page.indexOf("function RepositoryShowcaseForm"), page.indexOf("function LocalDraftStudio")).includes("<CommuneLinksField"), "Repository Showcase's purpose-specific single Repo URL must not be changed into the generic Links field");

for (const helper of [
  "submitOfficialUpdate",
  "submitCommunityVotePost",
  "submitTroubleshootingPost",
  "submitJobPost",
  "submitResearchNotesPost",
  "submitCommunePost",
  "submitIterationShowcase",
]) {
  const start = api.indexOf(`export async function ${helper}`);
  assert(start >= 0, `missing submit helper: ${helper}`);
  const next = api.indexOf("export async function ", start + 24);
  const source = api.slice(start, next < 0 ? api.length : next);
  assert(/splitList\(input\.links/.test(source), `${helper} must normalize Links through the shared parser`);
  assert(/\blinks[:,]/.test(source), `${helper} must preserve an array-shaped downstream Links payload`);
}
assert(api.includes("function splitList(value: string) { return parseCommuneLinksInput(value); }"), "all existing submit paths must delegate to the shared compatibility parser");
assert(/links\s+text\[\]/i.test(schema), "commune_posts Links storage must remain a text array");
assert(!api.includes("alter table") && !page.includes("alter table"), "application repair must not perform a schema mutation");
assert(styles.includes('.commune-form-grid textarea[id$="-links"]') && styles.includes("resize: vertical"), "Links textarea must have responsive, user-resizable styling");

console.log("Commune multiline Links contract passed for all creation, payload, review, and rendering paths.");
