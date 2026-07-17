import {
  ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  configureRecurringSupportSandboxProgramInSupabase,
  DEACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  normalizeRecurringSupportSandboxProgramSpec,
  RECURRING_SANDBOX_PROGRAM_CONFIRMATION,
  setRecurringSupportSandboxProgramStatus
} from "./billingStripeTestCatalog.mjs";

function readArg(args, name) {
  const prefix = `${name}=`;
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) throw new Error(`Duplicate ${name} argument.`);
  return matches[0]?.slice(prefix.length);
}

function integer(value) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function parseCli(argv) {
  const [action, ...args] = argv;
  if (action !== "configure" && action !== "status") {
    throw new Error("Usage: billing:sandbox:test-recurring-program <configure|status> [reviewed options].");
  }
  const flags = ["--apply", "--enable", "--disable"];
  const values = ["--program-code", "--source-price-code", "--granted-units", "--expires-after-days", "--actor", "--request-id", "--confirm"];
  for (const arg of args) {
    if (!flags.includes(arg) && !values.some((name) => arg.startsWith(`${name}=`))) throw new Error(`Unknown sandbox program argument: ${arg}`);
  }
  for (const flag of flags) if (args.filter((arg) => arg === flag).length > 1) throw new Error(`Duplicate ${flag} argument.`);
  const enable = args.includes("--enable");
  const disable = args.includes("--disable");
  if (action === "status" && enable === disable) throw new Error("Status requires exactly one of --enable or --disable.");
  if (action === "configure" && (enable || disable)) throw new Error("Configuration is always inactive; use the separately attributed status action later.");
  const expires = readArg(args, "--expires-after-days");
  return {
    action,
    apply: args.includes("--apply"),
    confirmation: readArg(args, "--confirm") ?? "",
    actorUserId: readArg(args, "--actor") ?? "",
    clientRequestId: readArg(args, "--request-id") ?? "",
    programCode: readArg(args, "--program-code"),
    active: enable,
    spec: action === "configure" ? {
      programCode: readArg(args, "--program-code"),
      sourcePriceCode: readArg(args, "--source-price-code"),
      grantedUnits: integer(readArg(args, "--granted-units")),
      expiresAfterDays: expires === undefined ? null : integer(expires)
    } : null
  };
}

function assertCliRuntime(apply, billingMode, stripeLiveEnabled) {
  if (billingMode && billingMode !== "test" || stripeLiveEnabled === "true") {
    throw new Error("Recurring sandbox program tooling refuses live or non-test configuration.");
  }
  if (apply && (billingMode !== "test" || stripeLiveEnabled !== "false")) {
    throw new Error("Applying a sandbox program operation requires BILLING_MODE=test and STRIPE_LIVE_ENABLED=false.");
  }
}

function reviewedProgramCode(value) {
  if (typeof value !== "string" || !/^sandbox_test_[a-z0-9_]{3,80}$/.test(value)) throw new Error("Sandbox program code is invalid.");
  return value;
}

export function safeRecurringSandboxProgramOutput(action, result, applied) {
  return {
    mode: "test_only",
    action,
    applied,
    programCode: result.programCode,
    sourceCategory: "recurring_support",
    active: result.active,
    approvedForLiveUse: false,
    authorityChanged: false,
    testMode: true,
    liveActivationAvailable: false
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  Promise.resolve().then(async () => {
    const options = parseCli(process.argv.slice(2));
    const runtime = { billingMode: process.env.BILLING_MODE, stripeLiveEnabled: process.env.STRIPE_LIVE_ENABLED };
    assertCliRuntime(options.apply, runtime.billingMode, runtime.stripeLiveEnabled);
    let result;
    if (options.action === "configure") {
      const spec = normalizeRecurringSupportSandboxProgramSpec(options.spec);
      result = options.apply
        ? await configureRecurringSupportSandboxProgramInSupabase({
            spec,
            reason: process.env.SANDBOX_TEST_PROGRAM_CONFIGURATION_REASON ?? "",
            confirmation: options.confirmation,
            supabaseUrl: process.env.SUPABASE_URL ?? "",
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            ...runtime
          })
        : { ...spec, approvedForLiveUse: false, testMode: true };
    } else {
      options.programCode = reviewedProgramCode(options.programCode);
      result = options.apply
        ? await setRecurringSupportSandboxProgramStatus({
            programCode: options.programCode,
            actorUserId: options.actorUserId,
            clientRequestId: options.clientRequestId,
            active: options.active,
            benefitReviewConfirmed: process.env.SANDBOX_RECURRING_CREDIT_BENEFIT_REVIEWED === "true",
            reason: process.env.SANDBOX_TEST_PROGRAM_STATUS_REASON ?? "",
            confirmation: options.confirmation,
            supabaseUrl: process.env.SUPABASE_URL ?? "",
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            ...runtime
          })
        : {
            programCode: options.programCode, sourceCategory: "recurring_support", active: options.active,
            approvedForLiveUse: false, authorityChanged: false, testMode: true
          };
    }
    console.log(JSON.stringify(safeRecurringSandboxProgramOutput(options.action, result, options.apply), null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Recurring sandbox test program operation failed safely.");
    process.exitCode = 1;
  });
}

export {
  ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  DEACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  RECURRING_SANDBOX_PROGRAM_CONFIRMATION
};
