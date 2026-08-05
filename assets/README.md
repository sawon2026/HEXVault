# HEXVault brand assets

Optimized with [SVGO](https://github.com/svg/svgo) (`multipass`).

| File | Use |
|------|-----|
| `hexvault-logo.svg` | App icon / avatar |
| `hexvault-icon-32.svg` | Extension / toolbar |
| `hexvault-icon-16.svg` | Favicon |
| `hexvault-banner.svg` | README hero |
| `hexvault-social.svg` | GitHub social preview |
| `hexvault-feature-strip.svg` | README feature cards |

```bash
npx svgo --multipass -f assets --config svgo.config.mjs
```

Config keeps `viewBox` and accessibility attributes.
