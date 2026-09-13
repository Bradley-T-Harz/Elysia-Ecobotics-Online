/** Bounded account/workspace-local operation metadata. Never an approval store. */
import type { OperationReceipt } from "./contracts";
import {
  canonicalWorkspacePath,
  unsafeWorkspaceText,
  workspaceOwnerKey,
  type WorkspaceOwner,
} from "./workspace";
const database = "elysia-codev-browser-receipts-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("traces", { keyPath: "ownerKey" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Local Codev trace storage is unavailable."));
    request.onblocked = () =>
      reject(
        new Error("Close older Codev tabs before opening local trace storage."),
      );
  });
}
function metadata(receipt: OperationReceipt): OperationReceipt {
  const copy: OperationReceipt = {
    operation_id: receipt.operation_id,
    request_id: receipt.request_id,
    workspace_id: receipt.workspace_id,
    status: receipt.status,
    summary: receipt.summary.slice(0, 1000),
    created_at: receipt.created_at,
    base_revision: receipt.base_revision,
    resulting_revision: receipt.resulting_revision,
    files_inspected: receipt.files_inspected
      ?.slice(0, 40)
      .map(canonicalWorkspacePath),
    files_changed: receipt.files_changed
      ?.slice(0, 20)
      .map(canonicalWorkspacePath),
    verification: receipt.verification,
    tests_run: receipt.tests_run
      ?.slice(0, 10)
      .map((value) => value.slice(0, 200)),
    network_used: receipt.network_used,
    audit_written: receipt.audit_written,
    warnings: receipt.warnings
      ?.slice(0, 10)
      .map((value) => value.slice(0, 500)),
    recovery_note: receipt.recovery_note?.slice(0, 1000),
  };
  const text = JSON.stringify(copy);
  if (text.length > 12000 || unsafeWorkspaceText(text))
    throw new Error(
      "This receipt could not be safely stored in browser trace history.",
    );
  return copy;
}
export async function loadBrowserReceipts(
  owner: WorkspaceOwner,
): Promise<OperationReceipt[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("traces", "readonly");
      const request = tx.objectStore("traces").get(workspaceOwnerKey(owner));
      request.onsuccess = () => {
        try {
          const receipts = request.result?.receipts ?? [];
          if (!Array.isArray(receipts)) throw new Error("Invalid local trace.");
          resolve(receipts.slice(0, 40).map(metadata));
        } catch {
          reject(new Error("Local Codev trace recovery is invalid."));
        }
      };
      request.onerror = () =>
        reject(new Error("Local Codev trace could not be read."));
    });
  } finally {
    db.close();
  }
}
export async function saveBrowserReceipt(
  owner: WorkspaceOwner,
  receipt: OperationReceipt,
) {
  const safe = metadata(receipt),
    ownerKey = workspaceOwnerKey(owner);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("traces", "readwrite"),
        store = tx.objectStore("traces"),
        request = store.get(ownerKey);
      request.onsuccess = () => {
        const previous = (request.result?.receipts ?? []) as OperationReceipt[];
        const put = () =>
          store.put({
            ownerKey,
            receipts: [
              safe,
              ...previous.filter(
                (item) => item.operation_id !== safe.operation_id,
              ),
            ].slice(0, 40),
          });
        if (request.result) put();
        else {
          const count = store.count();
          count.onsuccess = () => {
            if (count.result >= 20) tx.abort();
            else put();
          };
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            "Local Codev trace storage is full or unavailable. Clear an older workspace trace to make room.",
          ),
        );
      tx.onerror = () => {};
    });
  } finally {
    db.close();
  }
}
export async function clearBrowserReceipts(owner: WorkspaceOwner) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("traces", "readwrite");
      tx.objectStore("traces").delete(workspaceOwnerKey(owner));
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(new Error("The local Codev trace could not be cleared."));
      tx.onerror = () => {};
    });
  } finally {
    db.close();
  }
}
