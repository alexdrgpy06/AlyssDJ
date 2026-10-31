---
change: 2026-10-30-soporte-windows
type: feature
domains: [install, platform]
paths: [main/main.js, main/tools.js, main/auth-import.js, scripts/setup.js, package.json, .github/**, docs/**, README.md, scripts/test-*.js]
commits: [e576bd9]
status: approved
rev: 1
approved_rev: 1
approved_hash: 6ff8c122cd02bc406f64290beef3987c96cac521b09216aa91762ff6610d9603
approved_by: Alejandro Ramirez
approved_at: 2026-10-30
---
# Requirements · 2026-10-30-soporte-windows

## Contexto
AlyssDJ solo se ha probado en Linux. En Windows faltan: ffmpeg (el paquete `ffmpeg-static` no descarga su binario con npm 12), detección de navegadores para importar la sesión, una guía de instalación y comprobación automática. El repo pasa a ser público.

## Requisitos

### REQ-1: ffmpeg se instala solo
WHEN no hay ffmpeg utilizable (sistema, configurado o en `bin/`) THE SYSTEM SHALL descargar un ffmpeg estático para la plataforma (win32 x64, linux x64/arm64, darwin x64/arm64) a `bin/` durante `npm install` y al arrancar.
IF la descarga falla THEN THE SYSTEM SHALL mostrar el comando de instalación manual de esa plataforma (winget en Windows) sin impedir que la app abra.

### REQ-2: Detección de navegadores en Windows y macOS
WHEN se busca el perfil de un navegador THE SYSTEM SHALL probar también las rutas de Windows (`AppData\Local`, `AppData\Roaming`) y de macOS (`Library/Application Support`).

### REQ-3: Sin supuestos de Linux en el arranque
WHILE la app corre en Windows THE SYSTEM SHALL localizar yt-dlp y ffmpeg con `.exe`, rutas con `os.homedir()` y separador de la plataforma.
WHEN el usuario pulsa REC fuera de Linux THE SYSTEM SHALL avisar con un mensaje claro de que la grabación aún no existe en esa plataforma.

### REQ-4: Guía de instalación honesta
THE SYSTEM SHALL incluir una guía de instalación para Windows, macOS y Linux que indique para cada sistema qué está verificado por CI y qué no.

### REQ-5: Comprobación automática en tres sistemas
WHEN se hace push o pull request THE SYSTEM SHALL ejecutar en GitHub Actions (ubuntu, windows, macos) la instalación, las pruebas rápidas y un arranque de la app con el hook de autoprueba.

### REQ-6: Repo público
WHEN el repositorio se publique THE SYSTEM SHALL no contener cookies, tokens ni rutas personales, y tener licencia MIT.

## Fuera de alcance
Instaladores (.exe/.dmg), firma de código, grabación de la mezcla en Windows/macOS, y probar con audio real en Windows (el CI no tiene tarjeta de sonido).
