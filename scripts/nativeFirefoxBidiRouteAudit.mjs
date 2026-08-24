import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const bidiUrl = process.env.ELYSIA_FIREFOX_BIDI_URL ?? "ws://127.0.0.1:9223/session";
const origin = new URL(process.env.ELYSIA_WEBSITE_ORIGIN ?? "https://elysiaecobotics.com").origin;
const evidenceDir = path.resolve(process.env.ELYSIA_BROWSER_EVIDENCE_DIR ?? "/tmp/elysia-native-firefox-evidence");
const browserLabel = process.env.ELYSIA_BROWSER_LABEL ?? "native-firefox";
const settleMs = Number.parseInt(process.env.ELYSIA_BROWSER_SETTLE_MS ?? "5000", 10);
const fullInventory = process.env.ELYSIA_ROUTE_INVENTORY === "full";
const viewportMatch = /^(\d+)x(\d+)$/.exec(process.env.ELYSIA_BROWSER_VIEWPORT ?? "1440x900");
assert(viewportMatch, "ELYSIA_BROWSER_VIEWPORT must use WIDTHxHEIGHT.");
const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) };
const keyPaths = [
  "/",
  "/archive",
  "/legal",
  "/commune",
  "/commune/coding-cornucopia/review",
  "/developer-forge",
  "/marketplace",
  "/living-library",
  "/admin",
];

function materializePath(value) {
  return value
    .replaceAll(":roomSlug", "coding-cornucopia")
    .replaceAll(":postId", "a1100000-0000-4000-8000-000000000001")
    .replaceAll(":conversationId", "a1200000-0000-4000-8000-000000000001")
    .replaceAll(":publicHandle", "@synthetic-route-audit")
    .replaceAll(":categorySlug", "earth-environment")
    .replaceAll(":sourceId", "nasa-earthdata")
    .replaceAll(":step", "profile")
    .replaceAll(":id", "synthetic-route-audit")
    .replace(/:[A-Za-z][A-Za-z0-9_]*/g, "synthetic-route-audit");
}

async function inventoryPaths() {
  const explicit = process.env.ELYSIA_BROWSER_AUDIT_PATHS;
  if (explicit) return explicit.split(",").map((value) => value.trim()).filter(Boolean);
  if (!fullInventory) return keyPaths;
  const contract = JSON.parse(await fs.readFile("docs/navigation/route-preservation-contract.json", "utf8"));
  const paths = contract.routes.flatMap((route) => route.smokePaths ?? []).map(materializePath);
  return [...new Set(paths.filter((value) => value.startsWith("/") && !value.includes("*")))];
}

const auditPaths = await inventoryPaths();

assert(Number.isFinite(settleMs) && settleMs >= 0 && settleMs <= 30_000, "ELYSIA_BROWSER_SETTLE_MS must be between 0 and 30000.");
assert(viewport.width >= 320 && viewport.width <= 3840 && viewport.height >= 480 && viewport.height <= 2160, "Native browser viewport is outside the supported audit range.");
assert(auditPaths.every((value) => value.startsWith("/") && !value.startsWith("//")), "Every audit path must be same-origin and root-relative.");

