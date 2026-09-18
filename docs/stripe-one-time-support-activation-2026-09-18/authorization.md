# Owner authorization — 2026-09-18

Bradley Harz, owner of EcoSyneva Commons LLC, explicitly authorized production ONE-TIME SUPPORT activation in this execution session. Authority is limited to this lane and its webhook/retry/reconciliation/refund machinery. No payment submission is authorized for this verification.

Recurring Support, commercial Job Posts, services, sponsorship remain OFF. Marketplace, Connect, seller onboarding/KYC, creator payouts, paid compute and physical commerce remain hard OFF. No catalog provisioning, migrations or tax registration are required. Support automatic tax stays disabled and its dedicated payment-method configuration excludes installments/BNPL, crypto and OXXO.

## Rollback

Apply `pause-acquisition.sql` against the linked production project `qwmcstyfegvpzjmjrylc` to close the database gate immediately. Set `BILLING_SUPPORT_CHECKOUT_ENABLED=false` and `BILLING_ENABLED=false` in the production Worker and redeploy; retain LIVE mode, webhook/retry/refund processing for existing obligations. Remove `VITE_BILLING_API_PUBLICATION=live` from the production build command and redeploy Pages if unpublishing is needed. Never disable signature/environment validation. Other acquisition lanes must remain OFF.
