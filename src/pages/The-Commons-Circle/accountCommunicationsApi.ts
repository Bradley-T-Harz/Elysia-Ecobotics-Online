import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";

export type AccountActorCard = {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type AccountEventCounts = {
  inboxNeedsAttention: number;
  inboxUnread: number;
  messagesUnread: number;
  notificationsUnread: number;
};

export type AccountRequestCounts = {
  total: number;
  pending: number;
  byDomain: Record<string, { total: number; pending: number }>;
};

export type AccountHomebaseCounts = {
  signedIn: boolean;
  supabaseConfigured: boolean;
  warnings: string[];
  events: AccountEventCounts;
  requests: AccountRequestCounts;
};

export type InboxView = "attention" | "messages" | "completed" | "archived" | "all";

export type InboxItem = {
  id: string;
  kind: "action" | "required_action" | "conversation_request" | "message";
  domain: string;
  sourceType: string;
  category: string;
  title: string;
  preview: string | null;
  deepLink: string;
  actionKind: string;
  priority: number;
  readAt: string | null;
  archivedAt: string | null;
  completedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  sourceAvailable: boolean;
  actor: AccountActorCard | null;
};

export type InboxCursor = { createdAt: string; id: string };

export type InboxResult = {
  signedIn: boolean;
  supabaseConfigured: boolean;
  warnings: string[];
  items: InboxItem[];
  counts: AccountEventCounts;
  cursor: InboxCursor | null;
};

export type RequestReviewState = "all" | "pending" | "resolved";

export type RequestReviewItem = {
  key: string;
  domain: string;
  sourceType: string;
  title: string;
  status: string;
  secondaryStatus: string | null;
  pending: boolean;
  deepLink: string;
  createdAt: string;
  updatedAt: string;
};

export type RequestReviewCursor = { updatedAt: string; key: string };

export type RequestReviewsResult = {
  signedIn: boolean;
  supabaseConfigured: boolean;
  warnings: string[];
  items: RequestReviewItem[];
  counts: AccountRequestCounts;
  hasMore: boolean;
  cursor: RequestReviewCursor | null;
};

const emptyEventCounts: AccountEventCounts = {
  inboxNeedsAttention: 0,
  inboxUnread: 0,
  messagesUnread: 0,
  notificationsUnread: 0,
};

const emptyRequestCounts: AccountRequestCounts = { total: 0, pending: 0, byDomain: {} };

function safeCount(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function normalizeEventCounts(value: unknown): AccountEventCounts {
  const row = asRecord(value);
  return {
    inboxNeedsAttention: safeCount(row.inboxNeedsAttention),
    inboxUnread: safeCount(row.inboxUnread),
    messagesUnread: safeCount(row.messagesUnread),
    notificationsUnread: safeCount(row.notificationsUnread),
  };
}

function normalizeRequestCounts(value: unknown): AccountRequestCounts {
  const row = asRecord(value);
  const domainRows = asRecord(row.byDomain);
  const byDomain = Object.fromEntries(Object.entries(domainRows).flatMap(([domain, counts]) => {
    const safeDomain = /^[a-z][a-z0-9_]{1,79}$/.test(domain) ? domain : null;
    if (!safeDomain) return [];
    const detail = asRecord(counts);
    return [[safeDomain, { total: safeCount(detail.total), pending: safeCount(detail.pending) }]];
  }));
  return { total: safeCount(row.total), pending: safeCount(row.pending), byDomain };
}

function normalizeActor(value: unknown): AccountActorCard | null {
  const actor = asRecord(value);
  if (!Object.keys(actor).length) return null;
  return {
    handle: asNullableText(actor.handle),
    displayName: asNullableText(actor.displayName),
    avatarUrl: asNullableText(actor.avatarUrl),
  };
}

function normalizeInboxItems(value: unknown): InboxItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const id = asText(row.id);
    const kind = asText(row.kind);
    const title = asText(row.title);
    const createdAt = asText(row.createdAt);
    if (!id || !title || !createdAt || !["action", "required_action", "conversation_request", "message"].includes(kind)) return [];
    return [{
      id,
      kind: kind as InboxItem["kind"],
      domain: asText(row.domain, "account"),
      sourceType: asText(row.sourceType, "account_event"),
      category: asText(row.category, "account_security"),
      title,
      preview: asNullableText(row.preview),
      deepLink: asText(row.deepLink),
      actionKind: asText(row.actionKind, "open_source"),
      priority: Math.min(100, Math.max(0, safeCount(row.priority))),
      readAt: asNullableText(row.readAt),
      archivedAt: asNullableText(row.archivedAt),
      completedAt: asNullableText(row.completedAt),
      supersededAt: asNullableText(row.supersededAt),
      createdAt,
      sourceAvailable: row.sourceAvailable !== false,
      actor: normalizeActor(row.actor),
    }];
  });
}

function normalizeRequestItems(value: unknown): RequestReviewItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const key = asText(row.key);
    const title = asText(row.title);
    const updatedAt = asText(row.updatedAt);
    if (!key || !title || !updatedAt) return [];
    return [{
      key,
      domain: asText(row.domain, "account"),
      sourceType: asText(row.sourceType, "account_request"),
      title,
      status: asText(row.status, "unknown"),
      secondaryStatus: asNullableText(row.secondaryStatus),
      pending: row.pending === true,
      deepLink: asText(row.deepLink),
      createdAt: asText(row.createdAt, updatedAt),
      updatedAt,
    }];
  });
}

