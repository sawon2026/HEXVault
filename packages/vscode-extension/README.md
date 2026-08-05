# HEXVault for VS Code

Sidebar panel uses **React 18** + **esbuild**.

## Build

```bash
cd packages/vscode-extension
npm install
npm run build          # webview bundle + extension compile
# F5 to launch Extension Development Host
```

```
webview-ui/src/     React source (App.tsx)
media/webview.js    esbuild output (load in webview)
src/panel.ts        WebviewViewProvider + CSP nonce
```

## Message bridge

1. React: `vscode.postMessage({ type: 'search', query })`
2. Extension host: HEXVault API call
3. Host: `webview.postMessage({ type: 'searchResult', result })`

Requires `npm run api` at http://127.0.0.1:3850
