import { loadCurrentRoleState, type AppRole } from "../../shared/review/reviewClient";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { attributionMap, loadPublicCommuneAttributions } from "./communeAttribution";

export type RealtimePostingMode = "open_signed_in" | "members_only" | "read_only" | "moderated" | "disabled";
export type RealtimeVisibilityState = "published" | "flagged" | "hidden" | "removed" | "archived";
export type RealtimeConnectionStatus = "backend inactive" | "loading" | "live" | "reconnecting" | "manual refresh mode";

export type RealtimeRoom = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  visibility_state: "published" | "hidden" | "archived" | "removed";
  posting_mode: RealtimePostingMode;
  slow_mode_seconds: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RealtimeMessage = {
  id: string;
  room_id: string;
  room_slug?: string | null;
  author_user_id?: string;
  author_username?: string | null;
  author_profile_url?: string | null;
  viewer_is_owner?: boolean;
  body: string;
  body_plain?: string | null;
  visibility_state: RealtimeVisibilityState;
  report_count: number;
  created_at: string;
  edited_at?: string | null;
  flagged_at?: string | null;
  hidden_at?: string | null;
  removed_at?: string | null;
  moderation_reason?: string | null;
};

export type RealtimeReport = {
  id: string;
  message_id: string;
  room_id?: string | null;
  reporter_user_id?: string | null;
  reason: string;
  detail?: string | null;
  report_status: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reviewer_note?: string | null;
  message?: RealtimeMessage | null;
  room?: RealtimeRoom | null;
};

export type RealtimeAccountState = {
  signedIn: boolean;
  userId: string | null;
  username: string | null;
  isModerator: boolean;
  roles: AppRole[];
  warnings: string[];
};

export const realtimeReportReasons = [
  "spam",
  "harassment",
  "unsafe_code",
  "secret_or_private_data",
  "misinformation",
  "copyright_or_license",
  "malware_or_suspicious",
  "privacy_violation",
  "other"
] as const;

const maxChatLength = 2000;
const secretLikePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "environment file reference", pattern: /\.env\b/i },
  { label: "API key wording", pattern: /API[_ -]?KEY/i },
  { label: "secret wording", pattern: /\bSECRET\b/i },
  { label: "token wording", pattern: /\bTOKEN\b/i },
  { label: "password wording", pattern: /PASSWORD/i },
  { label: "private key wording", pattern: /PRIVATE KEY|BEGIN [A-Z ]*PRIVATE KEY/i },
  { label: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9_-]{12,}/i },
  { label: "GitHub token", pattern: /\b(ghp_|github_pat_)[A-Za-z0-9_]{8,}/i },
  { label: "AWS key variable", pattern: /AWS_ACCESS_KEY_ID/i },
  { label: "Supabase service role reference", pattern: /SUPABASE_SERVICE_ROLE|service_role/i },
  { label: "local home path", pattern: /\/home\//i },
  { label: "Windows local path", pattern: /\b[A-Z]:\\/i },
  { label: "vault reference", pattern: /\bvault\b/i },
  { label: "credentials reference", pattern: /credentials/i }
];

function isModeratorRole(roles: AppRole[], isAdmin: boolean) {
  return isAdmin || roles.some((role) => ["administrator", "moderator", "reviewer", "commune_moderator", "guardian_reviewer"].includes(role));
}

export function sanitizeChatMessageInput(body: string) {
  return body.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{4,}/g, "\n\n\n").trim();
}

export function detectSecretLikeChatText(body: string) {
  const labels = new Set<string>();
  for (const item of secretLikePatterns) if (item.pattern.test(body)) labels.add(item.label);
  return [...labels];
}

export function validateChatMessageInput(body: string): { ok: boolean; message?: string; sanitized: string; secretWarnings: string[] } {
  const sanitized = sanitizeChatMessageInput(body);
  const secretWarnings = detectSecretLikeChatText(sanitized);
  if (!sanitized) return { ok: false, message: "Write a message before sending.", sanitized, secretWarnings };
  if (sanitized.length > maxChatLength) return { ok: false, message: `Messages must be ${maxChatLength} characters or fewer.`, sanitized, secretWarnings };
  if (/<\s*\/?\s*script|<\s*iframe|javascript:/i.test(sanitized)) return { ok: false, message: "HTML/script-like content is not allowed in Commune chat. Use plain text only.", sanitized, secretWarnings };
  if (secretWarnings.length) return { ok: false, message: "This looks like it may contain secrets or private local material. Remove it before posting.", sanitized, secretWarnings };
  return { ok: true, sanitized, secretWarnings };
}

