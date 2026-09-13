/** Explicit Sync lifecycle. Private keys are nonextractable, short-lived, and separately scoped from source recovery. */
import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";
import {
  CodevBrokerClient,
  codevLoginSessionId,
  codevRandomId,
  codevScopeKey,
  createCodevKey,
  validatePairing,
  type OnlineScope,
  type PairingView,
  type ScopedKey,
} from "./brokerClient";

export type CodevConnection = {
  client: CodevBrokerClient;
  key: ScopedKey;
  pairing: PairingView;
  grantEpochs: Record<string, number>;
};
export type CodevSyncAttempt = {
  key: ScopedKey;
  pairing: PairingView;
  manualCode: string;
  authorityEpoch: number;
};
type StoredPairing = {
  contract: "codev-browser-session-1";
  keyId: string;
  scope: OnlineScope;
  pairing: PairingView;
  initiatingDocument: string;
  expiresAt: string;
};
const documentId = codevRandomId();
const databaseName = "elysia-codev-pairing-keys-v1";
const storeName = "keys";
const prefix = "elysia.codev.connection.v1.";
const restoring = new Map<string, Promise<CodevConnection | null>>();
const connections = new Map<string, CodevConnection>();
const pending = new Set<CodevBrokerClient>();
const pendingKeys = new Map<string, OnlineScope>();
let authorityEpoch = 0;
let observedAuth: string | null | undefined;
function assertEpoch(epoch: number) {
  if (epoch !== authorityEpoch)
    throw new Error(
      "The website account changed during this operation. Sync Codev again.",
    );
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Private browser key storage is unavailable. Keep your workspace open.",
        ),
      );
    request.onblocked = () =>
      reject(new Error("Close older Codev connection tabs before continuing."));
  });
}
async function storeKey(key: ScopedKey) {
  if (
    key.privateKey.extractable ||
    key.privateKey.type !== "private" ||
    key.privateKey.algorithm.name !== "ECDSA"
  )
    throw new Error("A nonextractable Codev key is required.");
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const cursor = store.openCursor();
      let count = 0;
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (Date.parse(row.value.expiresAt) <= Date.now()) row.delete();
          else if (row.key !== codevScopeKey(key.scope)) count++;
          row.continue();
          return;
        }
        if (count >= 20) {
          tx.abort();
          return;
        }
        store.put({ id: codevScopeKey(key.scope), ...key });
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            "Codev key storage is full or unavailable. Disconnect an existing session and retry.",
          ),
        );
      tx.onerror = () => {};
    });
  } finally {
    db.close();
  }
}
async function loadKey(id: string): Promise<ScopedKey | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error("Codev key recovery failed."));
    });
  } finally {
    db.close();
  }
}
async function deleteKey(id: string) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error("Codev key cleanup failed."));
      tx.onerror = () => {};
    });
  } finally {
    db.close();
  }
}
async function currentLogin() {
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null;
  const login = session ? codevLoginSessionId(session.access_token) : null;
  if (!session || !login)
    throw new Error("Sign in to the website before syncing Codev.");
  return { session, login };
}
async function checkScope(scope: OnlineScope) {
  const { session, login } = await currentLogin();
  if (
    session.user.id !== scope.accountId ||
    login !== scope.loginSessionId ||
    location.origin !== scope.origin
  )
    throw new Error("The website account or login changed. Sync Codev again.");
  return session.access_token;
}
function slotKey(
  scope: Pick<OnlineScope, "accountId" | "loginSessionId" | "surface">,
) {
  return (
    prefix +
    JSON.stringify([scope.accountId, scope.loginSessionId, scope.surface])
  );
}
async function online(
  scope: OnlineScope,
  route: "create" | "browser",
  payload: object,
): Promise<{ pairing: PairingView; manual_code?: string }> {
  const token = await checkScope(scope);
  const response = await fetch(scope.origin + "/api/codev/" + route, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      route === "create"
        ? "Codev sync is unavailable for this website session. Check that you are signed in and try again."
        : "No active approved connection was found. Review pairing in local Elysia and try again.",
    );
  const text = await response.text();
  if (new TextEncoder().encode(text).length > 16384)
    throw new Error("Invalid Codev pairing response.");
  await checkScope(scope);
  const result = JSON.parse(text);
  if (result.ok !== true)
    throw new Error("Codev pairing could not be confirmed.");
  return result;
}

