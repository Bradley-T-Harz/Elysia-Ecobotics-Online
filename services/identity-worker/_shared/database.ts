import type { SupabaseClient } from "@supabase/supabase-js";
import { IdentityHttpError } from "./http.ts";

async function rpc(client: SupabaseClient, name: string, parameters: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await client.rpc(name, parameters);
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : error.code === "P0001" ? 409 : 502;
    throw new IdentityHttpError(status, status === 403 ? "permission_denied" : status === 409 ? "state_conflict" : "identity_database_failed");
  }
  return data;
}

export function loadPublicProfileCard(client: SupabaseClient, handle: string): Promise<unknown> {
  return rpc(client, "get_public_profile_card", { p_handle: handle });
}

export function loadPublicProfileAvatarAsset(client: SupabaseClient, mediaId: string): Promise<unknown> {
  return rpc(client, "get_online_public_profile_avatar_asset", { p_media_id: mediaId });
}

export function loadPublicProfileBannerAsset(client: SupabaseClient, mediaId: string): Promise<unknown> {
  return rpc(client, "get_online_public_profile_banner_asset", { p_media_id: mediaId });
}

export function searchPublicCommonsMessageProfiles(
  client: SupabaseClient,
  input: { actorUserId: string; query: string; limit: number }
): Promise<unknown> {
  return rpc(client, "search_public_commons_message_profiles_for_actor", {
    p_actor_user_id: input.actorUserId,
    p_query: input.query,
    p_limit: input.limit,
  });
}

export function loadAccountMessagingAdminStatus(
  client: SupabaseClient,
  input: { actorUserId: string; targetHandle: string | null }
): Promise<unknown> {
  return rpc(client, "current_account_messaging_admin_status", {
    p_actor_user_id: input.actorUserId,
    p_target_handle: input.targetHandle,
  });
}

export function setAccountMessagingBetaEnrollment(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    clientRequestId: string;
    targetHandle: string;
    enabled: boolean;
    category: string;
    confirmation: string;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "set_account_messaging_beta_enrollment", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_target_handle: input.targetHandle,
    p_enabled: input.enabled,
    p_category: input.category,
    p_confirmation: input.confirmation,
    p_private_reason: input.privateReason,
  });
}

export function setAccountMessagingLaunchMode(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    clientRequestId: string;
    launchMode: "disabled" | "controlled_beta";
    confirmation: string;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "set_account_messaging_launch_mode", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_launch_mode: input.launchMode,
    p_confirmation: input.confirmation,
    p_private_reason: input.privateReason,
  });
}

export function loadCurrentUserBootstrap(client: SupabaseClient): Promise<unknown> {
  return rpc(client, "current_user_artisan_bootstrap");
}

export function setCurrentUserPublicProfile(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; enabled: boolean; shortPublicBio: string | null }
): Promise<unknown> {
  return rpc(client, "community_set_actor_public_profile", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_enabled: input.enabled,
    p_short_public_bio: input.shortPublicBio
  });
}

export function acceptCurrentUserDocuments(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; acceptances: Record<string, { version: string; contentHash: string }>; origin: string }
): Promise<unknown> {
  return rpc(client, "community_accept_actor_documents", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_acceptances: input.acceptances,
    p_origin: input.origin
  });
}

export function requestCurrentUserLifecycleAction(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; action: "export" | "deletion"; noticeVersion: string; userNote: string | null }
): Promise<unknown> {
  return rpc(client, "community_request_actor_lifecycle_action", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_action: input.action,
    p_notice_version: input.noticeVersion,
    p_user_note: input.userNote
  });
}

export function listCurrentUserLifecycleRequests(
  client: SupabaseClient,
  input: { limit: number; before: string | null }
): Promise<unknown> {
  return rpc(client, "current_user_community_lifecycle_requests", {
    p_limit: input.limit,
    p_before: input.before
  });
}

export function loadCurrentUserLifecycleRequest(
  client: SupabaseClient,
  requestId: string
): Promise<unknown> {
  return rpc(client, "current_user_community_lifecycle_request", { p_request_id: requestId });
}

