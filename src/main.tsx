import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isSandboxBuild } from "./config/sandboxEnvironment";
import { installStaleChunkRecovery } from "./runtime/staleChunkRecovery";
import "./styles.css";

installStaleChunkRecovery();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isSandboxBuild && <div className="sandbox-environment-banner" role="status">Sandbox · Synthetic data only · Payments disabled</div>}
    <App />
  </React.StrictMode>
);
