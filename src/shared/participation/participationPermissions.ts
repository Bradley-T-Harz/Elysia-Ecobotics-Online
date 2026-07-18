import type { CommunityAccess, ParticipationAction } from "./participationTypes";

const permissionField: Readonly<Record<ParticipationAction, keyof CommunityAccess>> = Object.freeze({
  joinArtisan: "canJoinArtisan",
  postArtisan: "canPostArtisan",
  commentArtisan: "canCommentArtisan",
  uploadImage: "canUploadImage",
  submitChallenge: "canSubmitChallenge",
});

export function participationAllows(access: CommunityAccess, action: ParticipationAction): boolean {
  return access[permissionField[action]] === true;
}

export function participationStateMessage(access: CommunityAccess): string {
  switch (access.participationState) {
    case "adult_eligible":
    case "teen_eligible":
      return "This action is not enabled for the account's current participation scope.";
    case "teen_pending":
      return "Teen participation remains pending until the required safety, assurance, consent, and feature gates are active.";
    case "under13_pending":
      return "Younger-participant features remain disabled until the separate guardian-consent program is legally and operationally activated.";
    case "under13_eligible":
      return "This younger-participant action is outside the account's currently approved guardian-consent scope.";
    case "restricted":
      return "A scoped community restriction currently prevents this action.";
    case "suspended":
      return "Community participation is currently suspended for this account.";
    case "blocked":
      return "This account is blocked from community participation.";
    case "deletion_pending":
      return "New community actions are paused while an account-deletion request is pending.";
    case "deactivated":
      return "This account is deactivated and cannot perform new community actions.";
    case "read_only":
    default:
      return "This account currently has read-only community access.";
  }
}
