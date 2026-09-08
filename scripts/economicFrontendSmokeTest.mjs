import fs from "node:fs/promises";
import { exactUsdDecimalToMinor } from "../src/shared/billing/exactMoney.ts";

// Presentation and browser-contract guardrails only. These source checks do not
// prove Auth, database, Stripe, webhook, RLS, or live economic behavior.
async function read(file) {
  return fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const app = await read("src/App.tsx");
const indexHtml = await read("index.html");
const support = await read("src/pages/Support/index.tsx");
const archive = await read("src/pages/The-Elysia-Archive/index.tsx");
const thankYou = await read("src/pages/Support/SupportThankYouPage.tsx");
const forgotPassword = await read("src/pages/Account/AccountForgotPasswordPage.tsx");
const recovery = await read("src/pages/Account/AccountRecoveryPage.tsx");
const paymentRecord = await read("src/shared/billing/PaymentRecordCard.tsx");
const supportBilling = await read("src/pages/The-Commons-Circle/SupportBillingPage.tsx");
const hostedAllowance = await read("src/pages/The-Commons-Circle/HostedExecutionAllowancePage.tsx");
const commonsCircle = await read("src/pages/The-Commons-Circle/index.tsx");
const operator = await read("src/pages/Admin/EconomicOperationsPage.tsx");
const organizationSponsorshipOperator = await read("src/pages/Admin/EconomicOrganizationSponsorshipOperations.tsx");
const organizationSponsorshipAccount = await read("src/pages/The-Commons-Circle/OrganizationSponsorshipAccountPanel.tsx");
const billingClient = await read("src/shared/billing/billingClient.ts");
const checkoutReturnStatus = await read("src/shared/billing/CheckoutReturnStatus.tsx");
const marketplaceDetails = await read("src/pages/The-Elysia-Marketplace/components/AddonDetails.tsx");
const marketplaceCommerce = await read("src/pages/The-Elysia-Marketplace/components/MarketplaceCommercePanel.tsx");
const marketplaceAccount = await read("src/pages/The-Elysia-Marketplace/components/MarketplaceCommerceAccountPanel.tsx");
const marketplaceAccountPage = await read("src/pages/The-Elysia-Marketplace/pages/AccountPage.tsx");
const marketplaceHome = await read("src/pages/The-Elysia-Marketplace/pages/HomePage.tsx");
const commune = await read("src/pages/The-Elysia-Commune/index.tsx");
const communeApi = await read("src/pages/The-Elysia-Commune/communeAccountApi.ts");
const marketplaceCommerceMigration = await read("supabase/migrations/20260716050000_marketplace_commerce_licenses_and_seller_accounting.sql");
const stripeCatalog = await read("scripts/billingStripeTestCatalog.mjs");
const styles = await read("src/styles.css");

assert(
  indexHtml.includes('<meta name="elysia-billing-api-publication" content="disabled" />')
    && billingClient.includes('meta[name="elysia-billing-api-publication"]')
    && billingClient.includes('currentBillingApiPublication() === "disabled"')
    && billingClient.includes('new BillingRequestError(genericUnavailableMessage, 503, "billing_disabled")'),
  "The unpublished billing Worker must fail closed in the browser before any /api/billing request."
);

for (const [value, expected] of [["0.29", 29], ["0.58", 58], ["1", 100], ["1.2", 120], ["100000.00", 10_000_000]]) {
  assert(exactUsdDecimalToMinor(value) === expected, `Exact USD parser changed a legitimate decimal amount: ${value}.`);
}
for (const value of ["0.001", "1e2", "-1", "+1", " 1.00", "1.00 ", "01.00", ".58", "NaN", "90071992547409.92"]) {
  assert(exactUsdDecimalToMinor(value) === null, `Exact USD parser accepted a non-canonical, fractional-cent, or unsafe amount: ${value}.`);
}

for (const route of [
  "support",
  "support/thank-you",
  "account/forgot-password",
  "account/recovery",
  "commons-circle/support-billing",
  "admin/economic-operations"
]) {
  assert(app.includes(`path="${route}"`), `Economic/account route is missing: /${route}`);
}

assert(
  support.includes('to="/archive">Continue without contributing</Link>')
    && support.includes("Local Elysia and ordinary community participation remain free")
    && support.includes("A website account is not required for ordinary local use"),
  "Support must retain an equally visible free path and explain account-free local use."
);
assert(
  archive.includes("$0 — Local Elysia release")
    && archive.includes("No Website Account, email, Stripe checkout")
    && archive.includes("Go to free downloads")
    && archive.includes('href="#release-downloads-title"')
    && archive.includes('to="/support?source=products#support-checkout"')
    && archive.includes('to="/support?source=products">Learn about separate optional support</Link>')
    && archive.includes('id="release-availability">Elysia {releaseManifest.version}</h2>')
    && support.includes('searchParams.get("source") === "products"')
    && support.includes('supportSourceRoute = fromLocalRelease ? "/products"')
    && support.includes('useState<string>(fromLocalRelease ? "" : "500")')
    && support.includes("The optional pay-what-you-can release context offers one-time support only")
    && support.includes("Nothing is being unlocked")
    && support.includes("Return to $0 release path"),
  "Pay-what-you-can Local Elysia UX must keep the $0 no-account release path first-class and isolate optional `/products` support checkout."
);
assert(
  support.includes('useState<RecurringSupportPriceCode | "">("")')
    && support.includes("checked={recurringPriceCode === plan.code}")
    && support.includes("No recurring option is preselected"),
  "Recurring support must begin unselected and say so plainly."
);
assert(
  !support.includes("const supportTermsVersion")
    && billingClient.includes("marketplaceBuyerTerms")
    && billingClient.includes("support_one_time_checkout_bundle")
    && billingClient.includes("support_recurring_checkout_bundle")
    && billingClient.includes("sandbox_credits_checkout_bundle")
    && billingClient.includes("job_post_fee_checkout_bundle")
    && billingClient.includes("marketplace_purchase_checkout_bundle")
    && billingClient.includes("marketplace_free_license_bundle")
    && billingClient.includes("organization_service_checkout_bundle")
    && billingClient.includes("sponsorship_checkout_bundle")
    && billingClient.includes("{0,119}")
    && support.includes("consentVersion: activeSupportBundle.version"),
  "Checkout consent must use exact server-published document maps and complete bundle versions; the browser must not hardcode a legal version."
);
assert(
  support.includes("guest checkout")
    && supportBilling.includes("Continue with guest one-time support")
    && supportBilling.includes("One-time support remains optional"),
  "Guest and one-time support paths must remain optional and understandable."
);

for (const neutralLabel of ["$1 monthly support", "$5 monthly support", "$12 monthly support", "$25 monthly support", "$50 monthly support"]) {
  assert(support.includes(neutralLabel) && stripeCatalog.includes(neutralLabel), `Neutral recurring label is not aligned with hosted test checkout: ${neutralLabel}`);
}
for (const forbiddenLabel of ["Seed Supporter", "Commons Sustainer", "Infrastructure Sustainer", "Sandbox Sustainer", "Commons Patron"]) {
  assert(!support.includes(forbiddenLabel) && !stripeCatalog.includes(forbiddenLabel), `Wealth- or rank-like recurring label returned: ${forbiddenLabel}`);
}
assert(
  support.includes("does not grant personal sandbox units")
    && support.includes("no authority, rank, or public financial status")
    && supportBilling.includes("This is not an upgrade-membership page"),
  "Support presentation must not imply credits, rank, authority, or a paid membership tier."
);
assert(
  support.includes("Begin with a human-reviewed proposal, not a self-serve purchase")
    && support.includes('href="mailto:contact@elysiaecobotics.com?subject=Organization%20services%20or%20ethical%20sponsorship%20inquiry"')
    && support.includes('to="/legal/organization-services-terms"')
    && support.includes('to="/legal/sponsorship-independence-policy"')
    && support.includes("Waived and subsidized access remain legitimate and private"),
  "Organization services and sponsorship need a manual, privacy-preserving public inquiry path with no self-serve authority purchase."
);
assert(
  billingClient.includes('billingFetch("/api/billing/organizations/status"')
    && billingClient.includes('billingFetch("/api/billing/sponsorships/recognition"')
    && billingClient.includes("financialDetailsPrivate !== true")
    && billingClient.includes("affectsCommonsIdentity !== false")
    && billingClient.includes("item.grantsAuthority !== false")
    && billingClient.includes("item.isEndorsement !== false"),
  "Organization and sponsorship browser projections must enforce private-finance, Commons-identity, authority, and endorsement boundaries."
);
assert(
  support.includes("Reviewed, opt-in acknowledgments")
    && support.includes("Amounts, agreement terms, contacts, payment state, waivers, and balances remain private")
    && organizationSponsorshipAccount.includes("Your private signer relationships")
    && organizationSponsorshipAccount.includes("Public profile organization text does not create one")
    && supportBilling.includes("Assistance status, reasons, program eligibility, balances, and financial circumstances are private"),
  "Public sponsor recognition and self organization/assistance views must remain bounded, private, and non-stigmatizing."
);
assert(
  billingClient.includes('billingFetch("/api/billing/support-recognition"')
    && billingClient.includes('recognition.ranked !== false')
    && billingClient.includes('recognition.amountsPublic !== false')
    && support.includes("Community members who chose acknowledgment")
    && support.includes("unranked list")
    && support.includes("never publishes an amount"),
  "Public support recognition must remain opt-in, unranked, no-amount, and no-authority."
);
assert(
  billingClient.includes('["username", "displayName", "grantsAuthority", "amountPublic"]')
    && !billingClient.includes('PublicSupportRecognition = { profileId')
    && support.includes('key={supporter.username}')
    && !support.includes('key={supporter.profileId}'),
  "Public support recognition must use a public username key and never expose an Auth-linked profile UUID."
);

assert(
  support.includes('role="alert" tabIndex={-1} ref={errorRef}')
    && support.includes('aria-live="polite"')
    && support.includes("errorRef.current?.focus()")
    && support.includes("disabled={!canSubmit}"),
  "Support checkout must retain focusable errors, a polite status region, and disabled submit state."
);
assert(
  thankYou.includes('aria-live="polite" aria-busy={loading}')
    && thankYou.includes("browser redirect alone is not proof of payment")
    && thankYou.includes("server—not this page—decides"),
  "Thank-you presentation must remain a live server-verification state, never redirect proof."
);
assert(
  forgotPassword.includes('htmlFor="recovery-email"')
    && forgotPassword.includes('autoComplete="email"')
    && !forgotPassword.includes("autoFocus")
    && forgotPassword.includes('role="alert" tabIndex={-1} ref={errorRef}')
    && forgotPassword.includes("errorRef.current?.focus()")
    && forgotPassword.includes("does not confirm whether an account exists"),
  "Forgot-password form must retain labels, autocomplete, user-triggered focused errors, and anti-enumeration copy without route-entry autofocus."
);
assert(
  recovery.includes('htmlFor="new-password"')
    && recovery.includes('htmlFor="confirm-new-password"')
    && (recovery.match(/autoComplete="new-password"/g) ?? []).length === 2
    && recovery.includes('role="status"')
    && recovery.includes('role="alert"')
    && recovery.includes("errorRef.current?.focus()")
    && recovery.includes("!session || !recoveryMode"),
  "Password recovery must retain explicit labels, password-manager hints, status/errors, focus handling, and recovery-event gating."
);
assert(
  supportBilling.includes('aria-live="polite"')
    && supportBilling.includes('role="group" aria-label="Continue to recurring support cancellation"')
    && supportBilling.includes("disabled={actionBusy !== null}")
    && supportBilling.includes("Manage billing in Stripe"),
  "Support & Billing must retain loading feedback, explicit cancellation confirmation, and double-submit protection."
);
assert(
  billingClient.includes("projectionCoverage: BillingAccountProjectionCoverage")
    && billingClient.includes('receipts: hasOwnProjection(source, "receipts")')
    && billingClient.includes('marketplacePurchases: hasOwnProjection(source, "marketplacePurchases", "marketplace_purchases")')
    && billingClient.includes('"sandbox", "sandbox_credits", "sandboxCredits"')
    && billingClient.includes('source.jobPosts ?? source.jobPostPayments')
    && billingClient.includes('"seller", "seller_finance", "marketplaceSeller"')
    && billingClient.includes("normalizeEconomicAccountRequests(source.accountRequests)")
    && billingClient.includes("source.providerIdentifiersExposed !== false")
    && billingClient.includes("source.moneyDoesNotGrantAuthority !== true")
    && supportBilling.includes("This does not mean no receipt exists")
    && supportBilling.includes("View Hosted Execution Allowance")
    && supportBilling.includes("This does not mean no license exists")
    && supportBilling.includes("No conclusion about whether a fee record exists is being made here")
    && commonsCircle.includes("Missing projections are never presented as proof that no record exists"),
  "Missing account-summary projections must never be presented as proof that the user has no receipt, Marketplace license, or Job Post fee record, and hosted allowance must use its own authoritative page."
);
assert(
  !supportBilling.includes("SandboxCreditPurchasePanel")
    && supportBilling.includes("Additional paid hosted execution is unavailable")
    && hostedAllowance.includes("Additional paid allowance")
    && hostedAllowance.includes("No paid top-up is offered")
    && hostedAllowance.includes("Voluntary support does not grant personal units or priority")
    && supportBilling.includes("<CheckoutReturnStatus")
    && checkoutReturnStatus.includes("Browser return alone is not proof of payment or fulfillment")
    && checkoutReturnStatus.includes("loadBillingOrder(orderReference, accessToken)"),
  "Paid hosted allowance must remain visibly unavailable and separate from support while historical return reconciliation remains truthful."
);
assert(
  checkoutReturnStatus.includes("loadBillingOrder(orderReference, accessToken)")
    && checkoutReturnStatus.includes("order?.flow === expectedFlow")
    && checkoutReturnStatus.includes("The private order belongs to a different economic flow")
    && checkoutReturnStatus.includes("No service-specific payment or fulfillment is being claimed")
    && checkoutReturnStatus.includes("refreshAccountProjection ? onRefresh()")
    && checkoutReturnStatus.includes("const sequence = ++sequenceRef.current")
    && checkoutReturnStatus.includes("if (sequence !== sequenceRef.current) return")
    && checkoutReturnStatus.includes("Browser return alone is not proof of payment or fulfillment")
    && commune.includes('returnParameters.get("job-payment")')
    && commune.includes('returnParameters.get("order") ?? ""')
    && commune.includes("loadBillingOrder(orderReference, accessToken)")
    && commune.includes('returnOrder?.flow === "job_post_fee"')
    && commune.includes("It is not being labeled as this Job Post fee")
    && commune.includes("loadJobPostOwnerEconomicStatus(jobPostId, accessToken)")
    && commune.includes("loadBillingCapabilities()")
    && commune.includes("const sequence = ++refreshSequenceRef.current")
    && commune.includes("if (sequence !== refreshSequenceRef.current) return")
    && commune.includes("Check verified fee status again")
    && commune.includes("Browser return alone is not proof of payment, fulfillment, content approval, or publication"),
  "Checkout returns must verify the exact private order, refresh the authoritative service projection, ignore stale async results, and never treat a browser redirect as fulfillment."
);
assert(
  billingClient.includes("flow: BillingOrderFlow | null")
    && billingClient.includes('exactRecord(data, ["ok", "order"]')
    && billingClient.includes("strictBillingOrderFlow(source.flow)")
    && billingClient.includes("source.publicReference !== reference")
    && supportBilling.includes('["sandbox-payment", "sandbox_credits"')
    && supportBilling.includes('["organization-payment", "organization_service"')
    && supportBilling.includes('["sponsorship-payment", "sponsorship"')
    && marketplaceAccount.includes('expectedFlow="marketplace_purchase"'),
  "Private checkout returns must retain a strict canonical order flow and bind each service surface to its own expected flow."
);
assert(
  marketplaceDetails.includes("<MarketplaceCommercePanel addon={addon} />")
    && marketplaceAccountPage.includes("<MarketplaceCommerceAccountPanel />")
    && marketplaceDetails.includes("Review permissions")
    && marketplaceDetails.includes("Prepare Local Install"),
  "Marketplace commerce must remain additive beside the existing free review and local-install preparation paths."
);
for (const path of ["/api/billing/marketplace/catalog", "/api/billing/marketplace/checkout", "/api/billing/marketplace/free-license", "/api/billing/marketplace/purchases", "/api/billing/seller/status", "/api/billing/seller/status-refresh", "/api/billing/seller/onboarding", "/api/billing/seller/free-agreement", "/api/billing/seller/publisher-link", "/api/billing/seller/offer", "/api/billing/seller/offer-activation"]) {
  assert(billingClient.includes(`billingFetch("${path}"`), `Strict Marketplace browser client is missing ${path}.`);
}
assert(
  marketplaceCommerce.includes("clientRequestIdRef.current ||=")
    && marketplaceCommerce.includes("offer.buyerTermsVersion")
    && marketplaceCommerce.includes("does not download, install, approve, or authorize")
    && !marketplaceCommerce.includes("prepareLocalInstall")
    && !marketplaceCommerce.includes("installIntent"),
  "Marketplace offer UI must use stable idempotency/terms and must never invoke the install path."
);
assert(
  marketplaceCommerce.includes('noValidate aria-labelledby="marketplace-commerce-title"')
    && marketplaceCommerce.includes('role="alert" tabIndex={-1} ref={errorRef}')
    && marketplaceCommerce.includes('role="status" aria-live="polite" aria-atomic="true"')
    && marketplaceCommerce.includes("errorRef.current?.focus()")
    && marketplaceCommerce.includes("disabled={!canSubmit}"),
  "Marketplace offer form must retain an explicit accessible name, focused errors, polite status, and guarded submit state."
);
assert(
  marketplaceAccount.includes("sellerAgreementAccepted")
    && marketplaceAccount.includes("connectDisclosureAccepted")
    && marketplaceAccount.includes("acceptSellerAgreement: true")
    && marketplaceAccount.includes("acceptStripeConnectDisclosure: true")
    && marketplaceAccount.includes("Provider return alone does not establish seller readiness")
    && marketplaceAccount.includes("onClick={() => void refreshSeller()}")
    && !supportBilling.includes("createSellerOnboarding"),
  "Seller onboarding must require two explicit consents and provider refresh must occur only after an explicit user action."
);
assert(
  marketplaceAccount.includes("ACCEPT FREE MARKETPLACE SELLER AGREEMENT")
    && marketplaceAccount.includes("Stripe Connect is not required for free offers")
    && marketplaceAccount.includes("seller?.freeSellerAgreementVersion")
    && marketplaceAccount.includes("freeSellerAgreementDocument.version")
    && marketplaceAccount.includes("buyerTermsVersion={capabilities.legalDocumentVersions.marketplaceBuyerTerms.version}")
    && !marketplaceAccount.includes('const sellerAgreementVersion = "2026')
    && !marketplaceAccount.includes('const buyerTermsVersion = "2026')
    && !marketplaceAccount.includes('const stripeConnectDisclosureVersion ='),
  "Free seller setup must not force Connect, must survive reload through private status, and all seller/buyer agreement versions must come from canonical capabilities."
);
assert(
  marketplaceAccount.includes('sellerReturnState === "returned"')
    && marketplaceAccount.includes('sellerReturnState === "refresh"')
    && marketplaceAccount.includes("hosted onboarding link expired or was already visited")
    && marketplaceAccount.includes("review and reaccept both disclosures")
    && marketplaceAccount.includes("this return page does not create a link automatically")
    && marketplaceAccount.includes("Create fresh Stripe Connect test link")
    && marketplaceAccount.includes('<form className="seller-onboarding-consent" onSubmit={beginOnboarding}'),
  "Stripe Connect return and expired-link states must remain distinct; creating a fresh hosted link requires a newly submitted, dual-consent form."
);
assert(
  marketplaceAccount.includes("useState(false)")
    && marketplaceAccount.includes('useState<"free" | "paid" | "">("")')
    && marketplaceAccount.includes('<option value="">Choose one reviewed version</option>')
    && marketplaceAccount.includes('role="alert" tabIndex={-1} ref={errorRef}')
    && marketplaceAccount.includes('role="status" aria-live="polite" aria-atomic="true"')
    && marketplaceAccount.includes("errorRef.current?.focus()")
    && marketplaceAccount.includes('autoComplete="off"')
    && marketplaceAccount.includes("disabled={!canConfigure}"),
  "Seller forms must start unselected/unchecked and retain labeled controls, focused errors, live status, typed confirmation, and disabled submission."
);
assert(
  billingClient.includes('billingFetch("/api/billing/seller/offer"')
    && billingClient.includes('billingFetch("/api/billing/seller/offer-activation"')
    && billingClient.includes("setMarketplaceSellerOfferStatus")
    && billingClient.includes("marketplaceSellerOfferStatusConfirmations[input.targetStatus]")
    && marketplaceAccount.includes("CONFIGURE MARKETPLACE TEST OFFER")
    && marketplaceAccount.includes("No new offer kind is preselected")
    && marketplaceAccount.includes("Configure inactive test offer")
    && marketplaceAccount.includes("marketplaceOfferTargets")
    && billingClient.includes("ACTIVATE MARKETPLACE TEST OFFER")
    && billingClient.includes("SUSPEND MARKETPLACE TEST OFFER")
    && billingClient.includes("RETIRE MARKETPLACE TEST OFFER")
    && marketplaceAccount.includes("requestIdRef.current ||=")
    && !marketplaceAccount.includes("pendingOffer")
    && !marketplaceAccount.includes("activateMarketplaceSellerOffer")
    && marketplaceAccount.includes("server enforces ownership"),
  "Eligible sellers need reload-safe, idempotent offer configuration and lifecycle controls that preserve review/version ownership checks."
);
assert(
  marketplaceAccount.includes("reviewedVersions={seller.eligibleReviewedVersions}")
    && marketplaceAccount.includes("publisherOptions={seller.publisherOptions}")
    && marketplaceAccount.includes("<SellerPublisherLinkForm")
    && marketplaceAccount.includes("linkMarketplaceSellerPublisher({")
    && marketplaceAccount.includes("Only an already-linked publisher owned by this account may be selected")
    && marketplaceAccount.includes("exactUsdDecimalToMinor(amountDollars)")
    && !marketplaceAccount.includes("Math.round")
    && support.includes("exactUsdDecimalToMinor(customAmount) ?? 0")
    && !support.includes("Math.round")
    && billingClient.includes('billingFetch("/api/billing/seller/publisher-link"')
    && billingClient.includes("publisherVerifiedChanged !== false")
    && billingClient.includes('"totalOwnedOfferCount", "offersTruncated", "ownedOffers"')
    && billingClient.includes('"eligibleReviewedVersionCount", "eligibleReviewedVersionsTruncated"')
    && billingClient.includes('"publisherOptionCount", "publisherOptionsTruncated"')
    && billingClient.includes('typeof link.idempotentReplay !== "boolean"')
    && billingClient.includes('typeof offer.idempotentReplay !== "boolean"')
    && marketplaceAccount.includes("Load draft into revision form")
    && marketplaceAccount.includes("Draft details loaded from the durable private seller projection")
    && marketplaceAccount.includes("safely revises the existing inactive draft")
    && marketplaceAccount.includes("seller.offersTruncated")
    && marketplaceAccount.includes("seller.publisherOptionsTruncated")
    && marketplaceAccount.includes("seller.eligibleReviewedVersionsTruncated")
    && marketplaceCommerceMigration.includes("where developer.user_id = v_actor")
    && marketplaceCommerceMigration.includes("and addon_version.review_status = 'approved'")
    && marketplaceCommerceMigration.includes("and addon_version.revoked_at is null")
    && marketplaceCommerceMigration.includes("where publisher.owner_id = v_actor")
    && marketplaceCommerceMigration.includes("publisher.id = p_publisher_id and publisher.owner_id = p_actor_user_id")
    && marketplaceCommerceMigration.includes("or v_developer.user_id <> p_actor_user_id")
    && marketplaceCommerceMigration.includes("publisher_verified_changed', false"),
  "Marketplace offer setup must strictly consume bounded durable offer/version/publisher projections, revise recoverable drafts, link only owned publishers without changing verification, and reject fractional-cent prices instead of rounding them."
);
assert(
  marketplaceAccount.includes("seller.payoutsEnabledByFeature")
    && marketplaceAccount.includes("Private test accounting summary")
    && marketplaceAccount.includes("Real payouts remain disabled"),
  "Marketplace Account must distinguish private test accounting from real payout readiness."
);
assert(
  marketplaceAccount.includes("<CheckoutReturnStatus")
    && checkoutReturnStatus.includes("Browser return alone is not proof of payment or fulfillment")
    && marketplaceAccount.includes("Verified payment and a separately fulfilled license")
    && marketplaceAccount.includes("This license does not authorize installation")
    && !marketplaceAccount.includes("providerAccountReference")
    && !marketplaceAccount.includes("disabledReason"),
  "Marketplace Account must not treat redirects as fulfillment or expose provider identifiers/private KYC reasons."
);
assert(
  marketplaceHome.includes('searchParams.get("commerce") === "canceled"')
    && marketplaceHome.includes("No completed payment, fulfilled license, trust change, download, or installation is being claimed")
    && marketplaceHome.includes("Paid transactions not active"),
  "Marketplace checkout cancellation must land on an honest, test-only state rather than a false success or obsolete no-payments claim."
);
assert(
  operator.includes('role="status" aria-live="polite" aria-atomic="true"')
    && operator.includes('role="alert" tabIndex={-1}')
    && (operator.match(/if \(busy\) return;/g) ?? []).length >= 6
    && operator.includes("disabled={!canSubmit}"),
  "Economic operator forms must retain accessible live/error feedback and double-submit protection."
);
assert(
  billingClient.includes('operator.queueLimit !== 10')
    && billingClient.includes('operator.providerIdentifiersExposed !== false')
    && billingClient.includes('operator.personalContactDataExposed !== false')
    && billingClient.includes('[["economic_account_requests_manage"], accountRows]')
    && billingClient.includes('[["economic_assistance_manage"], assistanceProgramRows]')
    && billingClient.includes('[["economic_assistance_manage"], assistanceRows]')
    && billingClient.includes("economicOperatorFeatureFlagKeys.length")
    && billingClient.includes("featureFlags.some((flag, index) => flag.featureKey !== economicOperatorFeatureFlagKeys[index])")
    && operator.includes("Bounded economic queues")
    && operator.includes("Economic closure never deletes Auth identity")
    && operator.includes("Assistance is legitimate and private")
    && operator.includes("Capabilities without a browser mutation")
    && operator.includes("Empty queues do not prove empty records"),
  "Operator reporting must enforce the exact bounded capability-filtered queue contract and preserve lifecycle/assistance privacy boundaries."
);
for (const queue of ["orderQueue", "paymentQueue", "refundablePaymentQueue", "refundQueue", "subscriptionQueue", "disputeQueue", "webhookQueue", "reconciliationQueue", "sandboxCorrectionQueue", "jobPostEconomicQueue", "sellerPayableQueue", "sellerPayoutPreparationQueue", "organizationServiceQueue", "sponsorshipQueue", "accountRequestQueue", "assistanceProgramQueue", "assistanceQueue", "featureFlags"]) {
  assert(billingClient.includes(`operator.${queue}`) && operator.includes(`overview.${queue}`), `Strict operator queue is parsed but not fully presented: ${queue}`);
}
assert(
  operator.includes("These are Elysia accounting summaries, not raw Stripe objects")
    && operator.includes("A subscription condition affects only optional recurring support")
    && operator.includes("Provider event references, payloads, signatures")
    && operator.includes("Live payout execution remains unavailable")
    && operator.includes("One-time pack and recurring-support-payment shortfalls")
    && operator.includes("Recurring-support payment credit fulfillment")
    && operator.includes("independent deployment and database kill switches control publication")
    && operator.includes("The browser is read-only for flags")
    && operator.includes("complete reviewed kill-switch inventory"),
  "Every new operator queue must retain provider secrecy, non-governance, no-live-payout, recognition-kill-switch, and read-only-flag boundaries."
);
assert(
  billingClient.includes('billingFetch("/api/billing/account/support-recognition"')
    && billingClient.includes('billingFetch("/api/billing/account/closure-readiness"')
    && billingClient.includes('billingFetch("/api/billing/account/action"')
    && billingClient.includes('billingFetch("/api/billing/operator/account-action"')
    && billingClient.includes('"PUBLISH SUPPORT RECOGNITION"')
    && billingClient.includes('"REMOVE SUPPORT RECOGNITION"')
    && billingClient.includes('"REQUEST ECONOMIC DATA EXPORT"')
    && billingClient.includes('"REQUEST ECONOMIC ACCOUNT CLOSURE"')
    && billingClient.includes('"UPDATE ECONOMIC ACCOUNT REQUEST"'),
  "Recognition and lifecycle clients must use the exact authenticated routes and typed-confirmation contracts."
);
assert(
  supportBilling.includes("SupportRecognitionPreferencePanel")
    && supportBilling.includes("You may withdraw this acknowledgment even when new opt-ins or the public display are disabled")
    && supportBilling.includes("Database public-display eligibility")
    && supportBilling.includes("An independent deployment kill switch may still keep acknowledgments off")
    && supportBilling.includes("legalDocument.version")
    && supportBilling.includes("EconomicLifecyclePanel")
    && supportBilling.includes("loadEconomicClosureReadiness")
    && supportBilling.includes("acknowledgeFinancialRecordsRetained: true")
    && supportBilling.includes("acknowledgeAuthProfileUnchanged: true")
    && supportBilling.includes("duplicateActiveRequest")
    && supportBilling.includes("Website Auth/Profile unchanged: yes"),
  "Support & Billing must wire canonical recognition, export, and economic-only closure workflows without duplicating active requests or altering Website identity."
);
assert(
  operator.includes("EconomicAccountRequestReviewForm")
    && operator.includes("overview.accountRequestQueue ?? []")
    && operator.includes("updateEconomicOperatorAccountAction")
    && operator.includes("Financial records remain retained and Website Auth/Profile remains unchanged")
    && operator.includes("cannot delete or alter Auth identity"),
  "Lifecycle operators must select a bounded request and preserve financial-retention and non-governance boundaries."
);
assert(
  billingClient.includes('billingFetch("/api/billing/operator/service-restriction"')
    && operator.includes("EconomicServiceRestrictionForm")
    && operator.includes("cannot ban a Website Account")
    && billingClient.includes('commonsAccountAffected !== false')
    && billingClient.includes('billingFetch("/api/billing/operator/marketplace-payout-preparation"')
    && operator.includes("MarketplacePayoutPreparationForm")
    && operator.includes("Provider execution is unavailable")
    && operator.includes("Live payouts remain disabled"),
  "Scoped restrictions and Marketplace payout preparation must remain economic-only, test-only, and incapable of provider execution or community bans."
);
for (const route of ["assistance-program", "assistance-grant", "assistance-end"]) {
  assert(billingClient.includes(`billingFetch("/api/billing/operator/${route}"`), `Strict assistance client is missing /api/billing/operator/${route}.`);
}
for (const route of ["organization", "organization-membership", "organization-service", "organization-service-review", "sponsorship-agreement", "sponsorship-review", "sponsorship-recognition", "sponsorship-allocation", "sponsorship-allocation-close"]) {
  assert(billingClient.includes(`billingFetch("/api/billing/operator/${route}"`), `Strict organization/sponsorship operator client is missing /api/billing/operator/${route}.`);
}
assert(
  operator.includes("EconomicOrganizationSponsorshipOperations")
    && operator.includes('canManageOrganizations={hasCapability("organization_billing_manage")}')
    && operator.includes('canManageSponsorships={hasCapability("sponsorship_manage")}')
    && operator.includes('canManageAssistance={hasCapability("economic_assistance_manage")}')
    && organizationSponsorshipOperator.includes("private statement of work, proposal, contract, or invoice")
    && organizationSponsorshipOperator.includes("Sponsorship cannot buy governance")
    && organizationSponsorshipOperator.includes("sponsor can never select recipients")
    && organizationSponsorshipOperator.includes("requires both")
    && organizationSponsorshipOperator.includes("sponsorship_manage")
    && organizationSponsorshipOperator.includes("economic_assistance_manage"),
  "Private organization and sponsorship operator workflows must be capability-isolated, human-reviewed, document-reference-only, and incapable of sponsor recipient control."
);
assert(
  billingClient.includes('exactRecord(envelope.status, ["organizations", "financialDetailsPrivate", "affectsCommonsIdentity", "testMode"]')
    && billingClient.includes('["organizationId", "accountName", "status", "relationships", "engagements", "sponsorshipAgreements"]')
    && billingClient.includes('["engagementId", "status", "serviceCode", "statementOfWorkVersion", "serviceTermsVersion", "dataHandlingDisclosureVersion", "amountMinor", "currency", "checkoutAvailable"]')
    && billingClient.includes('["agreementId", "status", "agreementVersion", "disclosureVersion", "amountMinor", "currency", "publicRecognitionOptIn", "publicRecognitionApproved", "checkoutAvailable", "recognitionPreferenceAvailable"]'),
  "Signer-facing organization status must consume the exact ownership-scoped projection and reject missing or extra private-contract fields."
);
assert(
  billingClient.includes('"organizationServiceCheckout", "sponsorshipCheckout"')
    && billingClient.includes('billingFetch("/api/billing/organizations/checkout"')
    && billingClient.includes('billingFetch("/api/billing/sponsorships/checkout"')
    && billingClient.includes('billingFetch("/api/billing/sponsorships/preference"')
    && billingClient.includes('parsed.hostname !== "checkout.stripe.com"')
    && organizationSponsorshipAccount.includes("engagement.checkoutAvailable && capabilities?.organizationServiceCheckout && organizationBundle")
    && organizationSponsorshipAccount.includes("agreement.checkoutAvailable && capabilities?.sponsorshipCheckout && sponsorshipBundle")
    && organizationSponsorshipAccount.includes("requestIdRef.current ||=")
    && !organizationSponsorshipAccount.includes("setEngagementId")
    && !organizationSponsorshipAccount.includes("setAgreementId"),
  "Organization/sponsorship checkout must be signer-projected, capability-gated, canonical-bundle-bound, Stripe-hosted, idempotent, and free of user-typed private IDs."
);
assert(
  organizationSponsorshipAccount.includes("separately delivered the private statement of work")
    && organizationSponsorshipAccount.includes("separately delivered the private no-control sponsorship agreement")
    && organizationSponsorshipAccount.includes("Organization Services Terms")
    && organizationSponsorshipAccount.includes("Sponsorship Independence Policy")
    && organizationSponsorshipAccount.includes("Refund and Cancellation Policy")
    && organizationSponsorshipAccount.includes("Privacy Policy")
    && organizationSponsorshipAccount.includes("browser cannot choose or alter the price")
    && organizationSponsorshipAccount.includes("browser cannot supply amount"),
  "Signer checkout must require separately received private-document acknowledgment, exact displayed versions, canonical public policy links, and server-owned pricing."
);
assert(
  organizationSponsorshipAccount.includes("publicRecognitionOptIn")
    && organizationSponsorshipAccount.includes("publicRecognitionApproved")
    && organizationSponsorshipAccount.includes("optedIn || agreement.recognitionPreferenceAvailable")
    && organizationSponsorshipAccount.includes("PUBLISH NEUTRAL SPONSORSHIP RECOGNITION")
    && organizationSponsorshipAccount.includes("REMOVE NEUTRAL SPONSORSHIP RECOGNITION")
    && organizationSponsorshipAccount.includes("Public display still requires independent operator approval")
    && organizationSponsorshipAccount.includes("Signer and reviewer approvals both present")
    && organizationSponsorshipAccount.includes("Deployment and database display kill switches still control publication")
    && !organizationSponsorshipAccount.includes("Currently publishable by both")
    && organizationSponsorshipAccount.includes("Amounts public")
    && organizationSponsorshipAccount.includes("Never"),
  "Signer recognition must preserve dual consent, allow withdrawal, publish no amounts, and grant no authority."
);
assert(
  supportBilling.includes('["organization-payment", "organization_service", "organization service"')
    && supportBilling.includes('["sponsorship-payment", "sponsorship", "ethical sponsorship"')
    && supportBilling.includes("<CheckoutReturnStatus")
    && checkoutReturnStatus.includes("Browser return alone is not proof of payment or fulfillment")
    && supportBilling.includes("grant authority"),
  "Organization and sponsorship checkout returns must never be presented as proof of payment, fulfillment, recognition, or authority."
);
assert(
  billingClient.includes('billingFetch(`/api/billing/operator/audit?${query.toString()}`')
    && billingClient.includes('"providerIdentifiersExposed", "personalContactDataExposed", "testMode"')
    && operator.includes("EconomicAuditPanel")
    && operator.includes("Redacted economic audit trail")
    && operator.includes("omits reasons, metadata, provider references, actor user IDs, personal contact details"),
  "Economic audit visibility must use a bounded redacted cursor projection and never expose provider references, personal contacts, actor IDs, reasons, or metadata."
);
assert(
  billingClient.includes("export async function exportEconomicOperatorAccounting")
    && billingClient.includes('billingFetch("/api/billing/operator/accounting-export"')
    && billingClient.includes("Date.parse(to) - Date.parse(from) > 31 * 24 * 60 * 60 * 1_000")
    && billingClient.includes("input.limit < 1 || input.limit > 100")
    && billingClient.includes('input.confirmation !== "EXPORT PRIVATE ECONOMIC ACCOUNTING"')
    && billingClient.includes("accounting.providerIdentifiersExposed !== false")
    && billingClient.includes("accounting.personalContactDataExposed !== false")
    && billingClient.includes('"category", "economicFlow", "direction"')
    && billingClient.includes('"support_one_time", "support_recurring", "sandbox_credits", "job_post_fee", "marketplace_purchase", "organization_service", "sponsorship"')
    && operator.includes("function EconomicAccountingExportForm")
    && operator.includes('hasCapability("accounting_export") && <EconomicAccountingExportForm')
    && operator.includes('confirmation === "EXPORT PRIVATE ECONOMIC ACCOUNTING"')
    && operator.includes("new Blob([JSON.stringify(artifact, null, 2)]")
    && operator.includes("providerIdentifiersExposed: false")
    && operator.includes("personalContactDataExposed: false")
    && operator.includes("the cursor itself is not rendered")
    && operator.includes("The downloaded file is private financial operations material"),
  "Accounting export must remain a capability-gated, exactly confirmed, 31-day/100-row bounded private JSON workflow with preserved economic-flow categories, strict redaction, and cursor handling."
);
assert(
  operator.includes("EconomicAssistanceManagement")
    && operator.includes("Assistance is a legitimate access path")
    && operator.includes("Supply both fields or neither")
    && operator.includes("Publicly visible: never")
    && operator.includes("No assistance action creates a badge"),
  "Assistance operator UX must support bounded programs, grants, and compensating ends without stigmatizing recipients or creating public status."
);
assert(
  billingClient.includes('activate: false, confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM"')
    && billingClient.includes('billingFetch("/api/billing/operator/assistance-program-status"')
    && billingClient.includes("operatorAssistanceProgramStatusConfirmations")
    && billingClient.includes("ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM")
    && billingClient.includes("PAUSE TEST ECONOMIC ASSISTANCE PROGRAM")
    && billingClient.includes("RETIRE TEST ECONOMIC ASSISTANCE PROGRAM")
    && operator.includes("A new program is always saved as a draft")
    && operator.includes("Change one assistance-program status")
    && !operator.includes("activateProgram")
    && !operator.includes("Activate this reviewed test program now"),
  "Assistance program creation must remain draft-only in the browser and status changes must use the separate, exactly confirmed audited route."
);
assert(
  operator.includes('grant.status === "granted" || (grant.scope === "sandbox_credits" && grant.status === "consumed")')
    && operator.includes('grant.scope === "job_post_fee" && grant.status === "consumed"')
    && operator.includes("Consumed Job Post grants are deliberately excluded here")
    && billingClient.includes('billingFetch("/api/billing/operator/job-post-assistance-reconciliation"')
    && operator.includes("Reconcile one consumed Job Post assistance grant")
    && operator.includes("RECONCILE AND END TEST JOB POST ASSISTANCE")
    && operator.includes('overview.capabilities.includes("job_fee_assess")')
    && operator.includes("does not approve, reject, edit, or otherwise change content review authority"),
  "Consumed Job Post assistance must be excluded from generic grant ending and use its capability-separated atomic reconciliation route."
);
assert(
  billingClient.includes('billingFetch("/api/billing/operator/job-post-fee-assessment"')
    && operator.includes("ASSESS JOB POST ECONOMIC CONDITION")
    && operator.includes("cannot approve content")
    && billingClient.includes('billingFetch("/api/billing/operator/marketplace-commercial-terms"')
    && operator.includes("CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS")
    && operator.includes("Real payouts remain disabled"),
  "Existing Job Post assessment and Marketplace test-terms endpoints need deliberate capability-gated forms with no content-approval or payout claim."
);
assert(
  billingClient.includes('billingFetch(`/api/billing/job-post/status?jobPostId=')
    && billingClient.includes('billingFetch("/api/billing/job-post/checkout"')
    && commune.includes("JobPostEconomicOwnerPanel")
    && commune.includes('economic.termsVersion === consentBundle?.version')
    && commune.includes("Payment cannot buy approval")
    && commune.includes('sourceRoute: "/commune/rooms/job-post/posts"')
    && commune.includes("Private author view")
    && communeApi.includes('.eq("user_id", account.userId).eq("post_type", "job_post")'),
  "Job Post checkout must be owner-only, bundle-version matched, withheld until content approval, and reachable from a nonpublic author view without making the post public."
);
assert(
  billingClient.includes('receipt.receiptAvailable !== false')
    && billingClient.includes('receipt.providerIdentifiersExposed !== false')
    && billingClient.includes("normalizeAccountWarnings(source.warnings)")
    && supportBilling.includes("<PaymentRecordCard") && paymentRecord.includes("Provider email delivery is not established by this record"),
  "Receipt and warning projections must be exact, provider-identifier-free, and honest that no repository download endpoint exists."
);
assert(
  billingClient.includes('"availablePayableByCurrency", "payableByCurrency", "payoutPreparationEnabled"')
    && billingClient.includes('"payoutsEnabledByFeature", "payoutExecutionAvailable", "balancesAreTestRecords"')
    && marketplaceAccount.includes("seller.availablePayableByCurrency")
    && marketplaceAccount.includes("These balances are private test records")
    && marketplaceAccount.includes("seller.payoutExecutionAvailable")
    && marketplaceAccount.includes("Real payouts remain disabled"),
  "Seller balance and payout presentation must consume the frozen preparation-only test-record contract and never imply payout execution."
);
for (const serverConfirmation of ["GRANT TEST SANDBOX SERVICE UNITS", "PLACE TEST REFUND HOLD", "OPEN ECONOMIC RECONCILIATION CASE", "ASSESS JOB POST ECONOMIC CONDITION"]) {
  assert(billingClient.includes(`confirmation: "${serverConfirmation}" as const`), `Narrow operator request lost required server confirmation: ${serverConfirmation}`);
}
for (const capability of ["organization_billing_manage", "sponsorship_manage", "economic_assistance_manage", "economic_account_requests_manage", "economic_feature_flags_manage"]) {
  assert(billingClient.includes(`"${capability}"`) && operator.includes(`${capability}:`), `Governed organization/assistance capability is missing from browser assignment UI: ${capability}`);
}
assert(operator.includes("this browser exposes no flag toggle") && !operator.includes("setEconomicFeatureFlag"), "Feature-flag capability assignment may be audited in the browser, but actual flag mutation must remain server/CLI-only.");

const presentationSources = [support, thankYou, supportBilling, operator, marketplaceAccount].join("\n");
assert(!presentationSources.includes("badges unrelated to support"), "Support cancellation copy must not imply that payment-linked badges exist.");
for (const providerField of [
  "stripeCustomerId",
  "stripePaymentIntentId",
  "stripeCheckoutSessionId",
  "providerCustomerId",
  "providerPaymentId",
  "providerSubscriptionId"
]) {
  assert(!presentationSources.includes(providerField), `Economic presentation must not render provider identifier field: ${providerField}`);
}
assert(!thankYou.includes(">{reference}<") && !operator.includes("result.refundRequestId") && !operator.includes("creditLotId"), "Private order/operator result identifiers must not be rendered in public or operator presentation text.");
assert(
  billingClient.includes("safeServerMessage")
    && billingClient.includes("errorMessageForStatus")
    && supportBilling.includes("billingErrorMessage(error)")
    && operator.includes("billingErrorMessage(requestError)"),
  "Economic pages must use bounded safe error translation rather than raw database/provider errors."
);
assert(billingClient.includes("acct|cus|pi|ch|cs|sub") && billingClient.includes("prod|price|evt|tr|seti|pm"), "Safe browser messages must redact common Stripe provider-reference prefixes even if a server regresses.");
assert(
  billingClient.includes("if (url.username || url.password) return null")
    && billingClient.includes('url.protocol === "https:"')
    && billingClient.includes('url.port === ""')
    && billingClient.includes('url.origin === window.location.origin'),
  "Billing redirects must reject credentials and nondefault provider ports, require HTTPS for Stripe, and retain safe same-origin paths."
);
assert(
  billingClient.includes('OperatorRefundHoldResult = { refundRequestId: string; orderId: string; paymentTransactionId: string; amountMinor: number; currency: "usd";')
    && billingClient.includes('["paymentTransactionId", "orderId", "publicReference", "flow", "status", "grossAmountMinor", "refundableAmountMinor", "currency", "occurredAt"]')
    && billingClient.includes('paymentTransactionId, amountMinor: input.amountMinor')
    && billingClient.includes('refundHold.paymentTransactionId !== paymentTransactionId')
    && billingClient.includes('refundHold.currency !== "usd"')
    && billingClient.includes('refund.currency !== "usd"')
    && operator.includes("Bounded refundable payment transaction")
    && operator.includes("selected transaction's current refundable balance")
    && operator.includes("No provider payment-intent, charge, customer, subscription, or payment-method ID reaches this browser")
    && operator.includes('orderId: selectedPayment?.orderId ?? "", paymentTransactionId'),
  "Refund holds must select an exact bounded Elysia payment transaction, preserve the order binding, and never accept or expose provider IDs."
);

assert(
  styles.includes("@media (max-width: 820px)")
    && styles.includes(".economic-capability-grid")
    && styles.includes(".account-recovery-layout")
    && styles.includes("grid-template-columns: 1fr"),
  "Economic/account layouts must retain an explicit narrow-screen presentation rule."
);
assert(
  styles.includes("@media (prefers-reduced-motion: reduce)")
    && styles.includes(".support-page *")
    && styles.includes(".account-recovery-page *")
    && styles.includes(".commons-support-billing-page *")
    && styles.includes(".marketplace-scope *")
    && styles.includes(".economic-operations-page *")
    && styles.includes("animation: none !important")
    && styles.includes("transition: none !important"),
  "Economic/account surfaces must retain a targeted reduced-motion fallback."
);

console.log("Economic frontend presentation-contract smoke test ok (no backend behavior claimed). ");
