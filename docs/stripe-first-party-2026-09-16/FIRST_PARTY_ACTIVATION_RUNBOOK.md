# Controlled activation

Follow the [exact updated human/configuration/preflight runbook](STRIPE_DASHBOARD_HUMAN_RUNBOOK.md). The [existing reviewed SQL-control workflow](../stripe-first-party-2026-09-15/FIRST_PARTY_ACTIVATION_RUNBOOK.md) remains valid except that setup scripts now require separate STRIPE_PROVISIONING_KEY_TEST/LIVE credentials and explicit mode-correct public origin. Runtime keys do not need catalog-write permissions.

The provider preflight is configuration-only and never records acceptance. Retain all acquisition OFF until actual sandbox evidence, protected test runtime, deployed rate-control verification, provider account identity, signatures, receipts, refund/reconciliation, tax and legal decisions pass. Then management/retry first, acquisition one lane at a time in the authorized order. Do not create live test charges. Preserve third-party/paid-compute/hardware hard stops.