async function currentUserId() {
  if (!hasSupabaseConfig || !supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function accountRpcWarning(scope: string) {
  return `${scope} is temporarily unavailable. Your source records and account permissions were not changed.`;
}

export async function loadAccountHomebaseCounts(): Promise<AccountHomebaseCounts> {
  if (!hasSupabaseConfig || !supabase) return {
    signedIn: false,
    supabaseConfigured: false,
    warnings: [supabaseNotConfiguredMessage],
    events: emptyEventCounts,
    requests: emptyRequestCounts,
  };
  if (!await currentUserId()) return {
    signedIn: false,
    supabaseConfigured: true,
    warnings: [],
    events: emptyEventCounts,
    requests: emptyRequestCounts,
  };
  const [eventResult, requestResult] = await Promise.all([
    supabase.rpc("current_user_event_counts"),
    supabase.rpc("current_user_request_counts"),
  ]);
  const warnings: string[] = [];
  if (eventResult.error) warnings.push(accountRpcWarning("Inbox and notification counts"));
  if (requestResult.error) warnings.push(accountRpcWarning("Request and review counts"));
  if (import.meta.env.DEV) {
    if (eventResult.error) console.warn("[Account communications] event counts", eventResult.error.message);
    if (requestResult.error) console.warn("[Account communications] request counts", requestResult.error.message);
  }
  return {
    signedIn: true,
    supabaseConfigured: true,
    warnings,
    events: eventResult.error ? emptyEventCounts : normalizeEventCounts(eventResult.data),
    requests: requestResult.error ? emptyRequestCounts : normalizeRequestCounts(requestResult.data),
  };
}

export async function loadInbox(
  view: InboxView,
  domain: string | null = null,
  cursor: InboxCursor | null = null,
): Promise<InboxResult> {
  const countState = await loadAccountHomebaseCounts();
  if (!countState.signedIn || !supabase) return {
    ...countState,
    counts: countState.events,
    items: [],
    cursor: null,
  };
  const { data, error } = await supabase.rpc("current_user_inbox_items", {
    p_view: view,
    p_domain: domain,
    p_limit: 30,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Account communications] Inbox", error.message);
    return { ...countState, counts: countState.events, items: [], cursor: null, warnings: [...countState.warnings, accountRpcWarning("Inbox")] };
  }
  const payload = asRecord(data);
  const items = normalizeInboxItems(payload.items);
  const last = items.length ? items[items.length - 1] : undefined;
  return {
    ...countState,
    counts: countState.events,
    items,
    cursor: items.length === 30 && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function setInboxItemRead(itemId: string, read: boolean) {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { error } = await supabase.rpc("set_current_user_inbox_read", { p_item_id: itemId, p_read: read });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Account communications] Inbox read state", error.message);
    return [accountRpcWarning("Inbox read state")];
  }
  return [];
}

export async function setInboxItemArchived(itemId: string, archived: boolean) {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { error } = await supabase.rpc("set_current_user_inbox_archived", { p_item_id: itemId, p_archived: archived });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Account communications] Inbox archive state", error.message);
    return [accountRpcWarning("Inbox archive state")];
  }
  return [];
}

export async function loadRequestsAndReviews(
  state: RequestReviewState,
  domain: string | null = null,
  cursor: RequestReviewCursor | null = null,
): Promise<RequestReviewsResult> {
  if (!hasSupabaseConfig || !supabase) return {
    signedIn: false,
    supabaseConfigured: false,
    warnings: [supabaseNotConfiguredMessage],
    items: [],
    counts: emptyRequestCounts,
    hasMore: false,
    cursor: null,
  };
  if (!await currentUserId()) return {
    signedIn: false,
    supabaseConfigured: true,
    warnings: [],
    items: [],
    counts: emptyRequestCounts,
    hasMore: false,
    cursor: null,
  };
  const [itemsResult, countsResult] = await Promise.all([
    supabase.rpc("current_user_requests_and_reviews", {
      p_state: state,
      p_domain: domain,
      p_limit: 40,
      p_before_updated_at: cursor?.updatedAt ?? null,
      p_before_key: cursor?.key ?? null,
    }),
    supabase.rpc("current_user_request_counts"),
  ]);
  const warnings: string[] = [];
  if (itemsResult.error) warnings.push(accountRpcWarning("Requests & Reviews"));
  if (countsResult.error) warnings.push(accountRpcWarning("Request and review counts"));
  if (import.meta.env.DEV) {
    if (itemsResult.error) console.warn("[Account communications] Requests & Reviews", itemsResult.error.message);
    if (countsResult.error) console.warn("[Account communications] request counts", countsResult.error.message);
  }
  const payload = asRecord(itemsResult.data);
  const nextCursor = asRecord(payload.nextCursor);
  return {
    signedIn: true,
    supabaseConfigured: true,
    warnings,
    items: itemsResult.error ? [] : normalizeRequestItems(payload.items),
    counts: countsResult.error ? emptyRequestCounts : normalizeRequestCounts(countsResult.data),
    hasMore: payload.hasMore === true,
    cursor: typeof nextCursor.updatedAt === "string" && typeof nextCursor.key === "string"
      ? { updatedAt: nextCursor.updatedAt, key: nextCursor.key }
      : null,
  };
}