export function cancelCurrentUserCommunityDeletion(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; requestId: string }
): Promise<unknown> {
  return rpc(client, "community_cancel_actor_deletion", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_request_id: input.requestId
  });
}

export function loadCommunityExportDownloadAsset(
  client: SupabaseClient,
  input: { actorUserId: string; artifactId: string }
): Promise<unknown> {
  return rpc(client, "get_community_export_download_asset", {
    p_actor_user_id: input.actorUserId,
    p_artifact_id: input.artifactId
  });
}

export function claimCommunityLifecycleWork(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal2";
    clientRequestId: string;
    limit: number;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "claim_community_lifecycle_work", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_limit: input.limit,
    p_private_reason: input.privateReason
  });
}

export function loadCommunityLifecycleWorkItem(
  client: SupabaseClient,
  input: { actorUserId: string; actorAal: "aal2"; requestId: string }
): Promise<unknown> {
  return rpc(client, "get_community_lifecycle_work_item", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_request_id: input.requestId
  });
}

export function transitionCommunityLifecycleAction(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal2";
    clientRequestId: string;
    requestId: string;
    toStatus: string;
    exportArtifactSha256: string | null;
    exportExpiresAt: string | null;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "transition_community_lifecycle_action", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_request_id: input.requestId,
    p_to_status: input.toStatus,
    p_export_artifact_sha256: input.exportArtifactSha256,
    p_export_expires_at: input.exportExpiresAt,
    p_private_reason: input.privateReason
  });
}

export function loadCommunityExportSnapshot(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal2";
    requestId: string;
    section: string;
    limit: number;
    afterId: string | null;
  }
): Promise<unknown> {
  return rpc(client, "get_community_export_snapshot", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_request_id: input.requestId,
    p_section: input.section,
    p_limit: input.limit,
    p_after_id: input.afterId
  });
}

export function recordCommunityExportArtifact(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal2";
    clientRequestId: string;
    requestId: string;
    privateObjectKey: string;
    artifactSha256: string;
    byteSize: number;
    mimeType: "application/json";
    expiresAt: string;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "record_community_export_artifact", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_request_id: input.requestId,
    p_private_object_key: input.privateObjectKey,
    p_artifact_sha256: input.artifactSha256,
    p_byte_size: input.byteSize,
    p_mime_type: input.mimeType,
    p_expires_at: input.expiresAt,
    p_private_reason: input.privateReason
  });
}

export function enqueueArtisanAccountCleanup(
  client: SupabaseClient,
  input: { actorUserId: string; actorAal: "aal2"; clientRequestId: string; requestId: string }
): Promise<unknown> {
  return rpc(client, "enqueue_artisan_account_cleanup", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_lifecycle_request_id: input.requestId
  });
}

export function loadArtisanAccountCleanupReadiness(
  client: SupabaseClient,
  requestId: string
): Promise<unknown> {
  return rpc(client, "get_community_artisan_cleanup_readiness", {
    p_lifecycle_request_id: requestId
  });
}

export function recordCommunityDeletionHandoff(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal2";
    clientRequestId: string;
    requestId: string;
    phase: "storage_inventory_completed" | "storage_cleanup_completed" | "auth_deletion_requested" | "auth_deletion_confirmed";
    evidenceSha256: string;
    contentDisposition: string | null;
    ownedStorageObjectCount: number | null;
    authProviderReceiptSha256: string | null;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "record_community_deletion_handoff", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_request_id: input.requestId,
    p_phase: input.phase,
    p_evidence_sha256: input.evidenceSha256,
    p_content_disposition: input.contentDisposition,
    p_owned_storage_object_count: input.ownedStorageObjectCount,
    p_auth_provider_receipt_sha256: input.authProviderReceiptSha256,
    p_private_reason: input.privateReason
  });
}

export function claimNotificationDeliveryJobs(
  client: SupabaseClient,
  input: { workerId: string; limit: number; leaseSeconds: number }
): Promise<unknown> {
  return rpc(client, "artisan_claim_notification_delivery_jobs", {
    p_worker_id: input.workerId,
    p_limit: input.limit,
    p_lease_seconds: input.leaseSeconds
  });
}

