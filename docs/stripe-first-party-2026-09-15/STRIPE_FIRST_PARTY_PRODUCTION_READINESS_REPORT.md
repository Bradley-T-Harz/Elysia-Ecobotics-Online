# Production readiness

## Implemented

- Provider-neutral Economic Kernel → BillingProvider → StripeProvider; database controls meaning, amount, consent, policy, ownership, capabilities and immutable accounting.
- Exact integer minor-unit rounding and recorded-basis reversal; first-party account approval in authoritative provider state.
- Hosted one-time/recurring Support, existing Job Post/service/sponsorship payment bridges, Portal, cancellations, refund commands, durable events and reconciliation.
- Separate environment/account checks at runtime, provider response, catalog, database and browser publication boundary. No test credential fallback in live.
- HMAC raw-body signatures, timestamp tolerance, event API version/account checks, inbox deduplication/advisory locking, outbound idempotency, bounded failed-event retries and late receipt/fee enrichment.
- Independent lane switches, prospective legal/consent version, provider readiness view, canonical Creator Studio/Forge entrances.
- Immutable third-party and Support-to-compute stops. Free authoring/publication remains independent of money.

## Qualification boundary

Application fixtures, database replays, type/build/browser results are evidence only for the tested layers. No real Stripe objects, test-card transactions, dashboard configuration or live account capability were verified. No bank, tax registration, receipt-email delivery or processor-fee rate is assumed. `tax_behavior=disabled` means application tax collection OFF, not a conclusion that tax is unnecessary.

Five lane gates require separate evidence, recorded tax disposition, legal qualification and rollout authorization. Provider approval alone cannot open a gate. A new live database cannot adopt a used sandbox database.

See STRIPE_TEST_MODE_ACCEPTANCE.md for the unexecuted provider cases and DEPLOYMENT_AND_ROLLBACK_REPORT.md for actual deployment results.
