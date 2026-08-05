# Contributing to HEXVault

Thanks for your interest in improving HEXVault.

## Development setup

```bash
git clone https://github.com/sawon2026/HEXVault.git
cd HEXVault
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run CLI via tsx |
| `npm run build` | Compile TypeScript |
| `npm run dashboard` | Start web dashboard |
| `npm run action` | Run GitHub Action entrypoint locally |

## Guidelines

1. Keep the core **local-first** (SQLite, no required cloud).
2. LLM providers must remain optional (rule-based fallback always works).
3. Prefer small, focused PRs.
4. Update README / docs when you add user-facing features.
5. Add a memory about non-trivial decisions:

```bash
npx tsx src/cli/index.ts add "Your decision here" --type decision
```

## Code style

- TypeScript strict mode
- ES modules (`"type": "module"`)
- Clear names, minimal magic

## Reporting issues

Open an issue with:
- What you expected
- What happened
- Node version + OS
- Minimal reproduction if possible

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