export async function beginCodevSync(
  surface: "marketplace" | "forge",
): Promise<CodevSyncAttempt> {
  const epoch = authorityEpoch;
  const { session, login } = await currentLogin();
  const previousSlot = slotKey({
    accountId: session.user.id,
    loginSessionId: login,
    surface,
  });
  const existing = connections.get(previousSlot);
  if (existing) await disconnectCodev(existing);
  const previous = sessionStorage.getItem(previousSlot);
  if (previous) {
    sessionStorage.removeItem(previousSlot);
    try {
      const record = JSON.parse(previous) as StoredPairing;
      if (
        record.scope.accountId === session.user.id &&
        record.scope.loginSessionId === login &&
        record.scope.surface === surface &&
        record.scope.origin === location.origin
      ) {
        await online(record.scope, "browser", {
          pairing_id: record.pairing.pairing_id,
          surface,
          browser_session_id: record.scope.browserSessionId,
          action: "revoke",
        }).catch(() => {});
        await deleteKey(record.keyId).catch(() => {});
      }
    } catch {
      /* An invalid local record supplies no authority. */
    }
  }
  // A new explicit intent gets a fresh tab key; no private key or code goes in sessionStorage.
  const browserSessionId = codevRandomId();
  const scope: OnlineScope = {
    accountId: session.user.id,
    loginSessionId: login,
    origin: location.origin,
    surface,
    browserSessionId,
  };
  const key = await createCodevKey(scope);
  // Prove structured-clone storage works before creating the cloud intent.
  await storeKey(key);
  pendingKeys.set(codevScopeKey(scope), scope);
  try {
    assertEpoch(epoch);
    const result = await online(scope, "create", {
      surface,
      browser_session_id: browserSessionId,
      browser_public_key: key.publicKey,
    });
    const pairing = validatePairing(result.pairing, scope, key.publicKey);
    if (!/^EC1\.[AW]\.[A-Za-z0-9_-]{43}$/.test(result.manual_code ?? ""))
      throw new Error("A valid manual pairing code was not returned.");
    // The constructor is intentionally deferred until the native public key is confirmed.
    assertEpoch(epoch);
    return {
      key,
      pairing,
      manualCode: result.manual_code!,
      authorityEpoch: epoch,
    };
  } catch (error) {
    pendingKeys.delete(codevScopeKey(scope));
    await deleteKey(codevScopeKey(scope)).catch(() => {});
    throw error;
  }
}

export async function finishCodevSync(
  attempt: CodevSyncAttempt,
  beforeRefresh: () => Promise<void>,
): Promise<void> {
  const { scope } = attempt.key;
  assertEpoch(attempt.authorityEpoch);
  const response = await online(scope, "browser", {
    pairing_id: attempt.pairing.pairing_id,
    surface: scope.surface,
    browser_session_id: scope.browserSessionId,
    action: "status",
  });
  assertEpoch(attempt.authorityEpoch);
  const approved = validatePairing(
    response.pairing,
    scope,
    attempt.key.publicKey,
  );
  if (!["native_approved", "paired"].includes(approved.intent.status ?? ""))
    throw new Error(
      "Open local Elysia’s Codev workroom, review this code, and approve the displayed website account first.",
    );
  const client = new CodevBrokerClient(attempt.key, approved, async () => {
    await checkScope(scope);
    assertEpoch(attempt.authorityEpoch);
  });
  pending.add(client);
  try {
    await client.verifyConnection();
    const finished = await online(scope, "browser", {
      pairing_id: approved.pairing_id,
      surface: scope.surface,
      browser_session_id: scope.browserSessionId,
      action: "finish",
    });
    const paired = validatePairing(
      finished.pairing,
      scope,
      attempt.key.publicKey,
    );
    if (paired.intent.status !== "paired")
      throw new Error("Codev pairing did not finish.");
    await checkScope(scope);
    const key = { ...attempt.key, expiresAt: paired.intent.expires_at };
    await storeKey(key);
    const record: StoredPairing = {
      contract: "codev-browser-session-1",
      keyId: codevScopeKey(scope),
      scope,
      pairing: paired,
      initiatingDocument: documentId,
      expiresAt: paired.intent.expires_at,
    };
    // The caller verifies the persisted revision. No asynchronous gap follows it.
    await beforeRefresh();
    assertEpoch(attempt.authorityEpoch);
    client.assertActive();
    sessionStorage.setItem(slotKey(scope), JSON.stringify(record));
    pendingKeys.delete(record.keyId);
    location.reload();
  } finally {
    pending.delete(client);
    client.disconnect();
  }
}

