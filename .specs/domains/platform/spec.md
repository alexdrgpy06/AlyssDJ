---
domain: platform
paths: [main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
last_change: 2026-11-03-stems-gpu-automaticos
---
# platform · spec

## soporte multiplataforma

WHEN se detectan navegadores THE SYSTEM SHALL usar las rutas de perfil de la plataforma actual (Linux, Windows, macOS).
WHEN se hace push o pull request THE SYSTEM SHALL ejecutar en CI las pruebas rápidas y el arranque de la app en ubuntu, windows y macos.

## Modelo bajo demanda y disponibilidad

WHEN el modelo no está en el equipo THE SYSTEM SHALL pedir permiso con nombre, origen y tamaño antes de descargarlo, verificar su SHA-256 y descartarlo si no coincide; el instalador no lo incluye.
IF la plataforma no tiene binario de onnxruntime-node (macOS con Intel) THEN THE SYSTEM SHALL deshabilitar Stems con un aviso claro.
IF la separación falla THEN THE SYSTEM SHALL decir la causa en una frase y dejar la pista completa funcionando.

## Descarga del modelo de GPU con permiso

WHEN hace falta el modelo de GPU THE SYSTEM SHALL pedir permiso mostrando nombre, origen, tamaño y licencia, descargarlo a un archivo parcial, verificar su SHA-256 y descartarlo si no coincide; IF el usuario no lo autoriza THEN THE SYSTEM SHALL seguir en CPU sin volver a preguntar en esa sesión.
