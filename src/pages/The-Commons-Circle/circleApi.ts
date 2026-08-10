import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";

export type CircleProfileCard = {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  shortPublicBio: string | null;
  profileUrl: string;
};

export type CircleRelationshipItem = {
  relationshipId: string;
  status: "pending" | "accepted";
  profile: CircleProfileCard;
  createdAt?: string | null;
  acceptedAt?: string | null;
};

export type CircleOverview = {
  accepted: CircleRelationshipItem[];
  incoming: CircleRelationshipItem[];
  sent: CircleRelationshipItem[];
  counts: { accepted: number; incoming: number; sent: number };
};

export type CircleAccessReviewPost = {
  accessId: string;
  postId: string;
  title: string;
  postType: string;
  postUrl: string;
  sharedAt: string | null;
};

export type CircleAccessReviewMember = {
  relationshipId: string;
  profile: CircleProfileCard;
  privatePostCount: number;
  posts: CircleAccessReviewPost[];
};

export type CircleAccessReview = {
  members: CircleAccessReviewMember[];
  counts: { formerMembers: number; privatePosts: number };
};

export type CircleHandleState = {
  state: "self" | "can_invite" | "sent" | "incoming" | "accepted" | "unavailable";
  relationshipId: string | null;
};

const emptyOverview: CircleOverview = {
  accepted: [], incoming: [], sent: [], counts: { accepted: 0, incoming: 0, sent: 0 },
};
export const emptyCircleAccessReview: CircleAccessReview = {
  members: [], counts: { formerMembers: 0, privatePosts: 0 },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeText(value: unknown) { return typeof value === "string" ? value : ""; }
function safeNullableText(value: unknown) { return typeof value === "string" && value ? value : null; }
function safeCount(value: unknown) { const count = Number(value); return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0; }

function normalizeProfile(value: unknown): CircleProfileCard | null {
  const source = record(value);
  const handle = safeText(source.handle);
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(handle)) return null;
  return {
    handle,
    displayName: safeNullableText(source.displayName),
    avatarUrl: safeNullableText(source.avatarUrl),
    shortPublicBio: safeNullableText(source.shortPublicBio),
    profileUrl: safeText(source.profileUrl) || `/commons-circle/@${handle}`,
  };
}

function normalizeItem(value: unknown): CircleRelationshipItem | null {
  const source = record(value);
  const relationshipId = safeText(source.relationshipId);
  const profile = normalizeProfile(source.profile);
  const status = source.status === "accepted" ? "accepted" : source.status === "pending" ? "pending" : null;
  if (!/^[0-9a-f-]{36}$/i.test(relationshipId) || !profile || !status) return null;
  return {
    relationshipId,
    status,
    profile,
    createdAt: safeNullableText(source.createdAt),
    acceptedAt: safeNullableText(source.acceptedAt),
  };
}

function normalizeList(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeItem).filter((item): item is CircleRelationshipItem => Boolean(item)) : [];
}

function normalizeAccessReviewPost(value: unknown): CircleAccessReviewPost | null {
  const source = record(value);
  const accessId = safeText(source.accessId);
  const postId = safeText(source.postId);
  const title = safeText(source.title);
  const postUrl = safeText(source.postUrl);
  if (!/^[0-9a-f-]{36}$/i.test(accessId) || !/^[0-9a-f-]{36}$/i.test(postId) || !title || postUrl !== `/commune/posts/${postId}`) return null;
  return {
    accessId,
    postId,
    title,
    postType: safeText(source.postType),
    postUrl,
    sharedAt: safeNullableText(source.sharedAt),
  };
}

function normalizeAccessReviewMember(value: unknown): CircleAccessReviewMember | null {
  const source = record(value);
  const relationshipId = safeText(source.relationshipId);
  const profile = normalizeProfile(source.profile);
  const posts = Array.isArray(source.posts)
    ? source.posts.map(normalizeAccessReviewPost).filter((post): post is CircleAccessReviewPost => Boolean(post))
    : [];
  if (!/^[0-9a-f-]{36}$/i.test(relationshipId) || !profile || !posts.length) return null;
  return { relationshipId, profile, privatePostCount: posts.length, posts };
}

function messageFor(error: string, fallback: string) {
  if (/authentication_required|JWT|not authenticated/i.test(error)) return "Sign in to use Your Circle.";
  if (/profile_unavailable/i.test(error)) return "This public profile is not currently available for Circle invitations.";
  if (/self_invitation/i.test(error)) return "You cannot invite your own account to your Circle.";
  if (/response_forbidden|remove_forbidden|row-level security|permission denied/i.test(error)) return "That Circle action is not authorized for this account.";
  return fallback;
}

