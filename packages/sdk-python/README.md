# hexvault (Python SDK)

Stdlib-only client for the HEXVault REST + GraphQL gateway.

```python
from hexvault import HexVaultClient

c = HexVaultClient("http://127.0.0.1:3850")
print(c.health())
c.add_memory("Use SQLite", type="decision", tags=["db"])
print(c.search("sqlite"))
print(c.chat("What database?"))
print(c.graphql("{ health { ok version } }"))
```

Requires API: `npm run api`
