# HEXVault Go SDK

Official Go client for the HEXVault REST + GraphQL API.

```go
package main

import (
	"fmt"
	"github.com/sawon2026/HEXVault/packages/sdk-go/hexvault"
)

func main() {
	c := hexvault.New("http://127.0.0.1:3850")
	h, _ := c.Health()
	fmt.Println(h)

	c.AddMemory("Use SQLite locally", "DB choice", "decision", []string{"db"})
	res, _ := c.Search("sqlite", 10)
	fmt.Println(res)

	gql, _ := c.GraphQL("{ health { ok version } }", nil)
	fmt.Println(gql)
}
```

## Methods

| Method | Endpoint |
|--------|----------|
| `Health` | `GET /health` |
| `AddMemory` | `POST /v1/memories` |
| `Search` | `GET /v1/search` |
| `Chat` | `POST /v1/chat` |
| `Stats` | `GET /v1/stats` |
| `Analyze` | `GET /v1/analyze` |
| `Graph` | `GET /v1/graph` |
| `GraphQL` | `POST /graphql` |

```bash
cd packages/sdk-go
go test ./...
```

Requires API: `npm run api` from repo root.
