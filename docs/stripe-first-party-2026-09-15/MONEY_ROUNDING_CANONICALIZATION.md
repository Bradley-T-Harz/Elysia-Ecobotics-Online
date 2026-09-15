# Canonical money arithmetic

New fees use integer minor units and half-up basis-point division through shared BigInt-backed helpers, bounded to safe integer inputs. Canonical 5% examples: 99 cents → 5; 199 → 10; 200 → 10; 10 → 1; 9 → 0. SQL uses equivalent integer arithmetic. No floating monetary value is authoritative.

Refund/dispute reversal uses the **historically recorded fee basis**, apportioned cumulatively. Successive partial reversals cannot exceed that original fee and the final full reversal equals it. Historical transactions, fees and legal acceptances are not rewritten. Immutable ledger evidence is extended with adjustments and late provider settlement evidence.

Qualification: moneyCanonicalizationTest.mts, migration 20260915010000, disposable SQL behavior fixtures including edge cases and replay. Support custom input is an expressly chosen amount validated against canonical bounds; fixed tiers, Job Post, service and sponsorship amounts come from server-owned records. Browser-returned totals cannot override them.
