from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional


class HexVaultApiError(Exception):
    def __init__(self, message: str, status: int, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


class HexVaultClient:
    def __init__(self, base_url: str = "http://127.0.0.1:3850", token: Optional[str] = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.token = token or os.environ.get("HEXVAULT_API_TOKEN")
        self.timeout = timeout

    def _request(self, method: str, path: str, body: Any = None) -> Any:
        url = f"{self.base_url}{path}"
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                raw = res.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8") if e.fp else ""
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = raw
            raise HexVaultApiError(f"API {method} {path} → {e.code}", e.code, parsed) from e

    def health(self) -> dict:
        return self._request("GET", "/health")

    def list_memories(self, limit: int = 50, type: Optional[str] = None) -> dict:
        q = urllib.parse.urlencode({k: v for k, v in {"limit": limit, "type": type}.items() if v is not None})
        return self._request("GET", f"/v1/memories?{q}" if q else "/v1/memories")

    def add_memory(self, content: str, title: Optional[str] = None, type: str = "note", tags: Optional[list] = None) -> dict:
        return self._request("POST", "/v1/memories", {"content": content, "title": title or content[:60], "type": type, "tags": tags or []})

    def search(self, q: str, limit: int = 10) -> dict:
        qs = urllib.parse.urlencode({"q": q, "limit": limit})
        return self._request("GET", f"/v1/search?{qs}")

    def chat(self, question: str, context: Optional[str] = None) -> dict:
        body: dict = {"question": question}
        if context:
            body["context"] = context
        return self._request("POST", "/v1/chat", body)

    def stats(self) -> dict:
        return self._request("GET", "/v1/stats")

    def analyze(self, top: int = 15) -> dict:
        return self._request("GET", f"/v1/analyze?top={top}")

    def graph(self, limit: int = 60) -> dict:
        return self._request("GET", f"/v1/graph?limit={limit}")

    def graphql(self, query: str, variables: Optional[dict] = None) -> dict:
        return self._request("POST", "/graphql", {"query": query, "variables": variables or {}})
