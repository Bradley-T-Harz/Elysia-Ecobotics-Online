# Secret bindings

The complete authoritative destination/name matrix, restricted permissions and empty templates are in [the exact human runbook](STRIPE_DASHBOARD_HUMAN_RUNBOOK.md#1-exact-destinations-and-bindings). Setup credentials now use STRIPE_PROVISIONING_KEY_TEST / STRIPE_PROVISIONING_KEY_LIVE in a secure process only; no runtime-key fallback. This supersedes the older provisioner invocation's key selection. No actual credential is included in this packet. Both deployed Workers were inspected by binding names only; neither had secret bindings at the start of this execution.
