# Marketplace Publish/Revoke Pipeline

Developer Forge submissions are private review records until an authorized Marketplace reviewer publishes them. Approval and publication are separate actions.

Flow:

1. A developer submits an add-on draft from Developer Forge.
2. Reviewers inspect manifest metadata, declared permissions, validation results, static scan output, compatibility results, and private package metadata.
3. A reviewer may request changes, reject, place the submission on security hold, or approve it.
4. Only after approval may a reviewer explicitly publish a Marketplace listing/version.
5. Published listings can create website install intents, but Local Elysia remains the final installer and permission authority.
6. Reviewers can revoke a listing or a version. Revocation blocks new install intents for the revoked target.

Publication does not sign a package unless a real signing system reports that status. Unsigned packages must remain labeled `unsigned`.

The website never executes packages, package scripts, dependency hooks, build hooks, shell commands, or user-submitted repositories.
