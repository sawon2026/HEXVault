# Sample Memories for HEXVault

Use these as inspiration when starting a new project:

```bash
# Architecture decisions
hexvault add "All database access goes through the repository pattern. Never call SQLite directly from routes." --type architecture --tags database,pattern

hexvault add "We use Zod for all runtime validation of API inputs and outputs." --type decision --tags validation,api

# Security
hexvault add "Never log tokens, passwords, or PII. Use redaction helpers." --type security --tags logging,privacy

hexvault add "All secrets must come from environment variables or a secret manager. No hardcoded keys." --type security --tags secrets

# Bug fixes
hexvault add "Fixed memory leak in WebSocket handler by properly removing event listeners on disconnect." --type bugfix --files src/ws/handler.ts --tags websocket

# Patterns
hexvault add "Error responses always follow { success: false, error: { code, message } } format." --type pattern --tags api,errors

hexvault add "Feature flags are checked via the featureFlags service, never with process.env directly in components." --type pattern --tags features
```
