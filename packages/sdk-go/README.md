# HEXVault Go SDK

```go
c := hexvault.New("http://127.0.0.1:3850")
h, _ := c.Health()
c.AddMemory("Use SQLite", "DB", "decision", []string{"db"})
c.Search("sqlite", 10)
c.GraphQL("{ health { ok version } }", nil)
```

```bash
cd packages/sdk-go && go test ./...
```
