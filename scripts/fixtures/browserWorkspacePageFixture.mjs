// Synthetic page responses only; actual database permissions are qualified separately.
export const ids = {
  manager: "f5100000-0000-4000-8000-000000000001",
  other: "f5100000-0000-4000-8000-000000000002",
  publisher: "f5200000-0000-4000-8000-000000000001",
  individual: "f5200000-0000-4000-8000-000000000002",
  profile: "f5300000-0000-4000-8000-000000000001",
  reference: "f5400000-0000-4000-8000-000000000001",
};
const headers = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "content-range": "0-0/*",
};
export function createWorkspacePageFixture({
  browser,
  origin,
  pageErrors,
  forbidden,
  serve,
  allowLoopback = false,
}) {
  return async function fixture(
    role,
    { mobile = false, noProfile = false, unavailable = false } = {},
  ) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      serviceWorkers: "block",
    });
    const manager = role === "manager",
      signedIn = role !== "visitor";
    const user = {
      id: manager ? ids.manager : ids.other,
      aud: "authenticated",
      role: "authenticated",
      email: "synthetic-publisher@example.invalid",
      email_confirmed_at: "2026-09-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-08-01T00:00:00Z",
    };
    const token =
      Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url") +
      "." +
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          role: "authenticated",
          aud: "authenticated",
          session_id: "f5600000-0000-4000-8000-000000000001",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url") +
      ".synthetic";
    const session = {
      access_token: token,
      refresh_token: "synthetic-only",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user,
    };
    if (signedIn)
      await context.addInitScript(
        (s) =>
          localStorage.getItem("sb-readiness-fixture-auth-token") ||
          localStorage.setItem(
            "sb-readiness-fixture-auth-token",
            JSON.stringify(s),
          ),
        session,
      );
    const publisher = {
      id: manager ? ids.publisher : ids.individual,
      displayName: manager
        ? "Synthetic Official Publisher"
        : "Synthetic Independent Publisher",
      entityKind: manager ? "organization" : "individual",
      legalName: manager ? "Synthetic Organization" : null,
      verified: false,
    };
    const publishers = manager || role === "creator" ? [publisher] : [];
    const reference = {
      id: ids.reference,
      addonKey: "elysia-codev",
      version: "1.0.0",
      creatorAttribution: "Synthetic Organization",
      publisherId: ids.publisher,
      publisherDisplayName: "Synthetic Official Publisher",
      packageUrl: "https://example.invalid/release.vsix",
      packageSha256:
        "5cbb9298e0d9f56797b95854e4cf07db84fe2d7fc00deb7bc3364d503451f6ff",
      releaseReferenceUrl: "https://example.invalid/release/v1.0.0",
      official: true,
      distributionKind: "free",
      recordedAt: "2026-09-09T00:00:00Z",
      kind: "external_release_reference",
    };
    const profile =
      !noProfile && (manager || role === "creator")
        ? {
            id: ids.profile,
            user_id: user.id,
            developer_slug: "synthetic-developer",
            display_name: "Synthetic Developer",
            status: "requested",
          }
        : null;
    const drafts = [],
      writes = [],
      packages = [],
      storedBytes = [],
      submissions = [],
      snapshots = [],
      permissions = [];
    const controls = {
      failUpload: false,
      otherAccount: false,
      delayDraftRead: null,
    };
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        /\/api\/(billing|economic-preparation)(\/|$)|stripe\.com|connect\.stripe/.test(
          url.href,
        )
      ) {
        forbidden.push(url.href);
        return route.abort();
      }
      if (allowLoopback && url.origin === "http://127.0.0.1:47321")
        return route.continue();
      if (
        url.origin !== origin &&
        /^(localhost|127\.|\[::1\])/.test(url.hostname)
      ) {
        forbidden.push(url.origin);
        return route.abort();
      }
      if (url.origin === origin)
        return serve
          ? serve(route, { session, controls, writes })
          : route.continue();
      if (url.origin !== "https://readiness-fixture.supabase.co")
        return route.fulfill({ status: 200, body: "" });
      const fulfill = (body, status = 200) =>
        route.fulfill({ status, headers, body: JSON.stringify(body) });
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const name = url.pathname.split("/").at(-1),
        obj = request.headers().accept?.includes("vnd.pgrst.object");
      if (name === "user")
        return fulfill(
          signedIn
            ? { ...user, id: controls.otherAccount ? ids.other : user.id }
            : null,
        );
      if (name === "logout") return fulfill({});
      if (name === "profiles")
        return fulfill(
          obj
            ? {
                id: user.id,
                username: "synthetic-publisher",
                display_name: "Synthetic Commons Name",
                is_admin: role === "admin",
                commons_onboarding_completed_at: "2026-09-01T00:00:00Z",
              }
            : [],
        );
      if (name === "user_roles")
        return fulfill(
          role === "admin"
            ? [{ role: "administrator", revoked_at: null }]
            : role === "reviewer"
              ? [{ role: "marketplace_reviewer", revoked_at: null }]
              : [],
        );
      if (name === "current_user_can_review_domain")
        return fulfill(role === "reviewer" || role === "admin");
      if (name === "current_user_economic_operator_overview")
        return fulfill({
          authorized: role === "operator",
          capabilities:
            role === "operator" ? ["marketplace_payout_manage"] : [],
          test_mode: true,
        });
      if (name === "current_user_publisher_workspace")
        return unavailable
          ? fulfill({ code: "PGRST202" }, 404)
          : fulfill({
              publishers,
              commonsDisplayName: "Synthetic Commons Name",
              releaseReferences: manager ? [reference] : [],
              listings: [],
            });
      if (name === "save_own_marketplace_publisher") {
        const args = request.postDataJSON();
        writes.push({ table: "publisher_rpc", method: "POST", body: args });
        if (!signedIn || args.p_publisher_id !== null)
          return fulfill({ code: "42501" }, 403);
        publishers.push({ ...publisher, displayName: args.p_display_name });
        return fulfill(publisher.id);
      }
      if (name === "get_addon_publisher_provenance") {
        const args = request.postDataJSON();
        return fulfill(
          args.p_addon_key === "elysia-codev" &&
            args.p_version === "1.0.0" &&
            args.p_package_sha256 === reference.packageSha256
            ? {
                publisherId: ids.publisher,
                creatorAttribution: reference.creatorAttribution,
                publisherDisplayName: reference.publisherDisplayName,
                version: reference.version,
                packageSha256: reference.packageSha256,
                recordedAt: reference.recordedAt,
                kind: reference.kind,
              }
            : null,
        );
      }
      if (name === "developer_profiles")
        return fulfill(obj ? profile : profile ? [profile] : []);
      if (url.pathname.includes("/storage/v1/object/addon-packages/")) {
        writes.push({ table: "storage", method: request.method() });
        if (controls.failUpload)
          return fulfill({ message: "Synthetic storage unavailable" }, 503);
        const form = await new Response(request.postDataBuffer(), {
          headers: { "content-type": request.headers()["content-type"] },
        }).formData();
        for (const value of form.values())
          if (value instanceof File)
            storedBytes.push(Buffer.from(await value.arrayBuffer()));
        return fulfill({ Key: url.pathname.split("/object/")[1] });
      }
      if (name === "addon_draft_permissions") {
        const draftId = url.searchParams
          .get("addon_draft_id")
          ?.replace("eq.", "");
        if (request.method() === "DELETE") {
          for (let i = permissions.length - 1; i >= 0; i--)
            if (permissions[i].addon_draft_id === draftId)
              permissions.splice(i, 1);
          return fulfill([]);
        }
        if (request.method() === "POST") {
          permissions.push(...request.postDataJSON());
          return fulfill([]);
        }
        return fulfill(
          permissions.filter((item) => item.addon_draft_id === draftId),
        );
      }
      if (
        name === "addon_submission_snapshots" &&
        request.method() === "POST"
      ) {
        snapshots.push(request.postDataJSON());
        return fulfill([]);
      }
      if (name === "addon_packages") {
        if (request.method() === "POST") {
          const row = {
            id: `fixture-package-${packages.length + 1}`,
            ...request.postDataJSON(),
          };
          packages.push(row);
          writes.push({ table: name, method: "POST", body: row });
          return fulfill(obj ? row : [row]);
        }
        if (
          controls.delayDraftRead &&
          request.method() === "GET" &&
          url.searchParams.has("id")
        ) {
          const delay = controls.delayDraftRead;
          controls.delayDraftRead = null;
          await delay;
        }
        const id = url.searchParams.get("id")?.replace("eq.", "");
        return fulfill(
          id ? packages.filter((item) => item.id === id) : packages,
        );
      }
      if (name === "addon_submissions" && request.method() === "POST") {
        const row = {
          id: `fixture-submission-${submissions.length + 1}`,
          ...request.postDataJSON(),
        };
        submissions.push(row);
        writes.push({ table: name, method: "POST", body: row });
        return fulfill(obj ? row : [row]);
      }
      if (name === "addon_drafts") {
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          writes.push({ table: name, method: request.method(), body });
          if (
            !publishers.some((p) => p.id === body.publisher_id) ||
            !body.creator_attribution
          )
            return fulfill({ code: "42501" }, 403);
          const draft = {
            id: `f5500000-0000-4000-8000-${String(drafts.length + 1).padStart(12, "0")}`,
            submission_status: "draft",
            review_status: "not_submitted",
            risk_level: "unknown",
            validation_status: "not_validated",
            package_status: "not_uploaded",
            created_at: new Date().toISOString(),
            ...body,
          };
          drafts.push(draft);
          return fulfill(obj ? draft : [draft]);
        }
        if (
          controls.delayDraftRead &&
          request.method() === "GET" &&
          url.searchParams.has("id")
        ) {
          const delay = controls.delayDraftRead;
          controls.delayDraftRead = null;
          await delay;
        }
        const id = url.searchParams.get("id")?.replace("eq.", ""),
          draft = drafts.find((d) => d.id === id);
        if (request.method() === "PATCH") {
          const body = request.postDataJSON();
          writes.push({ table: name, method: "PATCH", body });
          const expected = url.searchParams
            .get("updated_at")
            ?.replace("eq.", "");
          if (expected && draft?.updated_at !== expected) return fulfill([]);
          if (draft) Object.assign(draft, body);
          return fulfill(obj ? (draft ?? null) : draft ? [draft] : []);
        }
        const owner = url.searchParams.get("owner_user_id")?.replace("eq.", "");
        const visible = drafts.filter(
          (item) => !owner || item.owner_user_id === owner,
        );
        return fulfill(
          obj
            ? (draft ?? null)
            : id
              ? visible.filter((item) => item.id === id)
              : visible,
        );
      }
      if (
        !["GET", "HEAD"].includes(request.method()) &&
        !url.pathname.includes("/rpc/")
      )
        writes.push({ table: name, method: request.method() });
      return fulfill(obj ? null : []);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => pageErrors.push(e.message));
    return {
      context,
      page,
      drafts,
      writes,
      publishers,
      packages,
      storedBytes,
      submissions,
      snapshots,
      controls,
      session,
    };
  };
}
