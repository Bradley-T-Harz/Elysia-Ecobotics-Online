export type MarketplaceSubmissionReadinessInput = {
  supabaseConfigured: boolean;
  signedIn: boolean;
  developerProfileAvailable: boolean;
  manifestBlocked: boolean;
  intakeBlocked: boolean;
  uploadDisclosureAccepted: boolean;
  permissionReasonsComplete: boolean;
  elevatedPermissionRequested: boolean;
  elevatedRiskAccepted: boolean;
  submitting: boolean;
};

export type MarketplaceSubmissionBlocker =
  | "remote_review_not_configured"
  | "sign_in_required"
  | "developer_profile_required"
  | "manifest_blocked"
  | "package_intake_blocked"
  | "upload_disclosure_required"
  | "permission_reasons_required"
  | "elevated_risk_acknowledgement_required"
  | "submission_in_progress";

export const marketplaceSubmissionOutcome = Object.freeze({
  submissionStatus: "pending",
  reviewItemStatus: "pending_review",
  privateStorage: true,
  autoPublicListing: false,
  installAuthorityGranted: false
});

export function evaluateMarketplaceSubmissionReadiness(input: MarketplaceSubmissionReadinessInput) {
  const blockers: MarketplaceSubmissionBlocker[] = [];
  if (!input.supabaseConfigured) blockers.push("remote_review_not_configured");
  if (!input.signedIn) blockers.push("sign_in_required");
  if (!input.developerProfileAvailable) blockers.push("developer_profile_required");
  if (input.manifestBlocked) blockers.push("manifest_blocked");
  if (input.intakeBlocked) blockers.push("package_intake_blocked");
  if (!input.uploadDisclosureAccepted) blockers.push("upload_disclosure_required");
  if (!input.permissionReasonsComplete) blockers.push("permission_reasons_required");
  if (input.elevatedPermissionRequested && !input.elevatedRiskAccepted) blockers.push("elevated_risk_acknowledgement_required");
  if (input.submitting) blockers.push("submission_in_progress");
  return { ready: blockers.length === 0, blockers } as const;
}

export function marketplaceSubmissionBlockerMessage(blocker: MarketplaceSubmissionBlocker | undefined) {
  switch (blocker) {
    case "remote_review_not_configured": return "Remote Marketplace review storage is not configured.";
    case "sign_in_required": return "Sign in before creating a remote Marketplace review submission.";
    case "developer_profile_required": return "Create a Developer Forge profile before remote submission.";
    case "manifest_blocked": return "Fix blocking manifest findings before submitting.";
    case "package_intake_blocked": return "Remove blocked package material before submitting.";
    case "upload_disclosure_required": return "Confirm that selected files leave this computer for private review.";
    case "permission_reasons_required": return "Explain every requested permission before submitting.";
    case "elevated_risk_acknowledgement_required": return "Acknowledge the elevated permission risk before submitting.";
    case "submission_in_progress": return "The current submission is still in progress.";
    default: return "Complete validation, permission review, and the upload disclosure before submitting.";
  }
}
