# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.4.x   | ✅ |
| < 0.4   | ⚠️ Best effort |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email or contact the maintainer privately via GitHub, and include:
- Description of the issue
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive an acknowledgment within a reasonable time.

## Security notes for users

- Memory databases (`.hexvault/`) may contain project-sensitive context. Do not commit them if they include secrets.
- API keys must only be provided via environment variables / GitHub Secrets — never hardcode them.
- Webhook URLs for Slack/Discord should be treated as secrets.
- The rule-based reviewer scans for common secret patterns; it is not a full SAST tool.
