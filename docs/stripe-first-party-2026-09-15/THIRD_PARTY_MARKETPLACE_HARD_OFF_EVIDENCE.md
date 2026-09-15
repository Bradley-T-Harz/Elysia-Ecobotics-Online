# Third-party hard OFF

Worker routing rejects paid Marketplace Checkout, seller onboarding/status refresh, seller payout preparation and paid compute Checkout. Shared feature guards reject those operations even if flags say true. Stripe adapter onboarding/status/catalog methods throw before network. Checkout flow allowlist includes only the five authorized first-party flows. Database feature resolution returns false for seller onboarding, paid offers, payout preparation/payouts and compute purchase. Support-to-compute program configuration, activation and grant are rejected; the old payment trigger is a no-op.

No Connect calls, connected accounts, seller KYC/bank onboarding, transfers, payouts, settlement execution, paid hosted compute or hardware products are provisioned by the new script. Synthetic guard tests assert rejection without network calls. Disposable DB tests set old forbidden flags true and still observe false capability.

Free seller/profile/publisher links, free offers/licenses and catalog access no longer require a paid-commerce flag. Free offer activation still passes canonical ownership/review checks; paid activation is blocked by database hard OFF. Canonical creator profile, drafts, manifests, submissions, review, publisher ownership and free publication remain on existing surfaces. Authenticated production actions are not fabricated during public smoke tests; existing qualified ownership audits are preserved.

A forward migration also rejects purchased/recurring_support credit sources at the credit-lot INSERT boundary and the direct grant RPC. Existing lot/history rows are preserved. Free allowance grants and expiration reconciliation use ordinary service authorization without depending on Stripe account headers.