export async function loadCurrentUserCircle(): Promise<{ data: CircleOverview; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { data: emptyOverview, warnings: [supabaseNotConfiguredMessage] };
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) return { data: emptyOverview, warnings: ["Sign in to use Your Circle."] };
  const { data, error } = await supabase.rpc("current_user_circle");
  if (error) return { data: emptyOverview, warnings: [messageFor(error.message, "Your Circle is not available until the latest account migration is active.")] };
  const source = record(data);
  const counts = record(source.counts);
  return {
    data: {
      accepted: normalizeList(source.accepted),
      incoming: normalizeList(source.incoming),
      sent: normalizeList(source.sent),
      counts: { accepted: safeCount(counts.accepted), incoming: safeCount(counts.incoming), sent: safeCount(counts.sent) },
    },
    warnings: [],
  };
}

export async function loadCurrentUserCircleAccessReview(): Promise<{ data: CircleAccessReview; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { data: emptyCircleAccessReview, warnings: [supabaseNotConfiguredMessage] };
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) return { data: emptyCircleAccessReview, warnings: [] };
  const { data, error } = await supabase.rpc("current_user_circle_access_review");
  if (error) return { data: emptyCircleAccessReview, warnings: [messageFor(error.message, "Private-post access review is temporarily unavailable.")] };
  const source = record(data);
  const counts = record(source.counts);
  const members = Array.isArray(source.members)
    ? source.members.map(normalizeAccessReviewMember).filter((member): member is CircleAccessReviewMember => Boolean(member))
    : [];
  const privatePosts = members.reduce((total, member) => total + member.posts.length, 0);
  return {
    data: {
      members,
      counts: {
        formerMembers: members.length,
        privatePosts,
      },
    },
    warnings: safeCount(counts.formerMembers) === members.length && safeCount(counts.privatePosts) === privatePosts
      ? []
      : ["Access-review counts were normalized from the authoritative post list."],
  };
}

export async function loadCircleStateForHandle(handle: string): Promise<{ data: CircleHandleState; warning?: string }> {
  const unavailable: CircleHandleState = { state: "unavailable", relationshipId: null };
  if (!hasSupabaseConfig || !supabase) return { data: unavailable, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("commons_circle_state_for_handle", { p_handle: handle });
  if (error) return { data: unavailable, warning: messageFor(error.message, "Circle status is temporarily unavailable.") };
  const source = record(data);
  const state = safeText(source.state);
  return {
    data: {
      state: ["self", "can_invite", "sent", "incoming", "accepted", "unavailable"].includes(state) ? state as CircleHandleState["state"] : "unavailable",
      relationshipId: safeNullableText(source.relationshipId),
    },
  };
}

async function circleMutation(name: string, parameters: Record<string, unknown>) {
  if (!supabase) return { ok: false, message: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) return { ok: false, message: messageFor(error.message, "The Circle action could not be completed.") };
  return { ok: true, message: "Circle updated.", data: record(data) };
}

export async function inviteToCircle(handle: string) {
  const result = await circleMutation("invite_to_commons_circle", { p_handle: handle });
  if (!result.ok) return result;
  return { ...result, message: result.data?.state === "accepted" ? "You are now mutual Circle members." : "Circle invitation sent." };
}

export async function respondToCircleInvitation(relationshipId: string, accept: boolean) {
  const result = await circleMutation("respond_to_commons_circle_invitation", { p_relationship_id: relationshipId, p_accept: accept });
  return result.ok ? { ...result, message: accept ? "Circle invitation accepted." : "Circle invitation declined." } : result;
}

export async function removeFromCircle(relationshipId: string) {
  const result = await circleMutation("remove_from_commons_circle", { p_relationship_id: relationshipId });
  if (!result.ok) return result;
  const remaining = safeCount(result.data?.remainingOwnedPrivatePostCount);
  return {
    ...result,
    message: remaining > 0
      ? `Removed from Your Circle. They still have access to ${remaining} private ${remaining === 1 ? "post" : "posts"} you own. Existing private-post access was not changed.`
      : "Removed from Your Circle.",
  };
}

export async function removeCircleAccessReviewParticipant(accessId: string) {
  const result = await circleMutation("remove_commune_post_circle_participant", { p_access_id: accessId });
  return result.ok
    ? { ...result, message: "Participant access removed from this private post. Other private-post access was not changed." }
    : { ...result, message: result.message || "Only the private-post owner can remove this access." };
}
