# Third-party money hard OFF

Existing [database/provider/HTTP defenses and evidence](../stripe-first-party-2026-09-15/THIRD_PARTY_MARKETPLACE_HARD_OFF_EVIDENCE.md) remain in force. Five forbidden HTTP money routes return 404; adapter seller onboarding/catalog methods throw third_party_money_hard_off; money feature enablement is rejected independently of flag values. No Connect event subscription, key write permission, seller provisioning, transfer or payout call was introduced. Direct purchased/recurring-support compute grants remain database-prohibited.

The new native rate limiter excludes free agreement, publisher ownership and free license routes. Free Creator Studio/Forge drafting/manifests/submissions/review/publication remain available. Production endpoint verification is recorded in DEPLOYMENT_AND_ROLLBACK_REPORT.md.
