import assert from "node:assert/strict";
import {
  groupCommuneFeedPosts,
  type CommuneFeedRoomDefinition,
} from "../src/pages/The-Elysia-Commune/communeFeedGrouping.ts";

const rooms = [
  ["media_garden", "media-garden", "Media Garden"],
  ["troubleshooting", "troubleshooting-grove", "Troubleshooting Grove"],
  ["code_sharing", "coding-cornucopia", "Coding Cornucopia"],
  ["repository_showcase", "repository-showcase", "Repository Showcase"],
  ["community_network", "community-network", "Community Network"],
  ["job_post", "job-post", "Job Post"],
  ["research_note", "research-notes", "Research Notes"],
  ["elysia_iteration_showcase", "elysia-iteration-showcase", "Elysia Iteration Showcase"],
  ["community_vote", "community-vote", "Community Voting Room"],
  ["official_update", "official-updates", "Official Update"],
].map(([postType, slug, name]) => ({
  postType,
  slug,
  name,
  purpose: `${name} purpose`,
  href: `/commune/rooms/${slug}`,
})) satisfies CommuneFeedRoomDefinition[];

type FixturePost = {
  id: string;
  post_type: string;
  published_at?: string | null;
  created_at?: string | null;
  title: string;
  tags: string[];
};

function post(id: string, postType: string, publishedAt: string | null, title = id, tags: string[] = []): FixturePost {
  return {
    id,
    post_type: postType,
    published_at: publishedAt,
    created_at: publishedAt,
    title,
    tags,
  };
}

const onePerRoom = rooms.map((room, index) => post(
  `post-${index + 1}`,
  room.postType,
  `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
));
const complete = groupCommuneFeedPosts(onePerRoom, rooms);
assert.deepEqual(complete.groups.map((group) => group.room.name), rooms.map((room) => room.name), "all ten sections must retain canonical registry order");
assert.equal(complete.groups.length, 10, "every canonical room must render one section");
assert.equal(complete.representedPostCount, 10, "every valid post must be represented");
assert.equal(new Set(complete.groups.flatMap((group) => group.posts.map((item) => item.id))).size, 10, "each valid post must appear exactly once");
assert.deepEqual(complete.unknownPosts, [], "valid room values must not be dropped");

const misleadingTags = post("tag-truth", "job_post", "2026-08-20T12:00:00.000Z", "Research and troubleshooting in one title", ["research", "community-vote", "media-garden"]);
const tagTruth = groupCommuneFeedPosts([misleadingTags], rooms);
assert.deepEqual(tagTruth.groups.find((group) => group.room.postType === "job_post")?.posts.map((item) => item.id), ["tag-truth"], "authoritative post_type must decide membership");
assert.equal(tagTruth.groups.find((group) => group.room.postType === "research_note")?.posts.length, 0, "hashtags must not move a post into another room");

const chronological = groupCommuneFeedPosts([
  post("middle", "job_post", "2026-08-20T12:00:00.000Z"),
  post("missing-date", "job_post", null),
  post("newest", "job_post", "2026-08-21T12:00:00.000Z"),
  post("oldest", "job_post", "2026-08-19T12:00:00.000Z"),
], rooms);
assert.deepEqual(chronological.groups.find((group) => group.room.postType === "job_post")?.posts.map((item) => item.id), ["newest", "middle", "oldest", "missing-date"], "posts must be newest-first by canonical publication timestamp, with missing dates last");

const malformed = post("unknown", "made_up_room", "2026-08-22T12:00:00.000Z");
const duplicate = post("post-1", "research_note", "2026-08-23T12:00:00.000Z");
const guarded = groupCommuneFeedPosts([...onePerRoom, duplicate, malformed], rooms);
assert.deepEqual(guarded.duplicatePostIds, ["post-1"], "duplicate identifiers must be reported");
assert.deepEqual(guarded.unknownPosts.map((item) => item.id), ["unknown"], "unknown room identifiers must be reported without guessing");
assert.equal(guarded.representedPostCount, 10, "malformed and duplicate records must not inflate the represented count");
assert.equal(guarded.groups.flatMap((group) => group.posts).filter((item) => item.id === "post-1").length, 1, "a duplicate identifier must render only once");

const empty = groupCommuneFeedPosts([], rooms);
assert.equal(empty.groups.length, 10, "empty feeds must retain all ten room sections");
assert(empty.groups.every((group) => group.posts.length === 0), "empty room sections must stay compact and empty");
assert.equal(empty.representedPostCount, 0, "empty represented count must be zero");

console.log("Commune room-grouped feed data invariants passed.");
