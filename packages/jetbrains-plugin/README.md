# HEXVault JetBrains Plugin

IntelliJ Platform plugin for [HEXVault](https://github.com/sawon2026/HEXVault).

## Features

- **Tool window** (right) — Search / Ask / Health
- **Tools → HEXVault** — Search, Add selection, Ask, Open panel
- **Settings → Tools → HEXVault** — API URL + token

## Build

```bash
cd packages/jetbrains-plugin
./gradlew buildPlugin   # ZIP under build/distributions/
./gradlew runIde        # launch sandbox IDE
```

Requires JDK 17+ and a running HEXVault API (`npm run api`).

## Install ZIP

Settings → Plugins → ⚙ → Install Plugin from Disk…
