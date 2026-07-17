# Accounting export contract

Economic exports are private operational records for reconciliation and professional accounting review. They are not public reports, customer identity exports, or tax conclusions.

## Stable categories

Exports must keep these categories separate:

- one-time voluntary support;
- recurring sustaining support;
- sandbox-credit sales;
- commercial Job Post fees;
- Marketplace buyer gross;
- Marketplace platform commission;
- Marketplace seller payable;
- refunds;
- disputes and chargebacks;
- processor fees;
- sponsorship revenue;
- organization and professional-service revenue.

Marketplace buyer gross must never be presented as EcoSyneva net revenue. Seller payables are liabilities until settled or validly adjusted.

## Minimum columns

An export implementation must use a versioned schema and, where applicable, stable values for:

`export_version`, `economic_event_id`, `effective_at`, `recorded_at`, `category`, `economic_flow`, `direction`, `gross_minor`, `refund_minor`, `dispute_minor`, `processor_fee_minor`, `platform_commission_minor`, `seller_payable_minor`, `net_minor`, `currency`, `internal_order_reference`, `provider`, `provider_event_date`, `jurisdiction_code`, `tax_treatment_pending_review`, and `reconciliation_status`.

Amounts use integer minor units. Currency uses normalized lowercase ISO-style codes. Historical price and fee snapshots are immutable.

The current test-mode webhook adapter records verified gross payment truth but does not retrieve Stripe balance-transaction settlement details. Until a separately reviewed provider-settlement reconciliation path records both values, `processor_fee_minor` and `net_minor` remain `null` and the export labels the row `settlement_details_pending`, never `recorded`. Test gross is therefore usable for webhook and entitlement verification, but the repository does not claim settled processor fees or net revenue. This is a live-activation blocker, not a value to estimate or infer.

The repository export is test-mode-only, covers at most 31 days per request, and returns at most 100 entries per cursor page (50 by default). The lower page ceiling keeps the complete JSON response within the billing browser client's hard transport limit. A single operator may create at most 60 new export pages per rolling hour; an exact idempotent replay does not consume another page or duplicate the audit event.

## Excluded data

Exports must not contain secret keys, webhook signatures, bearer tokens, raw provider payloads, card data, KYC documents, sandbox source code, Commune content, profile interests, private messages, waiver reasons, or unrelated profile fields. Provider references should be omitted unless a narrowly authorized reconciliation workflow requires them.

Final legal, tax, revenue-recognition, refund, escheatment, and Marketplace reporting treatment requires qualified professional review before live operation.
