export type CommuneFeedRoomDefinition<PostType extends string = string> = {
  postType: PostType;
  slug: string;
  name: string;
  purpose: string;
  href: string;
};

export type CommuneFeedPost = {
  id: string;
  post_type: string;
  published_at?: string | null;
  created_at?: string | null;
};

export type CommuneFeedRoomGroup<Post extends CommuneFeedPost, PostType extends string = string> = {
  room: CommuneFeedRoomDefinition<PostType>;
  posts: Post[];
};

export type CommuneFeedGrouping<Post extends CommuneFeedPost, PostType extends string = string> = {
  groups: CommuneFeedRoomGroup<Post, PostType>[];
  representedPostCount: number;
  unknownPosts: Post[];
  duplicatePostIds: string[];
};

function timestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function compareCommuneFeedPostsNewestFirst(a: CommuneFeedPost, b: CommuneFeedPost) {
  const aPublished = timestamp(a.published_at);
  const bPublished = timestamp(b.published_at);
  if (aPublished !== null || bPublished !== null) {
    if (aPublished === null) return 1;
    if (bPublished === null) return -1;
    if (aPublished !== bPublished) return bPublished - aPublished;
  }

  const aCreated = timestamp(a.created_at);
  const bCreated = timestamp(b.created_at);
  if (aCreated !== null || bCreated !== null) {
    if (aCreated === null) return 1;
    if (bCreated === null) return -1;
    if (aCreated !== bCreated) return bCreated - aCreated;
  }

  return a.id.localeCompare(b.id);
}

export function groupCommuneFeedPosts<
  Post extends CommuneFeedPost,
  PostType extends string = string,
>(posts: readonly Post[], rooms: readonly CommuneFeedRoomDefinition<PostType>[]): CommuneFeedGrouping<Post, PostType> {
  const groups = rooms.map((room) => ({ room, posts: [] as Post[] }));
  const groupByPostType = new Map(groups.map((group) => [group.room.postType, group]));
  const seenPostIds = new Set<string>();
  const duplicatePostIds: string[] = [];
  const unknownPosts: Post[] = [];

  for (const post of posts) {
    if (seenPostIds.has(post.id)) {
      if (!duplicatePostIds.includes(post.id)) duplicatePostIds.push(post.id);
      continue;
    }
    seenPostIds.add(post.id);

    const group = groupByPostType.get(post.post_type as PostType);
    if (!group) {
      unknownPosts.push(post);
      continue;
    }
    group.posts.push(post);
  }

  for (const group of groups) group.posts.sort(compareCommuneFeedPostsNewestFirst);

  return {
    groups,
    representedPostCount: groups.reduce((total, group) => total + group.posts.length, 0),
    unknownPosts,
    duplicatePostIds,
  };
}
