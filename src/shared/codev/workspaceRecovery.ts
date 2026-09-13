/** Browser-local recovery with owner isolation and transaction-bound generations. */
import { BrowserWorkspace, WorkspaceConflict, workspaceOwnerKey, type WorkspaceOwner, type WorkspaceRecovery } from "./workspace";
const databaseName = "elysia-browser-workspaces-v1";
const storeName = "workspaces";
const maxRecords = 20;
export type RecoveryHandle = { owner: WorkspaceOwner; generation: number };
type StoredRecovery = { key: string; generation: number; recovery: WorkspaceRecovery };
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "key" });
    request.onerror = () => reject(new Error("Browser recovery storage is unavailable. Keep this page open or export your work."));
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error("Close the older workspace tab before upgrading browser recovery storage."));
  });
}
export function browserWorkspaceId(): string {
  // Stable within this browser; account/surface/draft remain independent key fields.
  const key = "elysia.browserWorkspaceId.v1";
  const stored = localStorage.getItem(key);
  if (stored && /^browser_[a-f0-9]{32}$/.test(stored)) return stored;
  const value = `browser_${crypto.randomUUID().replace(/-/g, "")}`;
  localStorage.setItem(key, value);
  return value;
}
export async function loadWorkspaceRecovery(owner: WorkspaceOwner): Promise<{ workspace: BrowserWorkspace | null; handle: RecoveryHandle }> {
  const database = await openDatabase();
  try {
    const stored = await new Promise<StoredRecovery | undefined>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(workspaceOwnerKey(owner));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Browser workspace recovery could not be read."));
    });
    if (!stored) return { workspace: null, handle: { owner, generation: 0 } };
    return { workspace: await BrowserWorkspace.restore(owner, stored.recovery), handle: { owner, generation: stored.generation } };
  } finally { database.close(); }
}
export async function saveWorkspaceRecovery(workspace: BrowserWorkspace, handle: RecoveryHandle, markSaved = false): Promise<RecoveryHandle> {
  workspace.assertOwner(handle.owner);
  const recovery = await workspace.recovery();
  if (markSaved) recovery.state = { ...recovery.state, savedRevision: recovery.state.revision, dirty: false };
  const database = await openDatabase();
  const key = workspaceOwnerKey(handle.owner);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      let failure: Error | null = null;
      const request = store.get(key);
      request.onsuccess = () => {
        const current = request.result as StoredRecovery | undefined;
        if ((current?.generation ?? 0) !== handle.generation) { failure = new WorkspaceConflict("Another tab saved this workspace. Recover or compare that revision before replacing it."); transaction.abort(); return; }
        const count = store.count();
        count.onsuccess = () => {
          if (!current && count.result >= maxRecords) { failure = new Error("Browser recovery storage has reached its workspace limit. Export and clear a saved workspace first."); transaction.abort(); return; }
          store.put({ key, generation: handle.generation + 1, recovery } satisfies StoredRecovery);
        };
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(failure ?? new Error("Browser recovery could not be saved. Keep this page open or export the current files."));
    });
    if (markSaved && workspace.getSnapshot().revision === recovery.state.revision) workspace.markSaved(recovery.state.revision);
    return { owner: handle.owner, generation: handle.generation + 1 };
  } finally { database.close(); }
}
export async function clearWorkspaceRecovery(handle: RecoveryHandle): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      let failure: Error | null = null;
      const key = workspaceOwnerKey(handle.owner);
      const request = store.get(key);
      request.onsuccess = () => {
        const current = request.result as StoredRecovery | undefined;
        if ((current?.generation ?? 0) !== handle.generation) { failure = new WorkspaceConflict("Another tab changed the recovery record. Reload its state before clearing it."); transaction.abort(); return; }
        store.delete(key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(failure ?? new Error("Browser recovery could not be cleared."));
    });
  } finally { database.close(); }
}
