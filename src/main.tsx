import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installStaleChunkRecovery } from "./runtime/staleChunkRecovery";
import "./styles.css";

installStaleChunkRecovery();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