export function formatSafeChatError(error?: { message?: string } | null) {
  if (!error?.message) return "Chat action could not be completed.";
  if (import.meta.env.DEV) console.warn("[Commune realtime]", error.message);
  if (/schema cache|Could not find|does not exist|relation/i.test(error.message)) return "Realtime chat tables are not active until the latest Supabase migration is applied.";
  if (/permission denied|row-level security|violates row-level security|JWT/i.test(error.message)) return "Your current account cannot use that chat action yet.";
  if (/check constraint|commune_realtime_message_body/i.test(error.message)) return "Message blocked by chat safety limits.";
  return "Chat action could not be completed.";
}

export async function loadRealtimeAccountState(): Promise<RealtimeAccountState> {
  const roleState = await loadCurrentRoleState();
  if (!hasSupabaseConfig || !supabase || !roleState.signedIn || !roleState.userId) {
    return { signedIn: roleState.signedIn, userId: roleState.userId, username: null, roles: roleState.roles, isModerator: isModeratorRole(roleState.roles, roleState.isAdmin), warnings: roleState.warnings };
  }
  const { data, error } = await supabase.from("profiles").select("username").eq("id", roleState.userId).maybeSingle();
  return { signedIn: true, userId: roleState.userId, username: (data as { username?: string } | null)?.username ?? null, roles: roleState.roles, isModerator: isModeratorRole(roleState.roles, roleState.isAdmin), warnings: error ? [...roleState.warnings, formatSafeChatError(error)] : roleState.warnings };
}

