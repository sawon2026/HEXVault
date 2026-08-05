export type BridgeRequest =
  | { type: "search"; query: string }
  | { type: "ask"; query: string }
  | { type: "health" };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

const pending = new Map<string, Pending>();

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type VsCodeApi = { postMessage: (msg: unknown) => void };

let vscodeRef: VsCodeApi | null = null;

export function setVsCodeApi(api: VsCodeApi) {
  vscodeRef = api;
}

export function installBridgeListener() {
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object" || !msg.requestId) return;
    const p = pending.get(msg.requestId);
    if (!p) return;
    pending.delete(msg.requestId);
    if (msg.type === "error") {
      p.reject(new Error(String(msg.message || "HEXVault error")));
      return;
    }
    p.resolve(msg.result ?? msg);
  });
}

export function bridgeCall<T = unknown>(req: BridgeRequest): Promise<T> {
  if (!vscodeRef) return Promise.reject(new Error("VS Code API not ready"));
  const requestId = id();
  return new Promise<T>((resolve, reject) => {
    pending.set(requestId, { resolve: (v) => resolve(v as T), reject });
    setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId);
        reject(new Error("HEXVault request timed out"));
      }
    }, 60_000);
    vscodeRef!.postMessage({ ...req, requestId });
  });
}
