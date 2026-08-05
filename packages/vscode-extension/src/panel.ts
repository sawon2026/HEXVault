import * as vscode from "vscode";
import { HexVaultClient } from "./client";

export class HexVaultPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hexvault.panel";
  private readonly client = new HexVaultClient();

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      const requestId = msg?.requestId;
      try {
        if (msg.type === "search") {
          const result = await this.client.search(String(msg.query || ""));
          webviewView.webview.postMessage({ type: "searchResult", result, requestId });
        } else if (msg.type === "ask") {
          const result = await this.client.chat(String(msg.query || ""));
          webviewView.webview.postMessage({ type: "askResult", result, requestId });
        } else if (msg.type === "health") {
          const result = await this.client.health();
          webviewView.webview.postMessage({ type: "healthResult", result, requestId });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        webviewView.webview.postMessage({ type: "error", message, requestId });
        vscode.window.showErrorMessage(`HEXVault: ${message}`);
      }
    });
  }

  private html(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "webview.js")
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HEXVault</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n = "";
  for (let i = 0; i < 32; i++) n += chars.charAt(Math.floor(Math.random() * chars.length));
  return n;
}