export async function listRealtimeRooms(): Promise<{ rooms: RealtimeRoom[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { rooms: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_realtime_rooms").select("id,slug,title,description,visibility_state,posting_mode,slow_mode_seconds,created_at,updated_at").eq("visibility_state", "published").order("title");
  return { rooms: (data ?? []) as RealtimeRoom[], warnings: error ? [formatSafeChatError(error)] : [] };
}

export async function listRecentMessages(roomId: string, limit = 60): Promise<{ messages: RealtimeMessage[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { messages: [], warnings: [supabaseNotConfiguredMessage] };
  const { data, error } = await supabase.from("commune_realtime_messages").select("id,room_id,room_slug,body,body_plain,visibility_state,report_count,created_at,edited_at,flagged_at,hidden_at,removed_at").eq("room_id", roomId).eq("visibility_state", "published").order("created_at", { ascending: false }).limit(limit);
  if (error) return { messages: [], warnings: [formatSafeChatError(error)] };
  const messages = (data ?? []) as RealtimeMessage[];
  const attributionResult = await loadPublicCommuneAttributions({
    realtimeMessageIds: messages.map((message) => message.id)
  });
  const attributions = attributionMap(
    attributionResult.attributions,
    "realtime_message"
  );
  return {
    messages: messages.map((message) => {
      const attribution = attributions.get(message.id);
      return {
        ...message,
        author_user_id: undefined,
        author_username: attribution?.author_handle ?? null,
        author_profile_url: attribution?.canonical_profile_url ?? null,
        viewer_is_owner: attribution?.viewer_is_owner ?? false
      };
    }).reverse(),
    warnings: attributionResult.warnings
  };
}

export function subscribeToRoomMessages(roomId: string, callbacks: { onInsert: (message: RealtimeMessage) => void; onStatus?: (status: RealtimeConnectionStatus) => void; onError?: (message: string) => void }) {
  if (!hasSupabaseConfig || !supabase) {
    callbacks.onStatus?.("backend inactive");
    return { unsubscribe: () => undefined };
  }
  const client = supabase;
  const channel = client.channel(`commune-room-${roomId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "commune_realtime_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
      const message = payload.new as RealtimeMessage;
      if (message.visibility_state === "published") {
        void loadPublicCommuneAttributions({
          realtimeMessageIds: [message.id]
        }).then(({ attributions }) => {
          const attribution = attributionMap(
            attributions,
            "realtime_message"
          ).get(message.id);
          callbacks.onInsert({
            ...message,
            author_user_id: undefined,
            author_username: attribution?.author_handle ?? null,
            author_profile_url: attribution?.canonical_profile_url ?? null,
            viewer_is_owner: attribution?.viewer_is_owner ?? false
          });
        }).catch(() => callbacks.onInsert({
          ...message,
          author_user_id: undefined,
          author_username: null,
          author_profile_url: null,
          viewer_is_owner: false
        }));
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") callbacks.onStatus?.("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") callbacks.onStatus?.("manual refresh mode");
      else callbacks.onStatus?.("reconnecting");
    });
  return { unsubscribe: () => { void client.removeChannel(channel); } };
}

async function writeRealtimeEvent(input: { roomId?: string | null; messageId?: string | null; action: string; reason?: string | null; metadata?: Record<string, unknown> }) {
  if (!supabase) return;
  const account = await loadRealtimeAccountState();
  if (!account.userId) return;
  const { error } = await supabase.from("commune_room_moderation_events").insert({ room_id: input.roomId || null, message_id: input.messageId || null, actor_user_id: account.userId, action: input.action, reason: input.reason || null, metadata: input.metadata ?? {} });
  if (error && import.meta.env.DEV) console.warn("[Commune realtime event]", error.message);
}

export async function sendRealtimeMessage(room: RealtimeRoom, body: string): Promise<{ ok: boolean; message: string; row?: RealtimeMessage }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Realtime chat backend is not active yet. Local drafts and forum-style posts remain available." };
  const account = await loadRealtimeAccountState();
  if (!account.userId) return { ok: false, message: "Sign in to post Commune realtime messages." };
  if (!["open_signed_in", "members_only"].includes(room.posting_mode)) return { ok: false, message: `This room is currently ${room.posting_mode.replace(/_/g, " ")}.` };
  const validation = validateChatMessageInput(body);
  if (!validation.ok) return { ok: false, message: validation.message ?? "Message blocked.", row: undefined };
  const { data, error } = await supabase.from("commune_realtime_messages").insert({ room_id: room.id, room_slug: room.slug, author_user_id: account.userId, body: validation.sanitized, body_plain: validation.sanitized, visibility_state: "published" }).select("id,room_id,room_slug,body,body_plain,visibility_state,report_count,created_at,edited_at,flagged_at,hidden_at,removed_at").single();
  if (error) return { ok: false, message: formatSafeChatError(error) };
  await writeRealtimeEvent({ roomId: room.id, messageId: (data as RealtimeMessage).id, action: "message_created", metadata: { source: "commune_realtime_ui" } });
  return {
    ok: true,
    message: "Message posted as public/community cloud chat data.",
    row: {
      ...(data as RealtimeMessage),
      author_user_id: undefined,
      author_username: account.username?.toLowerCase() ?? null,
      author_profile_url: account.username
        ? `https://elysiaecobotics.com/commons-circle/@${account.username.toLowerCase()}`
        : null,
      viewer_is_owner: true
    }
  };
}

export async function reportRealtimeMessage(message: RealtimeMessage, reason: string, detail: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Realtime report backend is not active yet." };
  const account = await loadRealtimeAccountState();
  if (!account.userId) return { ok: false, message: "Sign in to report chat messages." };
  const { error } = await supabase.from("commune_realtime_reports").insert({ message_id: message.id, room_id: message.room_id, reporter_user_id: account.userId, reason, detail: detail.trim() || null, report_status: "open" });
  if (error) return { ok: false, message: formatSafeChatError(error) };
  await writeRealtimeEvent({ roomId: message.room_id, messageId: message.id, action: "message_reported", reason, metadata: { source: "commune_realtime_ui" } });
  return { ok: true, message: "Report sent privately to moderators. Reporting does not automatically remove the message." };
}

export async function hideRealtimeMessage(messageId: string, reason: string): Promise<{ ok: boolean; message: string }> {
  return updateRealtimeMessageVisibility(messageId, "hidden", "message_hidden", reason);
}

export async function removeRealtimeMessage(messageId: string, reason: string): Promise<{ ok: boolean; message: string }> {
  return updateRealtimeMessageVisibility(messageId, "removed", "message_removed", reason);
}

async function updateRealtimeMessageVisibility(messageId: string, visibility: "hidden" | "removed" | "flagged", action: string, reason: string) {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Realtime moderation backend is not active yet." };
  const timestampColumn = visibility === "hidden" ? "hidden_at" : visibility === "removed" ? "removed_at" : "flagged_at";
  const { data: existing } = await supabase.from("commune_realtime_messages").select("room_id").eq("id", messageId).maybeSingle();
  const { error } = await supabase.from("commune_realtime_messages").update({ visibility_state: visibility, [timestampColumn]: new Date().toISOString(), moderation_reason: reason.trim() || null }).eq("id", messageId);
  if (error) return { ok: false, message: formatSafeChatError(error) };
  await writeRealtimeEvent({ roomId: (existing as { room_id?: string } | null)?.room_id ?? null, messageId, action, reason, metadata: { source: "commune_realtime_moderation" } });
  return { ok: true, message: `Message marked ${visibility}.` };
}

export async function updateRoomSlowMode(roomId: string, seconds: number): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Realtime room backend is not active yet." };
  const value = Math.max(0, Math.min(3600, Math.floor(seconds || 0)));
  const { error } = await supabase.from("commune_realtime_rooms").update({ slow_mode_seconds: value, updated_at: new Date().toISOString() }).eq("id", roomId);
  if (error) return { ok: false, message: formatSafeChatError(error) };
  await writeRealtimeEvent({ roomId, action: "room_slow_mode_updated", metadata: { slow_mode_seconds: value } });
  return { ok: true, message: `Slow mode updated to ${value} seconds.` };
}

export async function updateRoomPostingMode(roomId: string, mode: RealtimePostingMode): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Realtime room backend is not active yet." };
  const { error } = await supabase.from("commune_realtime_rooms").update({ posting_mode: mode, updated_at: new Date().toISOString() }).eq("id", roomId);
  if (error) return { ok: false, message: formatSafeChatError(error) };
  await writeRealtimeEvent({ roomId, action: "room_posting_mode_updated", metadata: { posting_mode: mode } });
  return { ok: true, message: `Posting mode updated to ${mode.replace(/_/g, " ")}.` };
}

