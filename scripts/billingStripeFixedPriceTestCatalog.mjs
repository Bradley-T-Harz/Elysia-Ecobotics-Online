import {
  configureStripeFixedTestPriceInSupabase,
  FIXED_PRICE_APPLY_CONFIRMATION,
  FIXED_PRICE_DATABASE_CONFIRMATION,
  reconcileStripeFixedTestPrice
} from "./billingStripeTestCatalog.mjs";

function readArg(args, name) {
  const prefix = `${name}=`;
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) throw new Error(`Duplicate ${name} argument.`);
  return matches[0]?.slice(prefix.length);
}

function parseInteger(value) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function parseCli(args) {
  const flags = ["--apply", "--configure-supabase"];
  const values = [
    "--product", "--price-code", "--amount-minor", "--disclosure-version", "--pack-code",
    "--granted-units", "--expires-after-days", "--actor", "--request-id", "--confirm", "--database-confirm"
  ];
  for (const arg of args) {
    if (!flags.includes(arg) && !values.some((name) => arg.startsWith(`${name}=`))) {
      throw new Error(`Unknown fixed-price catalog argument: ${arg}`);
    }
  }
  for (const flag of flags) if (args.filter((arg) => arg === flag).length > 1) throw new Error(`Duplicate ${flag} argument.`);
  const apply = args.includes("--apply");
  const configureSupabase = args.includes("--configure-supabase");
  if (configureSupabase && !apply) throw new Error("Supabase configuration requires the explicit Stripe --apply pass.");
  const productKey = readArg(args, "--product");
  const expiresText = readArg(args, "--expires-after-days");
  return {
    apply,
    configureSupabase,
    actorUserId: readArg(args, "--actor") ?? "",
    clientRequestId: readArg(args, "--request-id") ?? "",
    confirmation: readArg(args, "--confirm") ?? "",
    databaseConfirmation: readArg(args, "--database-confirm") ?? "",
    spec: {
      productKey,
      priceCode: readArg(args, "--price-code"),
      amountMinor: parseInteger(readArg(args, "--amount-minor")),
      currency: "usd",
      disclosureVersion: readArg(args, "--disclosure-version"),
      ...(productKey === "sandbox_credits" ? {
        packCode: readArg(args, "--pack-code"),
        grantedUnits: parseInteger(readArg(args, "--granted-units")),
        expiresAfterDays: expiresText === undefined ? null : parseInteger(expiresText)
      } : {})
    }
  };
}

export function safeFixedPriceCliOutput(catalog, configured) {
  return {
    mode: "stripe_test_only",
    productKey: catalog.productKey,
    priceCode: catalog.priceCode,
    amountMinor: catalog.amountMinor,
    currency: catalog.currency,
    stripeAction: catalog.action,
    stripeApplied: catalog.action !== "dry_run",
    databaseConfigured: configured?.configured === true,
    providerReferencesRecorded: configured?.providerReferencesRecorded === true,
    approvedForLiveUse: false,
    testMode: true,
    liveActivationAvailable: false
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  Promise.resolve().then(async () => {
    const options = parseCli(process.argv.slice(2));
    const runtime = {
      billingMode: process.env.BILLING_MODE,
      stripeLiveEnabled: process.env.STRIPE_LIVE_ENABLED
    };
    const catalog = await reconcileStripeFixedTestPrice({
      spec: options.spec,
      secretKey: process.env.STRIPE_SECRET_KEY_TEST ?? "",
      apiVersion: process.env.STRIPE_API_VERSION ?? null,
      apply: options.apply,
      confirmation: options.confirmation,
      ...runtime
    });
    const configured = options.configureSupabase
      ? await configureStripeFixedTestPriceInSupabase({
          catalogResult: catalog,
          actorUserId: options.actorUserId,
          clientRequestId: options.clientRequestId,
          reason: process.env.ECONOMIC_TEST_PRICE_CONFIGURATION_REASON ?? "",
          confirmation: options.databaseConfirmation,
          supabaseUrl: process.env.SUPABASE_URL ?? "",
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
          ...runtime
        })
      : null;
    console.log(JSON.stringify(safeFixedPriceCliOutput(catalog, configured), null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Fixed test-price catalog setup failed safely.");
    process.exitCode = 1;
  });
}

export { FIXED_PRICE_APPLY_CONFIRMATION, FIXED_PRICE_DATABASE_CONFIRMATION };
