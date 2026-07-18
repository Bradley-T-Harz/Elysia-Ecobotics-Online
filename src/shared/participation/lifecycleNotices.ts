export const COMMUNITY_EXPORT_NOTICE_VERSION = "community-data-export-request-2026-07-18";
export const COMMUNITY_DELETION_NOTICE_VERSION = "community-account-deletion-request-2026-07-18";

export const communityLifecycleNotice = Object.freeze({
  export: {
    version: COMMUNITY_EXPORT_NOTICE_VERSION,
    title: "Request a copy of shared public-community account data",
  },
  deletion: {
    version: COMMUNITY_DELETION_NOTICE_VERSION,
    title: "Request shared account deletion and deactivation review",
  },
});
