---
domain: platform
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-10-30-soporte-windows
---
# platform · design

## CI y límites

`.github/workflows/ci.yml` (matriz de tres sistemas, `shell: bash`); la grabación de la mezcla sigue solo en Linux y las pruebas con stubs de shell se omiten en Windows.
