import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";

export type AccountActorCard = {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  shortPublicBio?: string | null;
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

export type AccountSavedShelvesCounts = {
  signedIn: boolean;
  supabaseConfigured: boolean;
  warnings: string[];
  savedItems: number;
  followedThreads: number;
  total: number;
  byKind: {
    addons: number;
    livingSources: number;
    citations: number;
    collections: number;
    communeItems: number;
  };
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

export type NotificationFilter =
  | "all"
  | "unread"
  | "account_security"
  | "community"
  | "work_reviews"
  | "marketplace"
  | "moderation"
  | "archived";

export type AccountNotification = {
  id: string;
  kind: "information" | "outcome" | "mandatory_notice" | "legacy";
  domain: string;
  sourceType: string;
  category: string;
  mandatory: boolean;
  title: string;
  preview: string | null;
  deepLink: string;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  sourceAvailable: boolean;
  actor: AccountActorCard | null;
};

export type NotificationCursor = { createdAt: string; id: string };

export type NotificationsResult = {
  signedIn: boolean;
  supabaseConfigured: boolean;
  warnings: string[];
  items: AccountNotification[];
  counts: AccountEventCounts;
  cursor: NotificationCursor | null;
};

export type AccountEventPreference = {
  category: string;
  taxonomyVersion: number;
  preferenceVersion: number;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: "UTC";
};

export type AccountEventPreferencesResult = {
  taxonomyVersion: number;
  preferences: AccountEventPreference[];
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

export type MessagingPreferences = {
  preferenceVersion: number;
  receiveDirectRequests: boolean;
  receiveOptionalAnnouncements: boolean;
  allowSourceLinkedMessages: boolean;
  ordinaryMessagingEligible: boolean;
  storedInSupabase: boolean;
  endToEndEncrypted: boolean;
};

export type MessagingRecipient = {
  found: boolean;
  eligible: boolean;
  canReceiveRequest: boolean;
  profile: AccountActorCard | null;
};

export type MessagingDestinationState =
  | "can_request"
  | "existing_active"
  | "existing_pending_outbound"
  | "existing_pending_inbound"
  | "unavailable";

export type MessagingDestination = {
  state: MessagingDestinationState;
  profile: AccountActorCard | null;
  deepLink: string | null;
};

export type ConversationRequestClientIds = {
  requestId: string;
  messageId: string;
};

export type ConversationSummary = {
  id: string;
  type: string;
  subject: string;
  state: string;
  replyPolicy: string;
  sourceDomain: string | null;
  sourceType: string | null;
  sourceAvailable: boolean;
  participantRole: string;
  participationState: string;
  incomingRequest: boolean;
  outgoingRequest: boolean;
  canReply: boolean;
  blockedByCurrentUser: boolean;
  unreadCount: number;
  archivedAt: string | null;
  mutedAt: string | null;
  lastMessageAt: string | null;
  updatedAt: string;
  counterpart: AccountActorCard | null;
};

export type ConversationMessage = {
  id: string;
  senderKind: string;
  senderSelf: boolean;
  sender: AccountActorCard | null;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type ConversationDetail = {
  conversation: ConversationSummary & { createdAt: string };
  participants: Array<{ role: string; state: string; self: boolean; profile: AccountActorCard | null }>;
  messages: ConversationMessage[];
  privacy: { storedInSupabase: boolean; endToEndEncrypted: boolean; participantScoped: boolean; attachmentsEnabled: boolean };
};

export type AdminSupportItem = {
  conversationId: string;
  subject: string;
  sourceDomain: string | null;
  sourceType: string | null;
  status: string;
  priority: number;
  assignedToCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
  requester: AccountActorCard | null;
};

export type MessageModerationCase = {
  caseId: string;
  reportId: string;
  conversationId: string;
  messageReported: boolean;
  reasonCode: string;
  status: string;
  assignedToCurrentUser: boolean;
  legalHold: boolean;
  createdAt: string;
  reporter: AccountActorCard | null;
};

export type ReportedMessageEvidence = {
  caseId: string;
  status: string;
  reasonCode: string;
  details: string | null;
  conversation: {
    type: string;
    subject: string;
    sourceDomain: string | null;
    sourceType: string | null;
  };
  reportedMessage: null | {
    body: string;
    senderKind: string;
    createdAt: string;
    editedAt: string | null;
    deletedAt: string | null;
  };
  scopeNotice: string;
};

export type AdminAnnouncementDraft = {
  draftId: string;
  subject: string;
  audienceKind: string;
  recipientCount: number;
  confirmationPhrase: string;
  expiresAt: string;
  safePreview: string;
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
    shortPublicBio: asNullableText(actor.shortPublicBio),
  };
}

function normalizeMessagingDestination(value: unknown): MessagingDestination {
  const row = asRecord(value);
  const state = asText(row.state);
  const safeState: MessagingDestinationState = [
    "can_request",
    "existing_active",
    "existing_pending_outbound",
    "existing_pending_inbound",
    "unavailable",
  ].includes(state) ? state as MessagingDestinationState : "unavailable";
  const deepLink = asNullableText(row.deepLink);
  return {
    state: safeState,
    profile: safeState === "unavailable" ? null : normalizeActor(row.profile),
    deepLink: deepLink && /^\/commons-circle\/signals\/inbox\/conversations\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deepLink)
      ? deepLink
      : null,
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

function normalizeNotificationItems(value: unknown): AccountNotification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const id = asText(row.id);
    const kind = asText(row.kind);
    const title = asText(row.title);
    const createdAt = asText(row.createdAt);
    if (!id || !title || !createdAt || !["information", "outcome", "mandatory_notice", "legacy"].includes(kind)) return [];
    return [{
      id,
      kind: kind as AccountNotification["kind"],
      domain: asText(row.domain, "account"),
      sourceType: asText(row.sourceType, "account_event"),
      category: asText(row.category, "account_security"),
      mandatory: row.mandatory === true,
      title,
      preview: asNullableText(row.preview),
      deepLink: asText(row.deepLink),
      readAt: asNullableText(row.readAt),
      archivedAt: asNullableText(row.archivedAt),
      createdAt,
      sourceAvailable: row.sourceAvailable !== false,
      actor: normalizeActor(row.actor),
    }];
  });
}

function normalizeEventPreference(value: unknown): AccountEventPreference | null {
  const row = asRecord(value);
  const category = asText(row.category);
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(category)) return null;
  return {
    category,
    taxonomyVersion: safeCount(row.taxonomyVersion),
    preferenceVersion: safeCount(row.preferenceVersion),
    inAppEnabled: row.inAppEnabled !== false,
    emailEnabled: row.emailEnabled === true,
    quietHoursStart: asNullableText(row.quietHoursStart),
    quietHoursEnd: asNullableText(row.quietHoursEnd),
    quietHoursTimezone: "UTC",
  };
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

function normalizeMessagingPreferences(value: unknown): MessagingPreferences {
  const row = asRecord(value);
  return {
    preferenceVersion: safeCount(row.preferenceVersion),
    receiveDirectRequests: row.receiveDirectRequests === true,
    receiveOptionalAnnouncements: row.receiveOptionalAnnouncements === true,
    allowSourceLinkedMessages: row.allowSourceLinkedMessages !== false,
    ordinaryMessagingEligible: row.ordinaryMessagingEligible === true,
    storedInSupabase: row.storedInSupabase === true,
    endToEndEncrypted: row.endToEndEncrypted === true,
  };
}

function normalizeConversationSummary(value: unknown): ConversationSummary | null {
  const row = asRecord(value);
  const id = asText(row.id);
  const subject = asText(row.subject);
  const updatedAt = asText(row.updatedAt);
  if (!id || !subject || !updatedAt) return null;
  return {
    id,
    type: asText(row.type, "direct"),
    subject,
    state: asText(row.state, "closed"),
    replyPolicy: asText(row.replyPolicy, "none"),
    sourceDomain: asNullableText(row.sourceDomain),
    sourceType: asNullableText(row.sourceType),
    sourceAvailable: row.sourceAvailable !== false,
    participantRole: asText(row.participantRole, "participant"),
    participationState: asText(row.participationState, "accepted"),
    incomingRequest: row.incomingRequest === true,
    outgoingRequest: row.outgoingRequest === true,
    canReply: row.canReply === true,
    blockedByCurrentUser: row.blockedByCurrentUser === true,
    unreadCount: safeCount(row.unreadCount),
    archivedAt: asNullableText(row.archivedAt),
    mutedAt: asNullableText(row.mutedAt),
    lastMessageAt: asNullableText(row.lastMessageAt),
    updatedAt,
    counterpart: normalizeActor(row.counterpart),
  };
}

function normalizeConversationDetail(value: unknown): ConversationDetail | null {
  const payload = asRecord(value);
  const conversationRow = asRecord(payload.conversation);
  const conversation = normalizeConversationSummary({
    ...conversationRow,
    updatedAt: asText(conversationRow.updatedAt, asText(conversationRow.createdAt)),
  });
  if (!conversation) return null;
  const participants = Array.isArray(payload.participants) ? payload.participants.flatMap((value) => {
    const row = asRecord(value);
    const role = asText(row.role);
    if (!role) return [];
    return [{ role, state: asText(row.state), self: row.self === true, profile: normalizeActor(row.profile) }];
  }) : [];
  const messages = Array.isArray(payload.messages) ? payload.messages.flatMap((value) => {
    const row = asRecord(value);
    const id = asText(row.id);
    const body = asText(row.body);
    const createdAt = asText(row.createdAt);
    if (!id || !body || !createdAt) return [];
    return [{
      id,
      senderKind: asText(row.senderKind, "user"),
      senderSelf: row.senderSelf === true,
      sender: normalizeActor(row.sender),
      body,
      editedAt: asNullableText(row.editedAt),
      deletedAt: asNullableText(row.deletedAt),
      createdAt,
    }];
  }) : [];
  const privacy = asRecord(payload.privacy);
  return {
    conversation: { ...conversation, createdAt: asText(conversationRow.createdAt, conversation.updatedAt) },
    participants,
    messages,
    privacy: {
      storedInSupabase: privacy.storedInSupabase === true,
      endToEndEncrypted: privacy.endToEndEncrypted === true,
      participantScoped: privacy.participantScoped === true,
      attachmentsEnabled: privacy.attachmentsEnabled === true,
    },
  };
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

export async function loadAccountSavedShelvesCounts(): Promise<AccountSavedShelvesCounts> {
  const empty = {
    savedItems: 0,
    followedThreads: 0,
    total: 0,
    byKind: { addons: 0, livingSources: 0, citations: 0, collections: 0, communeItems: 0 },
  };
  if (!hasSupabaseConfig || !supabase) return {
    signedIn: false,
    supabaseConfigured: false,
    warnings: [supabaseNotConfiguredMessage],
    ...empty,
  };
  const client = supabase;
  const userId = await currentUserId();
  if (!userId) return { signedIn: false, supabaseConfigured: true, warnings: [], ...empty };

  const tables = [
    ["addons", "user_saved_addons"],
    ["livingSources", "user_saved_living_sources"],
    ["citations", "user_saved_citations"],
    ["collections", "user_source_collections"],
    ["communeItems", "user_saved_commune_posts"],
    ["followedThreads", "user_followed_commune_threads"],
  ] as const;
  const results = await Promise.all(tables.map(async ([kind, table]) => {
    const result = await client.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    return { kind, count: result.count ?? 0, error: result.error };
  }));
  const warnings = results.some((result) => result.error) ? [accountRpcWarning("Saved Shelves counts")] : [];
  if (import.meta.env.DEV) results.forEach((result) => {
    if (result.error) console.warn(`[Account communications] ${result.kind} count`, result.error.message);
  });
  const count = (kind: typeof tables[number][0]) => results.find((result) => result.kind === kind)?.count ?? 0;
  const byKind = {
    addons: count("addons"),
    livingSources: count("livingSources"),
    citations: count("citations"),
    collections: count("collections"),
    communeItems: count("communeItems"),
  };
  const savedItems = Object.values(byKind).reduce((sum, value) => sum + value, 0);
  const followedThreads = count("followedThreads");
  return {
    signedIn: true,
    supabaseConfigured: true,
    warnings,
    savedItems,
    followedThreads,
    total: savedItems + followedThreads,
    byKind,
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

export async function loadNotifications(
  filter: NotificationFilter,
  cursor: NotificationCursor | null = null,
): Promise<NotificationsResult> {
  const countState = await loadAccountHomebaseCounts();
  if (!countState.signedIn || !supabase) return {
    ...countState,
    counts: countState.events,
    items: [],
    cursor: null,
  };
  const { data, error } = await supabase.rpc("current_user_notification_items", {
    p_filter: filter,
    p_limit: 30,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Account communications] Notifications", error.message);
    return { ...countState, counts: countState.events, items: [], cursor: null, warnings: [...countState.warnings, accountRpcWarning("Notifications")] };
  }
  const payload = asRecord(data);
  const items = normalizeNotificationItems(payload.items);
  const last = items.length ? items[items.length - 1] : undefined;
  return {
    ...countState,
    counts: countState.events,
    items,
    cursor: items.length === 30 && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function setNotificationRead(notificationId: string, read: boolean) {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { error } = await supabase.rpc("set_current_user_notification_read", {
    p_notification_id: notificationId,
    p_read: read,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Account communications] Notification read state", error.message);
    return [accountRpcWarning("Notification read state")];
  }
  return [];
}

export async function setNotificationArchived(notificationId: string, archived: boolean) {
  if (!supabase) return [supabaseNotConfiguredMessage];
  const { error } = await supabase.rpc("set_current_user_notification_archived", {
    p_notification_id: notificationId,
    p_archived: archived,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn("[Account communications] Notification archive state", error.message);
    return [accountRpcWarning("Notification archive state")];
  }
  return [];
}

export async function markAllAccountNotificationsRead(category: string | null = null) {
  if (!supabase) return { count: 0, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("mark_all_current_user_notifications_read", { p_category: category });
  return { count: error ? 0 : safeCount(data), warning: error ? accountRpcWarning("Notification read state") : null };
}

export async function loadAccountEventPreferences(): Promise<{ result: AccountEventPreferencesResult | null; warning: string | null }> {
  if (!supabase) return { result: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("current_user_account_event_preferences");
  if (error) return { result: null, warning: accountRpcWarning("Notification preferences") };
  const payload = asRecord(data);
  return {
    result: {
      taxonomyVersion: safeCount(payload.taxonomyVersion),
      preferences: Array.isArray(payload.preferences)
        ? payload.preferences.flatMap((value) => {
          const preference = normalizeEventPreference(value);
          return preference ? [preference] : [];
        })
        : [],
    },
    warning: null,
  };
}

export async function updateAccountEventPreference(preference: AccountEventPreference) {
  if (!supabase) return { preference: null as AccountEventPreference | null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("update_current_user_account_event_preference", {
    p_category: preference.category,
    p_in_app_enabled: preference.inAppEnabled,
    p_email_enabled: preference.emailEnabled,
    p_quiet_hours_start: preference.quietHoursStart,
    p_quiet_hours_end: preference.quietHoursEnd,
    p_expected_version: preference.preferenceVersion,
  });
  return {
    preference: error ? null : normalizeEventPreference(data),
    warning: error ? accountRpcWarning("Notification preferences") : null,
  };
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

function rpcFailure(scope: string, error: { message: string } | null) {
  if (error && import.meta.env.DEV) console.warn(`[Account communications] ${scope}`, error.message);
  return error ? accountRpcWarning(scope) : null;
}

export function newAccountCommunicationClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function loadMessagingPreferences(): Promise<{ preferences: MessagingPreferences | null; warning: string | null }> {
  if (!supabase) return { preferences: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("current_user_messaging_preferences");
  return { preferences: error ? null : normalizeMessagingPreferences(data), warning: rpcFailure("Messaging preferences", error) };
}

export async function updateMessagingPreferences(
  preferences: Pick<MessagingPreferences, "receiveDirectRequests" | "receiveOptionalAnnouncements" | "allowSourceLinkedMessages" | "preferenceVersion">,
) {
  if (!supabase) return { preferences: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("update_current_user_messaging_preferences", {
    p_receive_direct_requests: preferences.receiveDirectRequests,
    p_receive_optional_announcements: preferences.receiveOptionalAnnouncements,
    p_allow_source_linked_messages: preferences.allowSourceLinkedMessages,
    p_expected_version: preferences.preferenceVersion,
  });
  return { preferences: error ? null : normalizeMessagingPreferences(data), warning: rpcFailure("Messaging preferences", error) };
}

export async function lookupMessagingRecipient(handle: string) {
  if (!supabase) return { recipient: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("lookup_account_messaging_recipient", { p_handle: handle });
  const row = asRecord(data);
  const recipient: MessagingRecipient | null = error ? null : {
    found: row.found === true,
    eligible: row.eligible === true,
    canReceiveRequest: row.canReceiveRequest === true,
    profile: normalizeActor(row.profile),
  };
  return { recipient, warning: rpcFailure("Recipient lookup", error) };
}

export async function resolveMessagingDestination(handle: string) {
  if (!supabase) return {
    destination: null as MessagingDestination | null,
    warning: supabaseNotConfiguredMessage,
  };
  const { data, error } = await supabase.rpc("resolve_account_messaging_destination", {
    p_public_handle: handle,
  });
  return {
    destination: error ? null : normalizeMessagingDestination(data),
    warning: rpcFailure("Messaging destination", error),
  };
}

export async function requestConversation(
  handle: string,
  subject: string,
  body: string,
  clientIds: ConversationRequestClientIds,
) {
  if (!supabase) return { conversationId: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("request_account_conversation", {
    p_recipient_handle: handle,
    p_subject: subject,
    p_body: body,
    p_client_request_id: clientIds.requestId,
    p_client_message_id: clientIds.messageId,
  });
  const conversationId = error ? null : asNullableText(asRecord(data).conversationId);
  return {
    conversationId,
    deepLink: conversationId ? `/commons-circle/signals/inbox/conversations/${conversationId}` : null,
    warning: rpcFailure("Conversation request", error),
  };
}

export async function startSupportConversation(subject: string, body: string) {
  if (!supabase) return { conversationId: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("start_account_support_conversation", {
    p_subject: subject,
    p_body: body,
    p_client_request_id: newAccountCommunicationClientId(),
    p_client_message_id: newAccountCommunicationClientId(),
    p_source_domain: null,
    p_source_type: null,
    p_source_record_id: null,
  });
  return { conversationId: error ? null : asNullableText(asRecord(data).conversationId), warning: rpcFailure("Account support", error) };
}

export async function startSourceLinkedConversation(input: {
  sourceDomain: string;
  sourceType: string;
  sourceRecordId: string;
  subject: string;
  body: string;
}) {
  if (!supabase) return { conversationId: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("start_source_linked_account_conversation", {
    p_source_domain: input.sourceDomain,
    p_source_type: input.sourceType,
    p_source_record_id: input.sourceRecordId,
    p_subject: input.subject,
    p_body: input.body,
    p_client_request_id: newAccountCommunicationClientId(),
    p_client_message_id: newAccountCommunicationClientId(),
  });
  return { conversationId: error ? null : asNullableText(asRecord(data).conversationId), warning: rpcFailure("Source-linked conversation", error) };
}

export async function loadConversations(view = "all") {
  if (!supabase) return { items: [] as ConversationSummary[], warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("current_user_conversations", {
    p_view: view,
    p_limit: 50,
    p_before_updated_at: null,
    p_before_id: null,
  });
  const items = error ? [] : (Array.isArray(asRecord(data).items) ? asRecord(data).items as unknown[] : [])
    .flatMap((value) => {
      const item = normalizeConversationSummary(value);
      return item ? [item] : [];
    });
  return { items, warning: rpcFailure("Private conversations", error) };
}

export async function loadConversation(conversationId: string) {
  if (!supabase) return { detail: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("current_user_conversation", {
    p_conversation_id: conversationId,
    p_limit: 100,
    p_before_created_at: null,
    p_before_id: null,
  });
  return { detail: error ? null : normalizeConversationDetail(data), warning: rpcFailure("Private conversation", error) };
}

export async function respondToConversationRequest(conversationId: string, decision: "accept" | "decline") {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("respond_to_account_conversation_request", {
    p_conversation_id: conversationId,
    p_decision: decision,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Conversation response", error);
}

export async function sendConversationMessage(conversationId: string, body: string) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("send_account_conversation_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_client_message_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Private reply", error);
}

export async function markConversationRead(conversationId: string) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("mark_current_user_conversation_read", { p_conversation_id: conversationId });
  return rpcFailure("Conversation read state", error);
}

export async function setConversationPresentation(conversationId: string, archived: boolean | null, muted: boolean | null) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("set_current_user_conversation_presentation", {
    p_conversation_id: conversationId,
    p_archived: archived,
    p_muted: muted,
  });
  return rpcFailure("Conversation presentation", error);
}

export async function setConversationBlocked(conversationId: string, blocked: boolean) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("set_account_conversation_block", {
    p_conversation_id: conversationId,
    p_blocked: blocked,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Account block", error);
}

export async function reportConversation(conversationId: string, messageId: string | null, reasonCode: string, details: string) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("report_account_conversation", {
    p_conversation_id: conversationId,
    p_message_id: messageId,
    p_reason_code: reasonCode,
    p_details: details.trim() || null,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Conversation report", error);
}

export async function loadAdminSupportQueue() {
  if (!supabase) return { items: [] as AdminSupportItem[], openCount: 0, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("current_admin_account_support_queue");
  const payload = asRecord(data);
  const items = error || !Array.isArray(payload.items) ? [] : payload.items.flatMap((value) => {
    const row = asRecord(value);
    const conversationId = asText(row.conversationId);
    if (!conversationId) return [];
    return [{
      conversationId,
      subject: asText(row.subject),
      sourceDomain: asNullableText(row.sourceDomain),
      sourceType: asNullableText(row.sourceType),
      status: asText(row.status),
      priority: safeCount(row.priority),
      assignedToCurrentUser: row.assignedToCurrentUser === true,
      createdAt: asText(row.createdAt),
      updatedAt: asText(row.updatedAt),
      requester: normalizeActor(row.requester),
    }];
  });
  return { items, openCount: safeCount(payload.openCount), warning: rpcFailure("Administrator support queue", error) };
}

export async function claimAdminSupportConversation(conversationId: string) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("claim_admin_account_support_conversation", {
    p_conversation_id: conversationId,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Support assignment", error);
}

export async function adminSendAccountMessage(input: {
  handle: string; subject: string; body: string; kind: string;
}) {
  if (!supabase) return { conversationId: null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("admin_send_account_message", {
    p_recipient_handle: input.handle,
    p_subject: input.subject,
    p_body: input.body,
    p_message_kind: input.kind,
    p_client_request_id: newAccountCommunicationClientId(),
    p_client_message_id: newAccountCommunicationClientId(),
    p_source_domain: null,
    p_source_type: null,
    p_source_record_id: null,
  });
  return { conversationId: error ? null : asNullableText(asRecord(data).conversationId), warning: rpcFailure("Administrator message", error) };
}

export async function prepareAdminAnnouncement(input: {
  subject: string; body: string; audienceKind: string; handles: string[];
}) {
  if (!supabase) return { draft: null as AdminAnnouncementDraft | null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("prepare_admin_account_announcement", {
    p_subject: input.subject,
    p_body: input.body,
    p_audience_kind: input.audienceKind,
    p_handles: input.audienceKind === "explicit_opted_in_handles" ? input.handles : null,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  if (error) return { draft: null as AdminAnnouncementDraft | null, warning: rpcFailure("Announcement preview", error) };
  const row = asRecord(data);
  const draft: AdminAnnouncementDraft = {
    draftId: asText(row.draftId),
    subject: asText(row.subject),
    audienceKind: asText(row.audienceKind),
    recipientCount: safeCount(row.recipientCount),
    confirmationPhrase: asText(row.confirmationPhrase),
    expiresAt: asText(row.expiresAt),
    safePreview: asText(row.safePreview),
  };
  return { draft, warning: "" };
}

export async function sendAdminAnnouncement(draftId: string, recipientCount: number, confirmationText: string) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("send_admin_account_announcement", {
    p_draft_id: draftId,
    p_expected_recipient_count: recipientCount,
    p_confirmation_text: confirmationText,
  });
  return rpcFailure("Administrator announcement", error);
}

export async function loadMessageModerationQueue() {
  if (!supabase) return { items: [] as MessageModerationCase[], warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("current_account_message_moderation_queue");
  const payload = asRecord(data);
  const items = error || !Array.isArray(payload.items) ? [] : payload.items.flatMap((value) => {
    const row = asRecord(value);
    const caseId = asText(row.caseId);
    if (!caseId) return [];
    return [{
      caseId,
      reportId: asText(row.reportId),
      conversationId: asText(row.conversationId),
      messageReported: row.messageReported === true,
      reasonCode: asText(row.reasonCode),
      status: asText(row.status),
      assignedToCurrentUser: row.assignedToCurrentUser === true,
      legalHold: row.legalHold === true,
      createdAt: asText(row.createdAt),
      reporter: normalizeActor(row.reporter),
    }];
  });
  return { items, warning: rpcFailure("Message moderation queue", error) };
}

export async function claimMessageModerationCase(caseId: string) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("claim_account_message_moderation_case", {
    p_case_id: caseId,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Message moderation assignment", error);
}

export async function readReportedMessageEvidence(caseId: string) {
  if (!supabase) return { evidence: null as ReportedMessageEvidence | null, warning: supabaseNotConfiguredMessage };
  const { data, error } = await supabase.rpc("read_reported_account_message_evidence", { p_case_id: caseId });
  if (error) return { evidence: null as ReportedMessageEvidence | null, warning: rpcFailure("Reported-message evidence", error) };
  const row = asRecord(data);
  const conversation = asRecord(row.conversation);
  const message = asRecord(row.reportedMessage);
  const evidence: ReportedMessageEvidence = {
    caseId: asText(row.caseId),
    status: asText(row.status),
    reasonCode: asText(row.reasonCode),
    details: asNullableText(row.details),
    conversation: {
      type: asText(conversation.type),
      subject: asText(conversation.subject),
      sourceDomain: asNullableText(conversation.sourceDomain),
      sourceType: asNullableText(conversation.sourceType),
    },
    reportedMessage: Object.keys(message).length ? {
      body: asText(message.body),
      senderKind: asText(message.senderKind),
      createdAt: asText(message.createdAt),
      editedAt: asNullableText(message.editedAt),
      deletedAt: asNullableText(message.deletedAt),
    } : null,
    scopeNotice: asText(row.scopeNotice, "Only case-bound reported evidence is disclosed."),
  };
  return { evidence, warning: "" };
}

export async function resolveMessageModerationCase(caseId: string, resolutionCode: string, legalHold: boolean) {
  if (!supabase) return supabaseNotConfiguredMessage;
  const { error } = await supabase.rpc("resolve_account_message_moderation_case", {
    p_case_id: caseId,
    p_resolution_code: resolutionCode,
    p_legal_hold: legalHold,
    p_client_request_id: newAccountCommunicationClientId(),
  });
  return rpcFailure("Message moderation resolution", error);
}