export function completeNotificationDelivery(
  client: SupabaseClient,
  input: { clientRequestId: string; workerId: string; notificationId: string; evidenceSha256: string }
): Promise<unknown> {
  return rpc(client, "artisan_complete_notification_delivery", {
    p_client_request_id: input.clientRequestId,
    p_worker_id: input.workerId,
    p_notification_id: input.notificationId,
    p_delivery_evidence_sha256: input.evidenceSha256
  });
}

export function failNotificationDelivery(
  client: SupabaseClient,
  input: {
    clientRequestId: string; workerId: string; notificationId: string;
    errorCode: string; evidenceSha256: string; retryAfterSeconds: number;
  }
): Promise<unknown> {
  return rpc(client, "artisan_fail_notification_delivery", {
    p_client_request_id: input.clientRequestId,
    p_worker_id: input.workerId,
    p_notification_id: input.notificationId,
    p_error_code: input.errorCode,
    p_failure_evidence_sha256: input.evidenceSha256,
    p_retry_after_seconds: input.retryAfterSeconds
  });
}

export function claimAccountNotificationDeliveryJobs(
  client: SupabaseClient,
  input: { leaseToken: string; limit: number }
): Promise<unknown> {
  return rpc(client, "claim_account_delivery_outbox", {
    p_lease_token: input.leaseToken,
    p_limit: input.limit
  });
}

export function completeAccountNotificationDelivery(
  client: SupabaseClient,
  input: { deliveryId: string; leaseToken: string; evidenceSha256: string }
): Promise<unknown> {
  return rpc(client, "complete_account_delivery_v2", {
    p_delivery_id: input.deliveryId,
    p_lease_token: input.leaseToken,
    p_delivery_evidence_sha256: input.evidenceSha256
  });
}

export function failAccountNotificationDelivery(
  client: SupabaseClient,
  input: { deliveryId: string; leaseToken: string; errorCode: string; evidenceSha256: string }
): Promise<unknown> {
  return rpc(client, "fail_account_delivery_v2", {
    p_delivery_id: input.deliveryId,
    p_lease_token: input.leaseToken,
    p_error_code: input.errorCode,
    p_failure_evidence_sha256: input.evidenceSha256
  });
}

export function claimCommunityExportRetentionJobs(
  client: SupabaseClient,
  input: { workerId: string; limit: number; leaseSeconds: number }
): Promise<unknown> {
  return rpc(client, "claim_community_export_retention_jobs", {
    p_worker_id: input.workerId,
    p_limit: input.limit,
    p_lease_seconds: input.leaseSeconds
  });
}

export function loadCommunityExportRetentionAsset(
  client: SupabaseClient,
  input: { workerId: string; artifactId: string }
): Promise<unknown> {
  return rpc(client, "get_community_export_retention_asset", {
    p_worker_id: input.workerId,
    p_artifact_id: input.artifactId
  });
}

export function completeCommunityExportRetention(
  client: SupabaseClient,
  input: {
    clientRequestId: string; workerId: string; artifactId: string;
    evidenceSha256: string; deletedObjectCount: number;
  }
): Promise<unknown> {
  return rpc(client, "complete_community_export_retention", {
    p_client_request_id: input.clientRequestId,
    p_worker_id: input.workerId,
    p_artifact_id: input.artifactId,
    p_completion_evidence_sha256: input.evidenceSha256,
    p_deleted_object_count: input.deletedObjectCount
  });
}

export function failCommunityExportRetention(
  client: SupabaseClient,
  input: {
    clientRequestId: string; workerId: string; artifactId: string;
    errorCode: string; evidenceSha256: string; retryAfterSeconds: number;
  }
): Promise<unknown> {
  return rpc(client, "fail_community_export_retention", {
    p_client_request_id: input.clientRequestId,
    p_worker_id: input.workerId,
    p_artifact_id: input.artifactId,
    p_error_code: input.errorCode,
    p_failure_evidence_sha256: input.evidenceSha256,
    p_retry_after_seconds: input.retryAfterSeconds
  });
}