export async function listRealtimeReports(): Promise<{ reports: RealtimeReport[]; rooms: RealtimeRoom[]; warnings: string[] }> {
  if (!hasSupabaseConfig || !supabase) return { reports: [], rooms: [], warnings: [supabaseNotConfiguredMessage] };
  const warnings: string[] = [];
  const [{ data: reports, error: reportError }, { data: rooms, error: roomError }] = await Promise.all([
    supabase.from("commune_realtime_reports").select("id,message_id,room_id,reporter_user_id,reason,detail,report_status,created_at,reviewed_at,reviewed_by,reviewer_note").in("report_status", ["open", "under_review"]).order("created_at", { ascending: false }).limit(80),
    supabase.from("commune_realtime_rooms").select("id,slug,title,description,visibility_state,posting_mode,slow_mode_seconds,created_at,updated_at").order("title")
  ]);
  if (reportError) warnings.push(formatSafeChatError(reportError));
  if (roomError) warnings.push(formatSafeChatError(roomError));
  const reportRows = (reports ?? []) as RealtimeReport[];
  const messageIds = reportRows.map((report) => report.message_id).filter(Boolean);
  let messages: RealtimeMessage[] = [];
  if (messageIds.length) {
    const { data, error } = await supabase.from("commune_realtime_messages").select("id,room_id,room_slug,author_user_id,body,body_plain,visibility_state,report_count,created_at,edited_at,flagged_at,hidden_at,removed_at,moderation_reason").in("id", messageIds);
    if (error) warnings.push(formatSafeChatError(error));
    messages = (data ?? []) as RealtimeMessage[];
  }
  const roomRows = (rooms ?? []) as RealtimeRoom[];
  return {
    rooms: roomRows,
    warnings,
    reports: reportRows.map((report) => ({ ...report, message: messages.find((message) => message.id === report.message_id) ?? null, room: roomRows.find((room) => room.id === report.room_id) ?? null }))
  };
}

export async function updateRealtimeReportStatus(reportId: string, status: "under_review" | "action_taken" | "dismissed" | "archived", note: string): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseConfig || !supabase) return { ok: false, message: "Realtime report backend is not active yet." };
  const account = await loadRealtimeAccountState();
  if (!account.userId || !account.isModerator) return { ok: false, message: "Realtime report moderation requires an assigned moderator/admin role." };
  const { error } = await supabase.from("commune_realtime_reports").update({ report_status: status, reviewer_note: note.trim() || null, reviewed_by: account.userId, reviewed_at: new Date().toISOString() }).eq("id", reportId);
  if (error) return { ok: false, message: formatSafeChatError(error) };
  return { ok: true, message: `Realtime report marked ${status.replace(/_/g, " ")}.` };
}
