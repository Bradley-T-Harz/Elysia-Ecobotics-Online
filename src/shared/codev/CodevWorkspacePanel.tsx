import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  ChangePlan,
  ExactApproval,
  OperationReceipt,
  WorkspaceGrant,
} from "./contracts";
import type { CodevConnection } from "./pairingSession";
import type { CodevWorkspaceBinding } from "./workspaceBinding";
import { unsafeWorkspaceText } from "./workspace";
import {
  backupCodevPatch,
  clearCodevPatchBackup,
  listCodevPatchBackups,
  restoreCodevPatch,
  type CodevPatchBackup,
} from "./patchRecovery";
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Codev could not complete the operation.";
type ShareResult = {
  workspace_id: string;
  revision: number;
  content_hash: string;
  grant: WorkspaceGrant;
  shared_files: string[];
};
type ChatResult = {
  response_text: string;
  invocation_status: string;
  receipt: OperationReceipt;
  model_tag: string | null;
  context_receipt: unknown;
};
const labelHash = (value: string) => value.slice(0, 12);
export default function CodevWorkspacePanel(props: {
  connection: CodevConnection;
  binding: CodevWorkspaceBinding | null;
  onScopeChange: (label: string) => void;
}) {
  if (!props.binding)
    return (
      <p className="codev-message">
        Connected to local Codev. No workspace shared. Choose a draft on this
        page to select development context.
      </p>
    );
  return <BoundPanel {...props} binding={props.binding} />;
}
function BoundPanel({
  connection,
  binding,
  onScopeChange,
}: {
  connection: CodevConnection;
  binding: CodevWorkspaceBinding;
  onScopeChange: (label: string) => void;
}) {
  const { controller } = binding;
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const workspace = state.workspace;
  const live = useRef({ binding, connection });
  live.current = { binding, connection };
  const mounted = useRef(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [propose, setPropose] = useState(false);
  const [shared, setShared] = useState<ShareResult | null>(null);
  const shareRef = useRef(shared);
  shareRef.current = shared;
  const [tab, setTab] = useState<"scope" | "conversation" | "review" | "trace">(
    "scope",
  );
  const [message, setMessage] = useState("");
  const [gear, setGear] = useState("standard");
  const [messages, setMessages] = useState<
    Array<{ role: string; text: string; result?: ChatResult }>
  >([]);
  const [plan, setPlan] = useState<ChangePlan | null>(null);
  const [receipts, setReceipts] = useState<OperationReceipt[]>([]);
  const [backups, setBackups] = useState<CodevPatchBackup[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [running, setRunning] = useState<string | null>(null);
  const runningRef = useRef(running);
  runningRef.current = running;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const currentShare =
    shared &&
    !shared.grant.revoked &&
    Date.parse(shared.grant.expires_at) > now &&
    shared.revision === workspace.revision;
  const canPropose = !!currentShare && shared.grant.scopes?.includes("propose");
  const label =
    shared && Date.parse(shared.grant.expires_at) <= now
      ? "Workspace access expired"
      : currentShare
        ? `Workspace: ${canPropose ? "read / propose edits" : "read only"}`
        : shared
          ? "Workspace changed · share again"
          : "No workspace shared";
  useEffect(() => {
    onScopeChange(label);
  }, [label, onScopeChange]);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    void listCodevPatchBackups(workspace.owner)
      .then((value) => {
        if (mounted.current) setBackups(value);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      const run = runningRef.current;
      if (run)
        void connection.client
          .request("chat/cancel", { request_id: run })
          .catch(() => {});
      if (shareRef.current)
        void connection.client
          .request<{ grant_epoch: number }>("workspace/revoke", {
            workspace_id: workspace.id,
          })
          .then((result) => {
            connection.grantEpochs[workspace.id] = result.grant_epoch;
          })
          .catch(() => {});
    };
  }, [connection, workspace.id]);
  useEffect(() => {
    if (!shared) return;
    let stopped = false;
    let checking = false;
    const timer = window.setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const status = await connection.client.request<ShareResult>(
          "workspace/status",
          { workspace_id: workspace.id },
        );
        if (
          !stopped &&
          (!status.grant ||
            status.grant.revoked ||
            status.grant.epoch !== shared.grant.epoch ||
            Date.parse(status.grant.expires_at) <= Date.now())
        )
          throw new Error(
            "Workspace access expired or was revoked. Share context again to continue.",
          );
      } catch (reason) {
        if (!stopped) {
          shareRef.current = null;
          setShared(null);
          setPlan(null);
          setError(errorText(reason));
          void connection.client
            .request<{ grant_epoch: number }>("workspace/revoke", {
              workspace_id: workspace.id,
            })
            .then((result) => {
              connection.grantEpochs[workspace.id] = result.grant_epoch;
            })
            .catch(() => {});
        }
      } finally {
        checking = false;
      }
    }, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [connection, workspace.id, shared]);
  function remember(receipt: OperationReceipt) {
    setReceipts((previous) => [receipt, ...previous].slice(0, 40));
  }
  function assertEditable() {
    connection.client.assertActive();
    if (
      !mounted.current ||
      live.current.connection !== connection ||
      live.current.binding.controller !== controller ||
      !live.current.binding.canEdit()
    )
      throw new Error("This draft is no longer available for Codev edits.");
  }
  function assertShare() {
    connection.client.assertActive();
    const current = shareRef.current;
    if (
      !mounted.current ||
      !current ||
      current.grant.revoked ||
      Date.parse(current.grant.expires_at) <= Date.now() ||
      current.revision !== controller.model.getSnapshot().revision
    )
      throw new Error(
        "Share the current workspace revision before continuing.",
      );
    return current;
  }
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      if (mounted.current) setError(errorText(reason));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function share() {
    controller.assertReady();
    connection.client.assertActive();
    const capture = await controller.model.capture();
    controller.model.assertRevision(capture.revision);
    const files = capture.files.map((file) =>
      selected.includes(file.path)
        ? file
        : { ...file, text: null, availability: "metadata_only" as const },
    );
    const result = await connection.client.request<ShareResult>(
      "workspace/share",
      {
        workspace_id: capture.workspaceId,
        surface: connection.key.scope.surface,
        draft_id: capture.owner.draftId,
        label: workspace.label,
        base_revision: capture.baseRevision,
        current_revision: capture.revision,
        content_hash: capture.contentHash,
        files,
        scopes: propose ? ["read", "propose"] : ["read"],
        expected_epoch: connection.grantEpochs[capture.workspaceId] ?? 0,
        explicitly_approved: true,
      },
    );
    connection.grantEpochs[capture.workspaceId] = result.grant.epoch;
    if (!mounted.current) {
      const revoked = await connection.client.request<{ grant_epoch: number }>(
        "workspace/revoke",
        { workspace_id: capture.workspaceId },
      );
      connection.grantEpochs[capture.workspaceId] = revoked.grant_epoch;
      return;
    }
    shareRef.current = result;
    setShared(result);
    setPlan(null);
    setNotice(
      `${result.shared_files.length} selected file${result.shared_files.length === 1 ? "" : "s"} and the file inventory shared with local Codev.`,
    );
  }
  async function revoke() {
    const result = await connection.client.request<{ grant_epoch: number }>(
      "workspace/revoke",
      { workspace_id: workspace.id },
    );
    connection.grantEpochs[workspace.id] = result.grant_epoch;
    shareRef.current = null;
    setShared(null);
    setPlan(null);
    setNotice("Workspace access revoked. Your browser files are unchanged.");
  }
  async function chat(text = message) {
    const context = assertShare();
    if (!text.trim()) return;
    const requestId = "codev_" + crypto.randomUUID().replace(/-/g, "");
    setRunning(requestId);
    runningRef.current = requestId;
    setMessages((previous) => [...previous, { role: "You", text }]);
    setMessage("");
    try {
      const result = await connection.client.request<ChatResult>("chat", {
        workspace_id: workspace.id,
        revision: context.revision,
        content_hash: context.content_hash,
        grant_epoch: context.grant.epoch,
        message: text,
        requested_gear: gear,
        request_id: requestId,
      });
      assertShare();
      if (!mounted.current) return;
      setMessages((previous) => [
        ...previous,
        { role: "Codev", text: result.response_text, result },
      ]);
      remember(result.receipt);
    } finally {
      setRunning(null);
      runningRef.current = null;
    }
  }
  async function proposeResponse(text: string) {
    const context = assertShare();
    assertEditable();
    const match = text.match(/```json\s*([\s\S]*?)```/i);
    const parsed = JSON.parse(match ? match[1] : text);
    if (
      Object.keys(parsed).sort().join() !== "edits,summary" ||
      typeof parsed.summary !== "string" ||
      !parsed.edits ||
      Array.isArray(parsed.edits)
    )
      throw new Error(
        "Ask Codev for one JSON proposal with summary and complete replacement texts in edits.",
      );
    const result = await connection.client.request<{ plan: ChangePlan }>(
      "patch/plan",
      {
        workspace_id: workspace.id,
        revision: context.revision,
        content_hash: context.content_hash,
        grant_epoch: context.grant.epoch,
        summary: parsed.summary,
        edits: parsed.edits,
      },
    );
    assertShare();
    assertEditable();
    setPlan(result.plan);
    setTab("review");
  }
  async function apply() {
    if (!plan) return;
    assertEditable();
    const context = assertShare();
    if (
      !context.grant.scopes?.includes("propose") ||
      plan.grant_epoch !== context.grant.epoch ||
      Date.parse(plan.expires_at) <= Date.now()
    )
      throw new Error("This patch approval is stale. Request a new review.");
    const saved = await controller.persist();
    controller.model.assertRevision(saved);
    const backup = await backupCodevPatch(controller.model, plan);
    if (mounted.current)
      setBackups((previous) => [
        backup,
        ...previous.filter((item) => item.id !== backup.id),
      ]);
    const approved = await connection.client.request<{
      plan: ChangePlan;
      approval: ExactApproval;
      receipt: OperationReceipt;
    }>("patch/authorize", {
      workspace_id: workspace.id,
      revision: context.revision,
      content_hash: context.content_hash,
      grant_epoch: context.grant.epoch,
      plan_id: plan.plan_id,
      plan_hash: plan.plan_hash,
      explicitly_approved: true,
    });
    const exact = approved.plan;
    if (
      exact.plan_hash !== plan.plan_hash ||
      exact.plan_id !== plan.plan_id ||
      exact.actor.client_id !== plan.actor.client_id ||
      approved.approval.operation !== "browser_patch" ||
      !approved.approval.consumed
    )
      throw new Error("The local approval does not match this review.");
    const guard = () => {
      assertEditable();
      const active = assertShare();
      if (
        active.grant.epoch !== plan.grant_epoch ||
        Date.parse(plan.expires_at) <= Date.now()
      )
        throw new Error("Patch authority changed.");
    };
    const changed = await controller.model.applyReviewedPatch({
      planId: exact.plan_id,
      revision: exact.base_revision,
      contentHash: exact.workspace_hash,
      owner: workspace.owner,
      explicitlyApproved: true,
      assertAuthority: guard,
      changes: (exact.changes ?? []).map((change) => ({
        path: change.path,
        baseHash: change.base_hash,
        newHash: change.new_hash,
        text: change.new_text,
      })),
    });
    setPlan(null);
    const receipt: OperationReceipt = {
      operation_id: exact.plan_id,
      request_id: exact.plan_id,
      workspace_id: workspace.id,
      status: "completed",
      summary: "Reviewed changes applied to this browser workspace.",
      base_revision: exact.base_revision,
      resulting_revision: changed.revision,
      files_changed: (exact.changes ?? []).map((change) => change.path),
      verification: "passed",
      tests_run: [],
      network_used: false,
      audit_written: false,
      created_at: new Date().toISOString(),
      recovery_note:
        "Original text is retained in this account’s browser patch recovery.",
    };
    try {
      await controller.persist();
    } catch (reason) {
      receipt.status = "partial";
      receipt.warnings = [
        "Edits are present in memory, but current browser recovery could not be saved: " +
          errorText(reason),
      ];
    }
    remember(receipt);
    setNotice(
      "Accepted changes are in the browser workspace. Review, validation, save and transfer remain separate actions.",
    );
    binding.onChanged?.(receipt.summary);
  }
  async function restore(backup: CodevPatchBackup) {
    const changed = await restoreCodevPatch(
      controller.model,
      backup,
      assertEditable,
    );
    await controller.persist();
    setNotice(
      `Original browser text restored at revision ${changed.revision}. Validation and transfer must use this new revision.`,
    );
  }
  function download(backup: CodevPatchBackup) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "codev-browser-recovery-" + backup.planId + ".json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const diagnostics = binding.diagnostics?.() ?? [];
  function shortcut(prompt: string) {
    const findings =
      prompt === "Explain validation findings"
        ? "\nCurrent browser validation findings (not an execution result):\n" +
          diagnostics.slice(0, 40).join("\n").slice(0, 6000)
        : "";
    setMessage(
      prompt +
        " using only the shared development context. Do not claim to have run checks or approved publication." +
        findings,
    );
  }
  const shortcuts =
    connection.key.scope.surface === "marketplace"
      ? [
          "Review manifest consistency",
          "Explain validation findings",
          "Explain requested permissions",
          "Review package inventory",
          "Summarize submission readiness",
        ]
      : ["Explain this project", "Find likely bugs", "Plan a focused refactor"];
  return (
    <div className="codev-workspace-panel">
      <div className="codev-scope-heading">
        <strong>{workspace.label}</strong>
        <small>
          Revision {workspace.revision} · {label}
        </small>
      </div>
      <nav className="codev-panel-tabs" aria-label="Codev panel sections">
        {(["scope", "conversation", "review", "trace"] as const).map(
          (value) => (
            <button
              type="button"
              key={value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {value === "scope"
                ? "Context"
                : value === "conversation"
                  ? "Conversation"
                  : value === "review"
                    ? "Review"
                    : "Trace & recovery"}
            </button>
          ),
        )}
      </nav>
      {error && (
        <p className="codev-message codev-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="codev-message" role="status">
          {notice}
        </p>
      )}
      {tab === "scope" && (
        <div className="codev-panel-section">
          <p>
            Share the file inventory and only the contents you select. Native
            folders, commands, network access and remote transfer receive no
            grant.
          </p>
          <p className="codev-message">
            {binding.sourceDescription?.() ?? "Browser workspace"} · Browser →
            Local Codev · {workspace.files.length} files in the inventory (
            {workspace.files
              .reduce((total, file) => total + file.sizeBytes, 0)
              .toLocaleString()}{" "}
            bytes). {selected.length} files selected for full text (
            {workspace.files
              .filter((file) => selected.includes(file.path))
              .reduce((total, file) => total + file.sizeBytes, 0)
              .toLocaleString()}{" "}
            bytes). Context stays in local memory for this connection;
            refreshing clears its grant.
          </p>
          <div
            className="codev-file-selection"
            role="group"
            aria-label="Select Codev file context"
          >
            {workspace.files.map((file) => {
              const available =
                file.text !== null &&
                file.sizeBytes <= 131072 &&
                !unsafeWorkspaceText(file.text);
              return (
                <label key={file.path}>
                  <input
                    type="checkbox"
                    checked={selected.includes(file.path)}
                    disabled={
                      !available ||
                      busy ||
                      (!selected.includes(file.path) && selected.length >= 40)
                    }
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, file.path]
                          : previous.filter((path) => path !== file.path),
                      )
                    }
                  />
                  <span>
                    {file.path}
                    <small>
                      {available
                        ? `${file.sizeBytes.toLocaleString()} bytes`
                        : "Metadata only"}
                    </small>
                  </span>
                </label>
              );
            })}
          </div>
          <label className="codev-check">
            <input
              type="checkbox"
              checked={propose}
              disabled={busy || !binding.canEdit()}
              onChange={(event) => setPropose(event.target.checked)}
            />
            Allow proposals for selected files; each patch still needs exact
            approval.
          </label>
          <div className="codev-row">
            <button
              type="button"
              className="codev-primary"
              disabled={!state.ready || busy}
              onClick={() => void run(share)}
            >
              Share selected context ({selected.length})
            </button>
            {shared && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(revoke)}
              >
                Revoke workspace access
              </button>
            )}
          </div>
          {!binding.canEdit() && (
            <p className="codev-message">
              This draft is read-only. Codev can help explain shared context;
              accepted edits require an editable revision draft.
            </p>
          )}
        </div>
      )}
      {tab === "conversation" && (
        <div className="codev-panel-section">
          <div className="codev-quick-actions">
            {shortcuts.map((prompt) => (
              <button
                type="button"
                disabled={!currentShare || busy}
                key={prompt}
                onClick={() => shortcut(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="codev-conversation-log" aria-live="polite">
            {messages.map((entry, index) => (
              <article key={index}>
                <strong>{entry.role}</strong>
                <pre>{entry.text}</pre>
                {entry.result && (
                  <small>
                    {entry.result.model_tag ?? "Local model"} ·{" "}
                    {entry.result.invocation_status} · No tests executed · Files
                    inspected:{" "}
                    {entry.result.receipt.files_inspected?.join(", ") || "none"}
                  </small>
                )}
                {entry.result?.invocation_status === "ok" && canPropose && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => proposeResponse(entry.text))}
                  >
                    Review proposed edits
                  </button>
                )}
              </article>
            ))}
          </div>
          <label>
            Ask Codev
            <textarea
              aria-label="Ask Codev"
              rows={4}
              maxLength={16000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about the selected context…"
            />
          </label>
          <div className="codev-row">
            <label>
              Reasoning
              <select
                aria-label="Codev reasoning gear"
                value={gear}
                onChange={(event) => setGear(event.target.value)}
                disabled={busy}
              >
                {[
                  "automatic",
                  "quick",
                  "standard",
                  "deep",
                  "deliberative",
                  "research_engineering",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            {running ? (
              <button
                type="button"
                onClick={() =>
                  void connection.client
                    .request("chat/cancel", { request_id: running })
                    .catch((reason) => setError(errorText(reason)))
                }
              >
                Stop response
              </button>
            ) : (
              <button
                type="button"
                className="codev-primary"
                disabled={!currentShare || busy || !message.trim()}
                onClick={() => void run(() => chat())}
              >
                Send to local Codev
              </button>
            )}
          </div>
          {canPropose && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setMessage(
                  "Propose a focused improvement to the selected existing files. Return one fenced JSON object with exactly summary (a short string) and edits (a map from each selected existing relative path to its complete replacement text). Do not apply anything or claim tests ran.",
                )
              }
            >
              Prepare an edit request
            </button>
          )}
          {!currentShare && (
            <p>
              Share the current revision in Context before sending it to Codev.
            </p>
          )}
        </div>
      )}
      {tab === "review" && (
        <div className="codev-panel-section">
          {plan ? (
            <>
              <h3>{plan.summary}</h3>
              <p>
                Revision {plan.base_revision} · Workspace{" "}
                {labelHash(plan.workspace_hash)} · Approval expires{" "}
                {new Date(plan.expires_at).toLocaleTimeString()}
              </p>
              {(plan.changes ?? []).map((change) => (
                <details className="codev-diff" key={change.path} open>
                  <summary>
                    {change.path} · {labelHash(change.base_hash)} →{" "}
                    {labelHash(change.new_hash)}
                  </summary>
                  <pre>{change.diff}</pre>
                  <details>
                    <summary>
                      Complete replacement ·{" "}
                      {new TextEncoder().encode(change.new_text).length} bytes ·{" "}
                      {change.new_text.endsWith("\n")
                        ? "final newline"
                        : "no final newline"}
                    </summary>
                    <pre>{change.new_text}</pre>
                  </details>
                </details>
              ))}
              <p>
                A browser recovery record is created before approval. Native
                files, remote drafts and submission status are unchanged by this
                action.
              </p>
              <div className="codev-row">
                <button
                  type="button"
                  className="codev-primary"
                  disabled={
                    busy ||
                    !canPropose ||
                    !binding.canEdit() ||
                    plan.base_revision !== workspace.revision ||
                    Date.parse(plan.expires_at) <= now
                  }
                  onClick={() => void run(apply)}
                >
                  Apply these {plan.changes?.length ?? 0} changes
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPlan(null)}
                >
                  Reject proposal
                </button>
              </div>
              {plan.base_revision !== workspace.revision && (
                <p className="codev-message">
                  This proposal is stale. Share the current revision and request
                  a new review.
                </p>
              )}
            </>
          ) : (
            <p>
              No proposed changes. Ask Codev for a focused edit, then review its
              exact diff here.
            </p>
          )}
        </div>
      )}
      {tab === "trace" && (
        <div className="codev-panel-section">
          <p>
            {shared
              ? `Shared revision ${shared.revision}: ${shared.shared_files.join(", ") || "file inventory only"}.`
              : "No source is currently shared."}{" "}
            No native commands or remote transfer are authorized here.
          </p>
          {receipts.map((receipt, index) => (
            <article
              className="codev-receipt"
              key={receipt.operation_id + index}
            >
              <strong>
                {receipt.status} · {receipt.summary}
              </strong>
              <p>
                {receipt.files_changed?.length
                  ? "Changed: " + receipt.files_changed.join(", ")
                  : "No file mutation recorded"}
              </p>
              <small>
                Verification: {receipt.verification ?? "not_run"} · Tests:{" "}
                {receipt.tests_run?.length ?? 0}
              </small>
              {receipt.warnings?.map((warning) => (
                <p key={warning} className="codev-error">
                  {warning}
                </p>
              ))}
            </article>
          ))}
          <h3>Browser patch recovery</h3>
          <p>
            Recovery records contain original file text and remain scoped to
            this account and workspace in this browser.
          </p>
          {backups.length ? (
            backups.map((backup) => (
              <article className="codev-receipt" key={backup.id}>
                <strong>Before revision {backup.afterRevision}</strong>
                <p>{backup.files.map((file) => file.path).join(", ")}</p>
                <div className="codev-row">
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !binding.canEdit() ||
                      workspace.revision !== backup.afterRevision
                    }
                    onClick={() => void run(() => restore(backup))}
                  >
                    Restore original text
                  </button>
                  <button type="button" onClick={() => download(backup)}>
                    Download recovery
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await clearCodevPatchBackup(workspace.owner, backup.id);
                        setBackups((previous) =>
                          previous.filter((item) => item.id !== backup.id),
                        );
                      })
                    }
                  >
                    Clear recovery record
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p>No accepted patch recovery records.</p>
          )}
        </div>
      )}
    </div>
  );
}