export function updateNotificationPreferencesForActor(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    clientRequestId: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    mentionsEnabled: boolean;
    commentsEnabled: boolean;
    challengeUpdatesEnabled: boolean;
    moderationUpdatesEnabled: boolean;
    guardianUpdatesEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
  }
): Promise<unknown> {
  return rpc(client, "artisan_update_notification_preferences", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_in_app_enabled: input.inAppEnabled,
    p_email_enabled: input.emailEnabled,
    p_mentions_enabled: input.mentionsEnabled,
    p_comments_enabled: input.commentsEnabled,
    p_challenge_updates_enabled: input.challengeUpdatesEnabled,
    p_moderation_updates_enabled: input.moderationUpdatesEnabled,
    p_guardian_updates_enabled: input.guardianUpdatesEnabled,
    p_quiet_hours_start: input.quietHoursStart,
    p_quiet_hours_end: input.quietHoursEnd
  });
}

export function startGuardianSponsoredAccount(
  client: SupabaseClient,
  input: {
    actorUserId: string; actorAal: "aal2"; clientRequestId: string; provider: string;
    dependentContactHmacSha256: string; claimNonceSha256: string; relationshipType: string;
    authorityExpiresAt: string; externalReferenceSha256: string; stateNonceSha256: string;
    requestExpiresAt: string; privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "start_guardian_sponsored_account", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_provider: input.provider,
    p_dependent_contact_hmac_sha256: input.dependentContactHmacSha256,
    p_claim_nonce_sha256: input.claimNonceSha256,
    p_relationship_type: input.relationshipType,
    p_authority_expires_at: input.authorityExpiresAt,
    p_external_reference_sha256: input.externalReferenceSha256,
    p_state_nonce_sha256: input.stateNonceSha256,
    p_request_expires_at: input.requestExpiresAt,
    p_private_reason: input.privateReason
  });
}

export function consumeGuardianSponsoredAccountProviderResult(
  client: SupabaseClient,
  input: {
    clientRequestId: string; provider: string; externalReferenceSha256: string;
    stateNonceSha256: string; resultSha256: string; resultStatus: "verified" | "failed";
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "consume_guardian_sponsored_account_provider_result", {
    p_client_request_id: input.clientRequestId,
    p_provider: input.provider,
    p_external_reference_sha256: input.externalReferenceSha256,
    p_state_nonce_sha256: input.stateNonceSha256,
    p_result_sha256: input.resultSha256,
    p_result_status: input.resultStatus,
    p_private_reason: input.privateReason
  });
}

export function claimGuardianSponsoredAccount(
  client: SupabaseClient,
  input: {
    actorUserId: string; actorAal: "aal2"; clientRequestId: string;
    sponsorshipId: string; claimNonceSha256: string; privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "claim_guardian_sponsored_account", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_sponsorship_id: input.sponsorshipId,
    p_claim_nonce_sha256: input.claimNonceSha256,
    p_private_reason: input.privateReason
  });
}

export function requestGuardianContentApproval(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; targetType: string; targetId: string; privateReason: string }
): Promise<unknown> {
  return rpc(client, "artisan_request_guardian_content_approval", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_private_reason: input.privateReason
  });
}

export function loadGuardianContentApprovalQueue(
  client: SupabaseClient,
  input: { actorUserId: string; actorAal: "aal2"; limit: number; before: string | null }
): Promise<unknown> {
  return rpc(client, "artisan_guardian_content_approval_queue", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_limit: input.limit,
    p_before: input.before
  });
}

export function decideGuardianContentApproval(
  client: SupabaseClient,
  input: {
    actorUserId: string; actorAal: "aal2"; clientRequestId: string;
    approvalRequestId: string; expectedRevisionSha256: string;
    decision: "approve" | "reject"; privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "artisan_decide_guardian_content_approval", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_approval_request_id: input.approvalRequestId,
    p_expected_revision_sha256: input.expectedRevisionSha256,
    p_decision: input.decision,
    p_private_reason: input.privateReason
  });
}

