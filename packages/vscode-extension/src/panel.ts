import * as vscode from "vscode";
import { HexVaultClient } from "./client";

export class HexVaultPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hexvault.panel";
  private readonly client = new HexVaultClient();

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.html();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === "search") {
          const result = await this.client.search(String(msg.query || ""));
          webviewView.webview.postMessage({ type: "searchResult", result });
        } else if (msg.type === "ask") {
          const result = await this.client.chat(String(msg.query || ""));
          webviewView.webview.postMessage({ type: "askResult", result });
        } else if (msg.type === "health") {
          const result = await this.client.health();
          webviewView.webview.postMessage({ type: "healthResult", result });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        webviewView.webview.postMessage({ type: "error", message });
        vscode.window.showErrorMessage(`HEXVault: ${message}`);
      }
    });
  }

  private html(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
body{font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background);margin:0;padding:12px}
h2{font-size:14px;margin:0 0 10px}.row{display:flex;gap:6px;margin-bottom:8px}
input{flex:1;padding:6px 8px;border:1px solid var(--vscode-input-border,#444);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:4px}
button{padding:6px 10px;border:none;border-radius:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}
button.secondary{background:transparent;border:1px solid var(--vscode-input-border,#444);color:var(--vscode-foreground)}
#out{margin-top:10px;white-space:pre-wrap;word-break:break-word;line-height:1.4;max-height:70vh;overflow:auto}
.hit{border:1px solid var(--vscode-input-border,#444);border-radius:6px;padding:8px;margin-bottom:8px}
.hit .meta{color:var(--vscode-descriptionForeground);font-size:11px;margin-bottom:4px}.err{color:#f87171}
</style>
</head>
<body>
<h2>HEXVault</h2>
<div class="row"><input id="q" placeholder="Search or ask…"/></div>
<div class="row">
<button id="search">Search</button>
<button id="ask">Ask</button>
<button id="health" class="secondary">Health</button>
</div>
<div id="out"></div>
<script>
const vscode=acquireVsCodeApi();
const out=document.getElementById('out');
const q=document.getElementById('q');
function busy(m){out.textContent=m||'Working…';out.className='';}
document.getElementById('search').onclick=()=>{const query=q.value.trim();if(!query)return;busy();vscode.postMessage({type:'search',query});};
document.getElementById('ask').onclick=()=>{const query=q.value.trim();if(!query)return;busy();vscode.postMessage({type:'ask',query});};
document.getElementById('health').onclick=()=>{busy();vscode.postMessage({type:'health'});};
q.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('search').click();});
window.addEventListener('message',event=>{
const msg=event.data;
if(msg.type==='error'){out.className='err';out.textContent=msg.message;}
else if(msg.type==='healthResult'){out.className='';out.textContent=JSON.stringify(msg.result,null,2);}
else if(msg.type==='askResult'){out.className='';const r=msg.result||{};out.textContent=(r.answer||'(no answer)')+(r.source?'\\n\\n— '+r.source:'');}
else if(msg.type==='searchResult'){
out.className='';const r=msg.result||{};const hits=r.results||[];
if(!hits.length){out.textContent='No results';return;}
out.innerHTML=hits.map((h,i)=>'<div class="hit"><div class="meta">'+(i+1)+'. '+(h.title||h.id||'')+' ['+(h.type||'')+']</div>'+((h.content||'').slice(0,240).replace(/</g,'&lt;'))+'</div>').join('');
}
});
</script>
</body></html>`;
  }
}
