import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/useAuth";
import { codevLoginSessionId } from "./brokerClient";
import {
  beginCodevSync,
  cancelCodevSync,
  disconnectCodev,
  finishCodevSync,
  restoreCodevConnection,
  type CodevConnection,
  type CodevSyncAttempt,
} from "./pairingSession";
import type { CodevWorkspaceBinding } from "./workspaceBinding";
import CodevWorkspacePanel from "./CodevWorkspacePanel";
import "./codev.css";
const describe = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Codev could not complete this request.";
export default function SyncCodevSlot({
  surface,
  binding,
}: {
  surface: "marketplace" | "forge";
  binding?: CodevWorkspaceBinding | null;
}) {
  const auth = useAuth();
  const login = auth.accessToken ? codevLoginSessionId(auth.accessToken) : null;
  const current = useRef({ userId: auth.userId, login, binding });
  current.current = { userId: auth.userId, login, binding };
  const [connection, setConnection] = useState<CodevConnection | null>(null);
  const [attempt, setAttempt] = useState<CodevSyncAttempt | null>(null);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scopeLabel, setScopeLabel] = useState("No workspace shared");
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    const version = ++generation.current;
    let stopped = false;
    setConnection(null);
    setAttempt(null);
    setOpened(false);
    setBusy(false);
    setError("");
    setScopeLabel("No workspace shared");
    if (auth.userId && login)
      void restoreCodevConnection(surface)
        .then((value) => {
          if (!stopped && version === generation.current) setConnection(value);
        })
        .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [surface, auth.userId, login]);
  useEffect(() => {
    if (!connection) return;
    let stopped = false;
    const check = () =>
      connection.client.verifyConnection().catch(() => {
        if (!stopped) {
          void disconnectCodev(connection).catch(() => {});
          setConnection(null);
          setScopeLabel("No workspace shared");
          setError(
            "Connection lost. Your form and accepted edits remain available.",
          );
        }
      });
    const timer = window.setInterval(() => void check(), 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [connection]);
  useEffect(() => {
    const value = dialog.current;
    if (!value) return;
    if (opened && !value.open) value.showModal();
    else if (!opened && value.open) value.close();
  }, [opened, connection, attempt]);
  useEffect(() => {
    setScopeLabel("No workspace shared");
  }, [binding?.controller]);
  function isCurrent(
    version: number,
    userId: string | null,
    sessionId: string | null,
  ) {
    return (
      mounted.current &&
      generation.current === version &&
      current.current.userId === userId &&
      current.current.login === sessionId
    );
  }
  async function begin() {
    if (busy) return;
    if (connection) {
      setOpened(true);
      return;
    }
    setOpened(true);
    setError("");
    setBusy(true);
    const version = ++generation.current;
    const userId = auth.userId;
    const sessionId = login;
    try {
      const value = await beginCodevSync(surface);
      if (!isCurrent(version, userId, sessionId)) {
        void cancelCodevSync(value);
        return;
      }
      setAttempt(value);
    } catch (reason) {
      if (isCurrent(version, userId, sessionId)) setError(describe(reason));
    } finally {
      if (isCurrent(version, userId, sessionId)) setBusy(false);
    }
  }
  async function finish() {
    if (!attempt || busy) return;
    setBusy(true);
    setError("");
    const version = generation.current;
    const userId = auth.userId;
    const sessionId = login;
    try {
      await finishCodevSync(attempt, async () => {
        if (!isCurrent(version, userId, sessionId))
          throw new Error("The active account or page changed. Sync again.");
        const value = current.current.binding;
        if (value) await value.beforeRefresh();
        if (!isCurrent(version, userId, sessionId))
          throw new Error(
            "The active account or page changed. Your work was preserved.",
          );
      });
    } catch (reason) {
      if (isCurrent(version, userId, sessionId)) setError(describe(reason));
    } finally {
      if (isCurrent(version, userId, sessionId)) setBusy(false);
    }
  }
  function close() {
    generation.current++;
    setBusy(false);
    setOpened(false);
    setError("");
    if (attempt) {
      void cancelCodevSync(attempt);
      setAttempt(null);
    }
    button.current?.focus();
  }
  async function disconnect() {
    if (!connection || busy) return;
    setBusy(true);
    const closing = connection;
    void disconnectCodev(closing).catch(() => {});
    setConnection(null);
    setAttempt(null);
    setOpened(false);
    setError("");
    setScopeLabel("No workspace shared");
    setBusy(false);
    button.current?.focus();
  }
  return (
    <div className="codev-sync-slot" data-codev-slot={surface}>
      {connection ? (
        <div className="codev-connected-control">
          <span>
            <strong>Codev · connected locally</strong>
            <small>{scopeLabel}</small>
          </span>
          <button ref={button} type="button" onClick={() => setOpened(true)}>
            Open
          </button>
        </div>
      ) : (
        <button
          ref={button}
          type="button"
          className="codev-sync-button"
          onClick={() => void begin()}
        >
          Sync Codev
        </button>
      )}
      {(opened || connection) &&
        createPortal(
          <dialog
            ref={dialog}
            className={`codev-dialog ${connection ? "codev-drawer" : ""}`}
            aria-labelledby={`codev-dialog-title-${surface}`}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div className="codev-dialog-body">
              <header>
                <div>
                  <p className="codev-eyebrow">
                    {surface === "marketplace"
                      ? "Submission assistant"
                      : "Development assistant"}
                  </p>
                  <h2 id={`codev-dialog-title-${surface}`}>
                    {connection ? "Codev" : "Sync local Codev"}
                  </h2>
                </div>
                <button type="button" onClick={close} aria-label="Close Codev">
                  Close
                </button>
              </header>
              {error && (
                <p className="codev-message codev-error" role="alert">
                  {error}
                </p>
              )}
              {!connection && (
                <div className="codev-sync-steps">
                  <p>
                    Open Elysia with Codev installed. In its Codev workroom,
                    open <strong>Website connections</strong>, paste this code,
                    and review the website account before approving.
                  </p>
                  {attempt && (
                    <>
                      <label>
                        Short-lived pairing code
                        <input
                          aria-label="Codev pairing code"
                          value={attempt.manualCode}
                          readOnly
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </label>
                      <div className="codev-row">
                        <small>
                          Expires{" "}
                          {new Date(
                            attempt.pairing.intent.expires_at,
                          ).toLocaleTimeString()}
                        </small>
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(attempt.manualCode)
                              .catch(() =>
                                setError(
                                  "Select the pairing code and copy it manually.",
                                ),
                              )
                          }
                        >
                          Copy code
                        </button>
                      </div>
                      <p>
                        Pairing shares no files or workspaces. After local
                        approval, finish sync and allow your browser’s loopback
                        connection permission if prompted. Your page will
                        refresh with its current draft preserved.
                      </p>
                      <button
                        className="codev-primary"
                        type="button"
                        disabled={busy}
                        onClick={() => void finish()}
                      >
                        {busy
                          ? "Verifying connection…"
                          : "Finish sync and refresh"}
                      </button>
                    </>
                  )}
                  {!attempt && busy && (
                    <p role="status">Preparing a private connection…</p>
                  )}
                  {!attempt && !busy && (
                    <button type="button" onClick={() => void begin()}>
                      Retry sync
                    </button>
                  )}
                </div>
              )}
              {connection && (
                <>
                  <CodevWorkspacePanel
                    key={`${connection.pairing.pairing_id}:${binding?.controller.model.getSnapshot().id ?? "none"}`}
                    connection={connection}
                    binding={binding ?? null}
                    onScopeChange={setScopeLabel}
                  />
                  <footer className="codev-connection-footer">
                    <small>
                      {connection.pairing.intent.account_label} · Connection
                      expires{" "}
                      {new Date(
                        connection.pairing.intent.expires_at,
                      ).toLocaleTimeString()}
                      <br />
                      Local profile and website account remain separate. Review
                      and publication stay in the existing form.
                    </small>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void disconnect()}
                    >
                      Disconnect Codev
                    </button>
                  </footer>
                </>
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </div>
  );
}