export function loadGuardianDependentStatus(
  client: SupabaseClient,
  input: { actorUserId: string; actorAal: "aal2"; dependentHandle: string }
): Promise<unknown> {
  return rpc(client, "artisan_guardian_dependent_status", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_dependent_handle: input.dependentHandle
  });
}

export function setGuardianDependentProfile(
  client: SupabaseClient,
  input: {
    actorUserId: string; actorAal: "aal2"; clientRequestId: string; dependentHandle: string;
    enabled: boolean; privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "artisan_guardian_set_dependent_profile", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_dependent_handle: input.dependentHandle,
    p_enabled: input.enabled,
    p_private_reason: input.privateReason
  });
}

export function requestGuardianDependentLifecycle(
  client: SupabaseClient,
  input: {
    actorUserId: string; actorAal: "aal2"; clientRequestId: string; dependentHandle: string;
    action: "export" | "deletion"; noticeVersion: string; userNote: string;
  }
): Promise<unknown> {
  return rpc(client, "artisan_guardian_request_dependent_lifecycle", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_dependent_handle: input.dependentHandle,
    p_action: input.action,
    p_notice_version: input.noticeVersion,
    p_user_note: input.userNote
  });
}

export function loadGuardianDependentLifecycle(
  client: SupabaseClient,
  input: { actorUserId: string; actorAal: "aal2"; dependentHandle: string; limit: number }
): Promise<unknown> {
  return rpc(client, "artisan_guardian_dependent_lifecycle_status", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_dependent_handle: input.dependentHandle,
    p_limit: input.limit
  });
}

export function revokeCurrentUserGuardianRelationship(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; relationshipId: string; reason: string }
): Promise<unknown> {
  return rpc(client, "community_revoke_actor_guardian_relationship", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_relationship_id: input.relationshipId,
    p_reason: input.reason
  });
}

export function revokeCurrentUserGuardianConsent(
  client: SupabaseClient,
  input: { actorUserId: string; clientRequestId: string; consentId: string; reason: string }
): Promise<unknown> {
  return rpc(client, "community_revoke_actor_guardian_consent", {
    p_actor_user_id: input.actorUserId,
    p_client_request_id: input.clientRequestId,
    p_consent_id: input.consentId,
    p_reason: input.reason
  });
}

export type CommunityProviderPurpose = "age_assurance" | "guardian_relationship" | "guardian_consent";

export function startCommunityProviderTransaction(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    clientRequestId: string;
    provider: string;
    purpose: CommunityProviderPurpose;
    subjectUserId: string;
    guardianUserId: string | null;
    guardianRelationshipId: string | null;
    relationshipType: "parent" | "legal_guardian" | "court_authorized_guardian" | null;
    consentScope: string | null;
    documentKey: string | null;
    documentVersion: string | null;
    contentSha256: string | null;
    authorityExpiresAt: string | null;
    externalReferenceSha256: string;
    stateNonceSha256: string;
    expiresAt: string;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "start_community_provider_transaction", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_provider: input.provider,
    p_purpose: input.purpose,
    p_subject_user_id: input.subjectUserId,
    p_guardian_user_id: input.guardianUserId,
    p_guardian_relationship_id: input.guardianRelationshipId,
    p_relationship_type: input.relationshipType,
    p_consent_scope: input.consentScope,
    p_document_key: input.documentKey,
    p_document_version: input.documentVersion,
    p_content_sha256: input.contentSha256,
    p_authority_expires_at: input.authorityExpiresAt,
    p_external_reference_sha256: input.externalReferenceSha256,
    p_state_nonce_sha256: input.stateNonceSha256,
    p_expires_at: input.expiresAt,
    p_private_reason: input.privateReason
  });
}

