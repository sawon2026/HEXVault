import * as vscode from "vscode";
import { HexVaultClient } from "./client";
import { HexVaultPanelProvider } from "./panel";

export function activate(context: vscode.ExtensionContext) {
  const client = new HexVaultClient();
  const panel = new HexVaultPanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(HexVaultPanelProvider.viewType, panel)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("hexvault.openPanel", async () => {
      await vscode.commands.executeCommand("hexvault.panel.focus");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("hexvault.health", async () => {
      try {
        const h = await client.health();
        vscode.window.showInformationMessage(`HEXVault OK: ${JSON.stringify(h)}`);
      } catch (err) {
        vscode.window.showErrorMessage(`HEXVault: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("hexvault.search", async () => {
      const query = await vscode.window.showInputBox({
        title: "HEXVault Search",
        prompt: "Search project memories",
      });
      if (!query?.trim()) return;
      try {
        const result = await client.search(query.trim());
        const hits = result.results || [];
        if (!hits.length) {
          vscode.window.showInformationMessage(`No memories for "${query}"`);
          return;
        }
        const pick = await vscode.window.showQuickPick(
          hits.map((h) => ({
            label: h.title || h.id || "memory",
            description: h.type || "",
            detail: (h.content || "").slice(0, 120),
            hit: h,
          })),
          { title: `HEXVault — ${hits.length} result(s)` }
        );
        if (pick?.hit) {
          const doc = await vscode.workspace.openTextDocument({
            content: `# ${pick.label}\n\nType: ${pick.description}\n\n${pick.hit.content || ""}`,
            language: "markdown",
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        }
      } catch (err) {
        vscode.window.showErrorMessage(`HEXVault: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("hexvault.addSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("Open a file first.");
        return;
      }
      const selection = editor.document.getText(editor.selection).trim();
      if (!selection) {
        vscode.window.showWarningMessage("Select some text first.");
        return;
      }
      const title = await vscode.window.showInputBox({
        title: "Add to HEXVault",
        prompt: "Memory title (optional)",
        value: selection.slice(0, 60),
      });
      if (title === undefined) return;
      try {
        await client.addMemory({ content: selection, title: title || undefined, tags: ["vscode", "selection"] });
        vscode.window.showInformationMessage("Memory saved to HEXVault.");
      } catch (err) {
        vscode.window.showErrorMessage(`HEXVault: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("hexvault.ask", async () => {
      const question = await vscode.window.showInputBox({
        title: "Ask HEXVault",
        prompt: "Question against project memory",
      });
      if (!question?.trim()) return;
      try {
        const result = await client.chat(question.trim());
        const doc = await vscode.workspace.openTextDocument({
          content: `## Q: ${question}\n\n${result.answer || "(no answer)"}\n\n_source: ${result.source || "unknown"}_`,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err) {
        vscode.window.showErrorMessage(`HEXVault: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );
}

export function deactivate() {}