export async function restoreCodevConnection(
  surface: "marketplace" | "forge",
): Promise<CodevConnection | null> {
  const { session, login } = await currentLogin();
  const scopeKey = slotKey({
    accountId: session.user.id,
    loginSessionId: login,
    surface,
  });
  const existing = connections.get(scopeKey);
  if (existing) {
    try {
      existing.client.assertActive();
      return existing;
    } catch {
      connections.delete(scopeKey);
    }
  }
  const inflight = restoring.get(scopeKey);
  if (inflight) return inflight;
  const restored = restoreStored(surface, session.user.id, login, scopeKey);
  restoring.set(scopeKey, restored);
  try {
    return await restored;
  } finally {
    if (restoring.get(scopeKey) === restored) restoring.delete(scopeKey);
  }
}
async function restoreStored(
  surface: "marketplace" | "forge",
  accountId: string,
  login: string,
  scopeKey: string,
): Promise<CodevConnection | null> {
  const epoch = authorityEpoch;
  const raw = sessionStorage.getItem(scopeKey);
  if (!raw) return null;
  const record = JSON.parse(raw) as StoredPairing;
  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  // A cloned/new tab cannot inherit the approval by copying sessionStorage. A new
  // document produced by the required reload is the only restoration entrypoint.
  if (navigation?.type !== "reload") {
    // sessionStorage can be copied by window.open/duplicate-tab. Discard that
    // copy in the first new document so a later reload cannot inherit authority.
    // The nonextractable key remains available to its original, separate tab.
    sessionStorage.removeItem(scopeKey);
    return null;
  }
  if (record.initiatingDocument === documentId) return null;
  if (
    record.contract !== "codev-browser-session-1" ||
    record.scope.accountId !== accountId ||
    record.scope.loginSessionId !== login ||
    record.scope.surface !== surface ||
    record.scope.origin !== location.origin ||
    record.keyId !== codevScopeKey(record.scope) ||
    !Number.isFinite(Date.parse(record.expiresAt)) ||
    Date.parse(record.expiresAt) <= Date.now()
  )
    return null;
  const key = await loadKey(record.keyId);
  assertEpoch(epoch);
  if (
    !key ||
    key.privateKey.extractable ||
    key.privateKey.type !== "private" ||
    key.privateKey.algorithm.name !== "ECDSA" ||
    (key.privateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    codevScopeKey(key.scope) !== record.keyId ||
    !Number.isFinite(Date.parse(key.expiresAt)) ||
    Date.parse(key.expiresAt) <= Date.now()
  )
    return null;
  const response = await online(record.scope, "browser", {
    pairing_id: record.pairing.pairing_id,
    surface,
    browser_session_id: record.scope.browserSessionId,
    action: "status",
  });
  assertEpoch(epoch);
  const paired = validatePairing(response.pairing, record.scope, key.publicKey);
  if (paired.intent.status !== "paired") return null;
  const client = new CodevBrokerClient(key, paired, async () => {
    await checkScope(record.scope);
    assertEpoch(epoch);
  });
  pending.add(client);
  try {
    await client.verifyConnection();
    // Reload never silently restores previously shared source or grants.
    const reset = await client.request<{
      workspace_grants: never[];
      grant_epochs: Record<string, number>;
    }>("workspace/reset", {});
    await checkScope(record.scope);
    assertEpoch(epoch);
    client.assertActive();
    const result = {
      client,
      key,
      pairing: paired,
      grantEpochs: reset.grant_epochs,
    };
    connections.set(scopeKey, result);
    return result;
  } catch (error) {
    client.disconnect();
    throw error;
  } finally {
    pending.delete(client);
  }
}

export async function cancelCodevSync(
  attempt: Pick<CodevSyncAttempt, "key" | "pairing">,
) {
  await online(attempt.key.scope, "browser", {
    pairing_id: attempt.pairing.pairing_id,
    surface: attempt.key.scope.surface,
    browser_session_id: attempt.key.scope.browserSessionId,
    action: "revoke",
  }).catch(() => {});
  pendingKeys.delete(codevScopeKey(attempt.key.scope));
  await deleteKey(codevScopeKey(attempt.key.scope)).catch(() => {});
}
export async function disconnectCodev(connection: CodevConnection) {
  // Close active authority synchronously, including patches already hashing.
  connection.client.disconnect();
  connections.delete(slotKey(connection.key.scope));
  try {
    sessionStorage.removeItem(slotKey(connection.key.scope));
  } catch {
    /* In-memory authority is already closed. */
  }
  void deleteKey(codevScopeKey(connection.key.scope)).catch(() => {});
  await revokePreviousNative(connection.key, connection.pairing);
  await cancelCodevSync(connection);
}
// This helper has one fixed operation. Revocation must still work after the
// website account changes; it cannot submit source, grant scope or run cognition.
async function revokePreviousNative(key: ScopedKey, pairing: PairingView) {
  let revoker: CodevBrokerClient | null = null;
  try {
    revoker = new CodevBrokerClient(key, pairing, async () => {});
    await revoker.request("revoke", {});
  } catch {
    /* Existing local authority is closed even if its process is offline. */
  } finally {
    revoker?.disconnect();
  }
}
// Auth events clear authority immediately; no source/recovery database is touched.
if (supabase)
  supabase.auth.onAuthStateChange((_event, session) => {
    const login = session ? codevLoginSessionId(session.access_token) : null;
    const identity =
      session && login ? JSON.stringify([session.user.id, login]) : null;
    if (observedAuth !== undefined && observedAuth !== identity)
      authorityEpoch++;
    observedAuth = identity;
    for (const [id, connection] of connections) {
      if (
        !session ||
        connection.key.scope.accountId !== session.user.id ||
        connection.key.scope.loginSessionId !== login
      ) {
        connection.client.disconnect();
        connections.delete(id);
        try {
          sessionStorage.removeItem(id);
        } catch {}
        void deleteKey(codevScopeKey(connection.key.scope)).catch(() => {});
        void revokePreviousNative(connection.key, connection.pairing);
      }
    }
    // Also invalidate a saved connection whose restoration was still awaiting
    // IndexedDB or HTTPS when authentication changed. This reads keys only to
    // revoke the previous pairing; it never reads another account's source.
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const id = sessionStorage.key(index);
        if (!id?.startsWith(prefix)) continue;
        try {
          const record = JSON.parse(
            sessionStorage.getItem(id)!,
          ) as StoredPairing;
          if (
            session &&
            record.scope.accountId === session.user.id &&
            record.scope.loginSessionId === login
          )
            continue;
          sessionStorage.removeItem(id);
          if (
            record.keyId !== codevScopeKey(record.scope) ||
            id !== slotKey(record.scope)
          )
            continue;
          void loadKey(record.keyId)
            .then((key) => {
              if (key && codevScopeKey(key.scope) === record.keyId)
                return revokePreviousNative(key, record.pairing);
            })
            .catch(() => {})
            .finally(() => {
              void deleteKey(record.keyId).catch(() => {});
            });
        } catch {
          sessionStorage.removeItem(id);
        }
      }
    } catch {
      /* In-memory authorities are still invalidated below. */
    }
    for (const [id, scope] of pendingKeys) {
      if (
        !session ||
        scope.accountId !== session.user.id ||
        scope.loginSessionId !== login
      ) {
        pendingKeys.delete(id);
        void deleteKey(id).catch(() => {});
      }
    }
    for (const client of pending) {
      if (
        !session ||
        client.key.scope.accountId !== session.user.id ||
        client.key.scope.loginSessionId !== login
      ) {
        client.disconnect();
        void revokePreviousNative(client.key, client.pairing);
      }
    }
  });
