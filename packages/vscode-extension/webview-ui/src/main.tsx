import "./styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

declare function acquireVsCodeApi(): {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (s: unknown) => void;
};

const vscode = acquireVsCodeApi();
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App vscode={vscode} />
    </React.StrictMode>
  );
}
