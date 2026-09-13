import { useEffect, useMemo, useSyncExternalStore } from "react";
import { BrowserWorkspace, WorkspaceConflict, workspaceOwnerKey, type BrowserFileInput, type WorkspaceOwner, type WorkspaceState } from "./workspace";
import { loadWorkspaceRecovery, saveWorkspaceRecovery, type RecoveryHandle } from "./workspaceRecovery";

type ControllerState = { workspace: WorkspaceState; ready: boolean; recoveryError: string | null };
class WorkspaceController {
  model: BrowserWorkspace;
  private listeners = new Set<() => void>();
  private handle: RecoveryHandle;
  private state: ControllerState;
  private unsubscribe: () => void;
  private saveTail: Promise<unknown> = Promise.resolve();
  private recoveredRevision: number | null = null;
  constructor(owner: WorkspaceOwner, label: string, inputs: BrowserFileInput[], metadata: Record<string, unknown>) {
    this.model = new BrowserWorkspace(owner, label, inputs, undefined, metadata);
    this.handle = { owner, generation: 0 };
    this.state = { workspace: this.model.getSnapshot(), ready: false, recoveryError: null };
    this.unsubscribe = this.model.subscribe(() => this.publish());
    void loadWorkspaceRecovery(owner).then(loaded => {
      this.handle = loaded.handle;
      if (loaded.workspace) {
        this.unsubscribe(); this.model.dispose(); this.model = loaded.workspace;
        this.unsubscribe = this.model.subscribe(() => this.publish());
        this.recoveredRevision = this.model.getSnapshot().revision;
      }
      this.state = { ...this.state, ready: true }; this.publish();
    }).catch(error => {
      this.state = { ...this.state, ready: true, recoveryError: error instanceof Error ? error.message : "Browser recovery is unavailable." }; this.publish();
    });
  }
  private publish() { this.state = { ...this.state, workspace: this.model.getSnapshot() }; this.listeners.forEach(listener => listener()); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  assertReady() { if (!this.state.ready) throw new WorkspaceConflict("Wait for the current workspace recovery check before editing."); }
  updateText(path: string, text: string) { this.assertReady(); this.model.updateText(path, text); }
  importFiles(files: BrowserFileInput[], replace = false) { this.assertReady(); this.model.importFiles(files, this.model.getSnapshot().revision, replace); }
  updateMetadata(metadata: Record<string, unknown>) { this.assertReady(); this.model.updateMetadata(metadata); }
  persist(markSaved = false): Promise<number> {
    this.assertReady();
    const model = this.model;
    const revision = model.getSnapshot().revision;
    const save = this.saveTail.catch(() => {}).then(async () => {
      model.assertRevision(revision);
      this.handle = await saveWorkspaceRecovery(model, this.handle, markSaved);
      this.recoveredRevision = revision;
      if (this.state.recoveryError) { this.state = { ...this.state, recoveryError: null }; this.publish(); }
      return revision;
    });
    this.saveTail = save;
    return save;
  }
  canEvict() { return this.state.ready && this.listeners.size === 0 && !this.needsUnloadWarning(); }
  dispose() { this.unsubscribe(); this.model.dispose(); }
  reportRecoveryError(error: unknown) { this.state = { ...this.state, recoveryError: error instanceof Error ? error.message : "Browser recovery could not be saved." }; this.publish(); }
  needsUnloadWarning() { return this.state.workspace.dirty && this.recoveredRevision !== this.state.workspace.revision; }
}
// Remains active while route components are unmounted but unsaved files are still in memory.
if (typeof window !== "undefined") window.addEventListener("beforeunload", event => {
  if ([...sessions.values()].some(session => session.needsUnloadWarning())) { event.preventDefault(); event.returnValue = ""; }
});
const sessions = new Map<string, WorkspaceController>();
function acquire(owner: WorkspaceOwner, label: string, files: BrowserFileInput[], metadata: Record<string, unknown> = {}) {
  const key = workspaceOwnerKey(owner);
  const existing = sessions.get(key);
  if (existing) return existing;
  if (sessions.size >= 20) {
    const disposable = [...sessions].find(([, item]) => item.canEvict());
    if (disposable) { disposable[1].dispose(); sessions.delete(disposable[0]); }
    else throw new WorkspaceConflict("Save or export an open workspace before opening another one.");
  }
  const controller = new WorkspaceController(owner, label, files, metadata);
  sessions.set(key, controller);
  return controller;
}
export function useBrowserWorkspace(owner: WorkspaceOwner, label: string, files: BrowserFileInput[], metadata: Record<string, unknown> = {}) {
  const key = workspaceOwnerKey(owner);
  // Stable account/browser/surface/draft identity. Access token refresh is irrelevant.
  const controller = useMemo(() => acquire(owner, label, files, metadata), [key]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    if (!state.ready || !state.workspace.dirty || state.recoveryError || !controller.needsUnloadWarning()) return;
    const revision = state.workspace.revision;
    const timer = window.setTimeout(() => { void controller.persist().catch(error => {
      if (controller.getSnapshot().workspace.revision === revision) controller.reportRecoveryError(error);
    }); }, 600);
    return () => window.clearTimeout(timer);
  }, [controller, state.ready, state.workspace.revision, state.workspace.dirty, state.recoveryError]);
  return { controller, ...state };
}