function safeName(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

class BidiClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "event") {
        this.events.push(message);
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.type === "error") pending.reject(new Error(`${message.error}: ${message.message}`));
      else pending.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error(`Could not connect to ${this.url}`)), { once: true });
    });
  }

  command(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

await fs.mkdir(evidenceDir, { recursive: true });
const client = new BidiClient(bidiUrl);
await client.connect();

let sessionStarted = false;
try {
  const session = await client.command("session.new", {
    capabilities: { alwaysMatch: { browserName: "firefox" } },
  });
  sessionStarted = true;
  await client.command("session.subscribe", {
    events: ["log.entryAdded", "network.fetchError", "network.responseCompleted"],
  });
  const tree = await client.command("browsingContext.getTree");
  const context = tree.contexts?.[0]?.context;
  assert(context, "Native Firefox/LibreWolf did not expose a top-level browsing context.");
  await client.command("browsingContext.setViewport", {
    context,
    viewport,
    devicePixelRatio: 1,
  });

  const results = [];
  for (const route of auditPaths) {
    // Reusing one native tab is substantially faster than starting 154 browser
    // processes, but a direct route-to-route navigation lets cancellation
    // events from the outgoing document arrive inside the next route's event
    // window. Cross through an inert document first so every captured error
    // and network event belongs to the route being assessed.
    await client.command("browsingContext.navigate", {
      context,
      url: "about:blank",
      wait: "complete",
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const eventStart = client.events.length;
    const target = new URL(route, origin).href;
    const navigation = await client.command("browsingContext.navigate", {
      context,
      url: target,
      wait: "complete",
    });
    await new Promise((resolve) => setTimeout(resolve, settleMs));

    const evaluated = await client.command("script.evaluate", {
      expression: `JSON.stringify((() => {
        const root = document.querySelector('#root');
        const rect = root?.getBoundingClientRect();
        return {
          title: document.title,
          pathname: location.pathname,
          bodyTextLength: (document.body?.innerText || '').trim().length,
          rootChildCount: root?.childElementCount || 0,
          rootWidth: Math.round(rect?.width || 0),
          rootHeight: Math.round(rect?.height || 0),
          scrollX: Math.round(window.scrollX),
          scrollY: Math.round(window.scrollY),
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          loadingOnly: (document.body?.innerText || '').trim() === 'Loading Elysia Ecobotics Online...',
          scripts: Array.from(document.scripts).map((element) => ({
            src: element.src,
            type: element.type,
            integrity: element.integrity,
            dataCfBeacon: element.hasAttribute('data-cf-beacon'),
            inlineLength: element.src ? 0 : (element.textContent || '').length
          }))
        };
      })())`,
      target: { context },
      awaitPromise: true,
      resultOwnership: "none",
    });
    assert.equal(evaluated.type, "success", `${route}: native browser evaluation failed`);
    const visual = JSON.parse(evaluated.result.value);
    const events = client.events.slice(eventStart);
    const errorLogs = events
      .filter((event) => event.method === "log.entryAdded" && event.params?.level === "error")
      .map((event) => String(event.params?.text ?? event.params?.type ?? "browser error"));
    const hasCloudflareAnalytics = visual.scripts.some((script) => script.dataCfBeacon && script.src.includes("static.cloudflareinsights.com/beacon.min.js"));
    const hasTurnstile = visual.scripts.some((script) => script.src.includes("challenges.cloudflare.com/turnstile/"));
    const nonBlockingConsole = errorLogs.filter((message) => (
      (origin.startsWith("http://127.0.0.1:") && message.includes("Content-Security-Policy:") && message.includes("blocked an inline script"))
      || message.includes("Acquiring an exclusive Navigator LockManager lock")
      // LibreWolf's tracking protection deliberately blocks Cloudflare's
      // auto-injected analytics transform. Keep these events in the evidence,
      // but do not confuse an optional edge beacon refusal with an application
      // script failure after the root has hydrated and all app assets passed.
      || (hasCloudflareAnalytics && message.includes("static.cloudflareinsights.com/beacon.min.js"))
      || (hasCloudflareAnalytics && message.includes("Content-Security-Policy:") && message.includes("blocked an inline script"))
      || (hasTurnstile && message === "0")
      || (hasTurnstile && message.includes("downloadable font:") && message.includes("DejaVu Sans") && message.includes("invalid URI"))
      || (route === "/commune/realtime" && message.includes("Cookie") && message.includes("__cf_bm") && message.includes("rejected"))
    ));
    const fatalLogs = errorLogs.filter((message) => !nonBlockingConsole.includes(message));
    const failedRequests = events
      .filter((event) => event.method === "network.fetchError")
      .map((event) => String(event.params?.request?.url ?? "unknown request"));
    const failedAssets = events
      .filter((event) => event.method === "network.responseCompleted")
      .filter((event) => Number(event.params?.response?.status ?? 0) >= 400 && /\.(?:css|js)(?:\?|$)/i.test(event.params?.response?.url ?? ""))
      .map((event) => `${event.params.response.status} ${event.params.response.url}`);

    const screenshot = await client.command("browsingContext.captureScreenshot", {
      context,
      origin: "viewport",
      format: { type: "image/png" },
    });
    const screenshotFile = `${browserLabel}-${safeName(route)}-${viewport.width}x${viewport.height}.png`;
    await fs.writeFile(path.join(evidenceDir, screenshotFile), Buffer.from(screenshot.data, "base64"), { mode: 0o600 });

    const passed = navigation.url.startsWith(origin)
      && visual.bodyTextLength >= 40
      && visual.rootChildCount > 0
      && visual.rootWidth > 100
      && visual.rootHeight > 100
      && !visual.loadingOnly
      && fatalLogs.length === 0
      && failedAssets.length === 0;
    results.push({ route, target, finalUrl: navigation.url, visual, fatalLogs, nonBlockingConsole, failedRequests, failedAssets, screenshotFile, passed });
  }

  const waitForSettledRoot = async (expectedPathname) => {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    const evaluated = await client.command("script.evaluate", {
      expression: `JSON.stringify({
        pathname: location.pathname,
        bodyTextLength: (document.body?.innerText || '').trim().length,
        rootChildCount: document.querySelector('#root')?.childElementCount || 0
      })`,
      target: { context },
      awaitPromise: true,
      resultOwnership: "none",
    });
    assert.equal(evaluated.type, "success", `${expectedPathname}: native history/reload evaluation failed`);
    const state = JSON.parse(evaluated.result.value);
    assert.equal(state.pathname, expectedPathname, `Native browser did not settle on ${expectedPathname}.`);
    assert(state.bodyTextLength >= 40 && state.rootChildCount > 0, `${expectedPathname}: native browser did not remain hydrated.`);
    return state;
  };

  await client.command("browsingContext.navigate", { context, url: `${origin}/archive`, wait: "complete" });
  await waitForSettledRoot("/archive");
  await client.command("browsingContext.navigate", { context, url: `${origin}/legal`, wait: "complete" });
  await waitForSettledRoot("/legal");
  await client.command("browsingContext.traverseHistory", { context, delta: -1 });
  const backState = await waitForSettledRoot("/archive");
  await client.command("browsingContext.traverseHistory", { context, delta: 1 });
  const forwardState = await waitForSettledRoot("/legal");
  await client.command("browsingContext.reload", { context, wait: "complete" });
  const normalReloadState = await waitForSettledRoot("/legal");
  // LibreWolf 154 does not yet implement BiDi's reload.ignoreCache argument.
  // Exercise the real browser hard-reload gesture instead of silently
  // downgrading this gate to a second ordinary reload.
  await client.command("input.performActions", {
    context,
    actions: [{
      type: "key",
      id: "hard-reload-keyboard",
      actions: [
        { type: "keyDown", value: "\uE009" },
        { type: "keyDown", value: "\uE008" },
        { type: "keyDown", value: "r" },
        { type: "keyUp", value: "r" },
        { type: "keyUp", value: "\uE008" },
        { type: "keyUp", value: "\uE009" },
      ],
    }],
  });
  await client.command("input.releaseActions", { context });
  const hardReloadState = await waitForSettledRoot("/legal");
  const historyAndReload = { backState, forwardState, normalReloadState, hardReloadState, passed: true };

  const report = {
    schemaVersion: 1,
    browserLabel,
    browserName: session.capabilities.browserName,
    browserVersion: session.capabilities.browserVersion,
    userAgent: session.capabilities.userAgent,
    profile: "disposable-profile-path-redacted",
    origin,
    fullInventory,
    viewport,
    historyAndReload,
    results,
  };
  await fs.writeFile(path.join(evidenceDir, `${browserLabel}-audit.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  const failures = results.filter((result) => !result.passed);
  assert.equal(failures.length, 0, `${browserLabel} failed routes: ${failures.map((result) => result.route).join(", ")}`);
  console.log(`${browserLabel} native WebDriver BiDi audit passed for ${results.length} routes on ${session.capabilities.browserVersion}. Evidence: ${evidenceDir}`);
} finally {
  if (sessionStarted) {
    try {
      await client.command("session.end");
    } catch {
      // The browser may close the transport immediately after ending the session.
    }
  }
  client.close();
}