export function startCommunityGuardianRelationshipByHandle(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    clientRequestId: string;
    provider: string;
    dependentHandle: string;
    relationshipType: "parent" | "legal_guardian" | "court_authorized_guardian";
    authorityExpiresAt: string;
    externalReferenceSha256: string;
    stateNonceSha256: string;
    expiresAt: string;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "start_community_guardian_relationship_by_handle", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_provider: input.provider,
    p_dependent_handle: input.dependentHandle,
    p_relationship_type: input.relationshipType,
    p_authority_expires_at: input.authorityExpiresAt,
    p_external_reference_sha256: input.externalReferenceSha256,
    p_state_nonce_sha256: input.stateNonceSha256,
    p_expires_at: input.expiresAt,
    p_private_reason: input.privateReason
  });
}

export function loadCommunityProviderTransaction(
  client: SupabaseClient,
  input: { provider: string; externalReferenceSha256: string; stateNonceSha256: string }
): Promise<unknown> {
  return rpc(client, "get_community_provider_transaction", {
    p_provider: input.provider,
    p_external_reference_sha256: input.externalReferenceSha256,
    p_state_nonce_sha256: input.stateNonceSha256
  });
}

export function loadGuardianRelationshipForProvider(
  client: SupabaseClient,
  input: { actorUserId: string; relationshipId: string }
): Promise<unknown> {
  return rpc(client, "get_community_guardian_relationship_for_provider", {
    p_actor_user_id: input.actorUserId,
    p_relationship_id: input.relationshipId
  });
}

export function consumeCommunityProviderTransaction(
  client: SupabaseClient,
  input: {
    clientRequestId: string;
    provider: string;
    externalReferenceSha256: string;
    stateNonceSha256: string;
    resultEventSha256: string;
    resultStatus: "verified" | "failed";
    evidenceCode: string;
    ageBand: string | null;
    assuranceStatus: string | null;
    assuranceExpiresAt: string | null;
    jurisdictionCode: string | null;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "consume_community_provider_transaction", {
    p_client_request_id: input.clientRequestId,
    p_provider: input.provider,
    p_external_reference_sha256: input.externalReferenceSha256,
    p_state_nonce_sha256: input.stateNonceSha256,
    p_result_event_sha256: input.resultEventSha256,
    p_result_status: input.resultStatus,
    p_evidence_code: input.evidenceCode,
    p_age_band: input.ageBand,
    p_assurance_status: input.assuranceStatus,
    p_assurance_expires_at: input.assuranceExpiresAt,
    p_jurisdiction_code: input.jurisdictionCode,
    p_private_reason: input.privateReason
  });
}

export function imposeRestriction(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    targetHandle: string;
    clientRequestId: string;
    scope: string;
    restriction: string;
    reasonCode: string;
    privateReason: string;
    expiresAt: string | null;
  }
): Promise<unknown> {
  return rpc(client, "impose_community_restriction", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_target_handle: input.targetHandle,
    p_client_request_id: input.clientRequestId,
    p_scope: input.scope,
    p_restriction: input.restriction,
    p_reason_code: input.reasonCode,
    p_private_reason: input.privateReason,
    p_expires_at: input.expiresAt
  });
}

export function registerCommunityLegalDocumentVersion(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    clientRequestId: string;
    documentKey: string;
    documentVersion: string;
    publicPath: string;
    contentSha256: string;
    activate: boolean;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "register_community_legal_document_version", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_client_request_id: input.clientRequestId,
    p_document_key: input.documentKey,
    p_document_version: input.documentVersion,
    p_public_path: input.publicPath,
    p_content_sha256: input.contentSha256,
    p_activate: input.activate,
    p_private_reason: input.privateReason
  });
}

export function liftRestriction(
  client: SupabaseClient,
  input: {
    actorUserId: string;
    actorAal: "aal1" | "aal2";
    restrictionId: string;
    clientRequestId: string;
    privateReason: string;
  }
): Promise<unknown> {
  return rpc(client, "lift_community_restriction", {
    p_actor_user_id: input.actorUserId,
    p_actor_aal: input.actorAal,
    p_restriction_id: input.restrictionId,
    p_client_request_id: input.clientRequestId,
    p_private_reason: input.privateReason
  });
}
