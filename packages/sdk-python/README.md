# hexvault (Python SDK)

Stdlib-only client for HEXVault REST + GraphQL.

```python
from hexvault import HexVaultClient
c = HexVaultClient("http://127.0.0.1:3850")
print(c.health())
c.add_memory("Use SQLite", type="decision", tags=["db"])
print(c.graphql("{ health { ok version } }"))
```
