/** Small owner-scoped browser patch backups. No cloud storage, credentials, or grants. */
import type { ChangePlan } from "./contracts";
import {
  BrowserWorkspace,
  browserWorkspaceHash,
  workspaceOwnerKey,
  type WorkspaceOwner,
} from "./workspace";
export type CodevPatchBackup = {
  id: string;
  ownerKey: string;
  owner: WorkspaceOwner;
  workspaceId: string;
  planId: string;
  baseRevision: number;
  afterRevision: number;
  afterHash: string;
  createdAt: string;
  files: Array<{
    path: string;
    text: string;
    baseHash: string;
    newHash: string;
  }>;
};
const database = "elysia-codev-patch-recovery-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () =>
      request.result
        .createObjectStore("backups", { keyPath: "id" })
        .createIndex("owner", "ownerKey");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser patch recovery storage is unavailable. The patch has not been applied.",
        ),
      );
    request.onblocked = () =>
      reject(
        new Error("Close older Codev tabs before creating patch recovery."),
      );
  });
}
export async function backupCodevPatch(
  model: BrowserWorkspace,
  plan: ChangePlan,
): Promise<CodevPatchBackup> {
  const captured = await model.capture();
  model.assertRevision(plan.base_revision);
  if (
    captured.contentHash !== plan.workspace_hash ||
    captured.workspaceId !== plan.workspace_id
  )
    throw new Error("The patch no longer matches this workspace.");
  const changes = plan.changes ?? [];
  const files = changes.map((change) => {
    const old = captured.files.find((file) => file.path === change.path);
    if (
      !old ||
      typeof old.text !== "string" ||
      old.content_hash !== change.base_hash
    )
      throw new Error("Exact patch recovery source is unavailable.");
    return {
      path: change.path,
      text: old.text!,
      baseHash: change.base_hash,
      newHash: change.new_hash,
    };
  });
  const afterFiles = captured.files.map((file) => {
    const change = changes.find((value) => value.path === file.path);
    return change
      ? {
          ...file,
          text: change.new_text,
          content_hash: change.new_hash,
          size_bytes: new TextEncoder().encode(change.new_text).length,
        }
      : file;
  });
  const backup: CodevPatchBackup = {
    id: workspaceOwnerKey(captured.owner) + ":" + plan.plan_id,
    ownerKey: workspaceOwnerKey(captured.owner),
    owner: captured.owner,
    workspaceId: captured.workspaceId,
    planId: plan.plan_id,
    baseRevision: captured.revision,
    afterRevision: captured.revision + 1,
    afterHash: await browserWorkspaceHash(afterFiles),
    createdAt: new Date().toISOString(),
    files,
  };
  if (new TextEncoder().encode(JSON.stringify(backup)).length > 3 * 1024 * 1024)
    throw new Error("This patch exceeds the bounded browser recovery size.");
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("backups", "readwrite");
      const store = tx.objectStore("backups");
      const get = store.get(backup.id);
      get.onsuccess = () => {
        if (get.result) {
          store.put(backup);
          return;
        }
        const count = store.count();
        count.onsuccess = () => {
          if (count.result >= 20) tx.abort();
          else store.put(backup);
        };
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            "Browser patch recovery is full or unavailable. Download and clear an older recovery record before applying.",
          ),
        );
      tx.onerror = () => {};
    });
  } finally {
    db.close();
  }
  model.assertRevision(plan.base_revision);
  return backup;
}
export async function listCodevPatchBackups(
  owner: WorkspaceOwner,
): Promise<CodevPatchBackup[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("backups", "readonly");
      const request = tx
        .objectStore("backups")
        .index("owner")
        .getAll(IDBKeyRange.only(workspaceOwnerKey(owner)));
      request.onsuccess = () =>
        resolve(
          (request.result as CodevPatchBackup[])
            .filter(
              (value) =>
                workspaceOwnerKey(value.owner) === workspaceOwnerKey(owner),
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      request.onerror = () =>
        reject(new Error("Browser patch recovery could not be loaded."));
    });
  } finally {
    db.close();
  }
}
export async function clearCodevPatchBackup(owner: WorkspaceOwner, id: string) {
  if (!id.startsWith(workspaceOwnerKey(owner) + ":"))
    throw new Error("Recovery owner mismatch.");
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("backups", "readwrite");
      const store = tx.objectStore("backups");
      const request = store.get(id);
      request.onsuccess = () => {
        if (
          !request.result ||
          workspaceOwnerKey(request.result.owner) !== workspaceOwnerKey(owner)
        ) {
          tx.abort();
          return;
        }
        store.delete(id);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            "This recovery record does not belong to the active workspace.",
          ),
        );
      tx.onerror = () => {};
    });
  } finally {
    db.close();
  }
}
export async function restoreCodevPatch(
  model: BrowserWorkspace,
  backup: CodevPatchBackup,
  assertAuthority: () => void,
) {
  assertAuthority();
  model.assertOwner(backup.owner);
  const current = await model.capture();
  if (
    current.workspaceId !== backup.workspaceId ||
    current.revision !== backup.afterRevision ||
    current.contentHash !== backup.afterHash
  )
    throw new Error(
      "The workspace changed after this patch. Download the recovery record to review its original text instead.",
    );
  return model.applyReviewedPatch({
    planId: "restore:" + backup.planId,
    revision: current.revision,
    contentHash: current.contentHash,
    owner: backup.owner,
    explicitlyApproved: true,
    assertAuthority,
    changes: backup.files.map((file) => ({
      path: file.path,
      baseHash: file.newHash,
      newHash: file.baseHash,
      text: file.text,
    })),
  });
}
