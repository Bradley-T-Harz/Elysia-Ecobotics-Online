import {
  hasSupabaseConfig,
  supabase,
  supabaseNotConfiguredMessage,
} from "../The-Elysia-Marketplace/lib/supabase";

export type PublicCommuneAttributionTarget =
  | "post"
  | "comment"
  | "realtime_message";

export type PublicCommuneAttribution = {
  target_type: PublicCommuneAttributionTarget;
  target_id: string;
  author_handle: string;
  canonical_profile_url: string;
  viewer_is_owner: boolean;
};

const handlePattern =
  /^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/;
const contentIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targetTypes = new Set<PublicCommuneAttributionTarget>([
  "post",
  "comment",
  "realtime_message",
]);

function boundedIds(values: string[]) {
  return [...new Set(values.filter((value) => contentIdPattern.test(value)))].slice(
    0,
    100,
  );
}

function normalizeAttribution(
  value: Partial<PublicCommuneAttribution>,
): PublicCommuneAttribution | null {
  const targetType = String(
    value.target_type ?? "",
  ) as PublicCommuneAttributionTarget;
  const targetId = String(value.target_id ?? "");
  const handle = String(value.author_handle ?? "").toLowerCase();
  const canonicalProfileUrl = String(value.canonical_profile_url ?? "");
  if (
    !targetTypes.has(targetType)
    || !contentIdPattern.test(targetId)
    || !handlePattern.test(handle)
    || canonicalProfileUrl
      !== `https://elysiaecobotics.com/commons-circle/@${handle}`
  ) {
    return null;
  }
  return {
    target_type: targetType,
    target_id: targetId,
    author_handle: handle,
    canonical_profile_url: canonicalProfileUrl,
    viewer_is_owner: value.viewer_is_owner === true,
  };
}

export async function loadPublicCommuneAttributions(input: {
  postIds?: string[];
  commentIds?: string[];
  realtimeMessageIds?: string[];
}): Promise<{
  attributions: PublicCommuneAttribution[];
  warnings: string[];
}> {
  if (!hasSupabaseConfig || !supabase) {
    return { attributions: [], warnings: [supabaseNotConfiguredMessage] };
  }
  const postIds = boundedIds(input.postIds ?? []);
  const commentIds = boundedIds(input.commentIds ?? []);
  const realtimeMessageIds = boundedIds(input.realtimeMessageIds ?? []);
  if (!postIds.length && !commentIds.length && !realtimeMessageIds.length) {
    return { attributions: [], warnings: [] };
  }
  const { data, error } = await supabase.rpc(
    "resolve_public_commune_attributions",
    {
      p_post_ids: postIds,
      p_comment_ids: commentIds,
      p_realtime_message_ids: realtimeMessageIds,
    },
  );
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[Commune public attribution]", error.message);
    }
    return {
      attributions: [],
      warnings: [
        "Current public author attribution is temporarily unavailable.",
      ],
    };
  }
  return {
    attributions: ((data ?? []) as Partial<PublicCommuneAttribution>[])
      .map(normalizeAttribution)
      .filter(
        (value): value is PublicCommuneAttribution => value !== null,
      ),
    warnings: [],
  };
}

export function attributionMap(
  values: PublicCommuneAttribution[],
  targetType: PublicCommuneAttributionTarget,
) {
  return new Map(
    values
      .filter((value) => value.target_type === targetType)
      .map((value) => [value.target_id, value]),
  );
}
