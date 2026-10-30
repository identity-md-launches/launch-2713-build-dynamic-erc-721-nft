# Submission path budget

The added bundle must remain below 8,388,608 bytes. `npm run check:bundle` inventories source and export, excluding inputs and local test scaffolding, and fails above that limit.

| Path | Budget (bytes) | Purpose |
| --- | ---: | --- |
| `.gitignore` | 256 | Explicitly budgeted ignore file; excludes dependency directories at every depth, caches, scratch checks, and logs. Does not ignore `dist/`. |
| `dist/` | 4,500,000 | Complete production runtime, fonts, artwork, social image, ABI, bytecode and deployment configuration. |
| `package-lock.json` | 1,000,000 | Reproducible registry dependency lockfile. |
| `src/`, `contracts/`, `public/` | 1,500,000 | Source, generated ABI, local images, font licenses and public handoff. |
| `scripts/`, `tests/`, root configuration and documentation | 500,000 | Build, behavior checks, deployment and design documentation. |
| `docs/evidence/` | 750,000 | Selected actual browser screenshots only, if retained. |

Total allocation: 8,250,256 bytes. Unused allocations are not packaging targets. No dependency archives, package caches, submodules or `node_modules/` belong in the submission. Inputs in `.imd/reads/` are provided by the job and are removed before submission.
