# Instalación en Windows, macOS y Linux

AlyssDJ es una app de Electron: se instala igual en los tres sistemas, con Node.js 22 o más nuevo y Git.
La primera vez descarga sola **yt-dlp** y **ffmpeg** a la carpeta `bin/` del proyecto.

```bash
git clone https://github.com/alexdrgpy06/AlyssDJ.git
cd AlyssDJ
npm install
npm start
```

## Instaladores (sin Node ni Git)

En la página de [Releases](https://github.com/alexdrgpy06/AlyssDJ/releases) se publican, al crear una versión, el **instalador de Windows** (`AlyssDJ-Setup-<versión>.exe`) y la **imagen de macOS** (`AlyssDJ-<versión>-arm64.dmg` para Apple Silicon y `-x64.dmg` para Intel). No hacen falta Node ni Git: la primera vez que se abre, la app descarga sola yt-dlp y ffmpeg a su carpeta de datos.

Los instaladores **no están firmados** (la firma de código cuesta dinero y aún no la tengo), así que el sistema avisa:

- **Windows (SmartScreen):** «Windows protegió su PC» → **Más información** → **Ejecutar de todas formas**.
- **macOS (Gatekeeper):** «no se puede abrir porque no se puede verificar al desarrollador». Arrastra AlyssDJ a Aplicaciones, haz **clic derecho → Abrir → Abrir**; o en la terminal: `xattr -dr com.apple.quarantine /Applications/AlyssDJ.app`.

Cada instalador se construye en GitHub Actions y el mismo flujo comprueba que el paquete arranca, descarga sus herramientas y analiza una pista; lo que no se ha probado es la instalación en sí con un usuario real.

## Qué está verificado

| | Windows 10/11 (x64) | macOS (Intel / Apple Silicon) | Linux |
|---|---|---|---|
| Instalación y descarga de yt-dlp y ffmpeg | CI en GitHub Actions | CI en GitHub Actions | Probado a mano y en CI |
| Paquete de la app (arranca y analiza una pista) | CI | CI | Probado a mano y en CI |
| Instalador `.exe` / `.dmg` instalado por una persona | **Sin verificar** | **Sin verificar** | — |
| Pruebas rápidas (análisis, AutoMix, cola, ajustes) | CI | CI | Probado a mano y en CI |
| La app abre su ventana | CI | CI | Probado a mano y en CI |
| Sonido, decks con YouTube Music, MIDI, segunda pantalla | **Sin verificar** | **Sin verificar** | Probado a mano |
| Importar la sesión desde un navegador | **Sin verificar** (usa Firefox) | **Sin verificar** | Probado a mano |
| Grabar la mezcla (REC) | No disponible | No disponible | Disponible (PulseAudio/PipeWire) |

«CI» significa que el flujo de [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) lo ejecuta en cada cambio, pero esas máquinas no tienen tarjeta de sonido ni cuenta de YouTube. Lo marcado «sin verificar» se escribió pensando en ese sistema y nadie lo ha probado todavía: si falla, abre un issue con lo que ves.

## Windows

1. Instala [Node.js 22 LTS](https://nodejs.org) y [Git](https://git-scm.com) (`winget install OpenJS.NodeJS.LTS Git.Git`).
2. En PowerShell o en la terminal de Windows:
   ```powershell
   git clone https://github.com/alexdrgpy06/AlyssDJ.git
   cd AlyssDJ
   npm install
   npm start
   ```
3. Si el antivirus bloquea `bin\yt-dlp.exe` o `bin\ffmpeg.exe`, permite la carpeta del proyecto.
4. Si prefieres tu propio ffmpeg: `winget install Gyan.FFmpeg`, o indica la ruta en Ajustes.
5. **Iniciar sesión:** el botón de entrar con Google dentro de la app lo bloquea Google. Usa «Importar desde el navegador» con **Firefox**. Chrome, Edge y Brave recientes cifran sus cookies en Windows de una forma que yt-dlp no siempre puede leer.
6. Las carpetas de música locales se eligen en Ajustes; las rutas con letra de unidad (`D:\Música`) funcionan.

## macOS

```bash
brew install node git
git clone https://github.com/alexdrgpy06/AlyssDJ.git && cd AlyssDJ
npm install && npm start
```

La primera ejecución de `bin/yt-dlp` y `bin/ffmpeg` puede pedir confirmación en Ajustes del Sistema → Privacidad y seguridad. Importar la sesión desde Safari no está soportado; usa Firefox, Chrome o Brave.

## Linux

### Como app instalada (recomendado)

```bash
git clone https://github.com/alexdrgpy06/AlyssDJ.git && cd AlyssDJ
bash scripts/install-linux.sh
```

Instala para tu usuario (sin sudo) el AppImage del último release en `~/.local/opt/AlyssDJ`, una entrada **AlyssDJ** en el menú de aplicaciones con su icono y el comando `alyssdj`. Si aún no hay un release con AppImage, construye uno desde el clon (`--build`). Se actualiza sola (con tu permiso). Para quitarla: `bash scripts/uninstall-linux.sh` (conserva tus ajustes y tu librería; `--purge` borra los ajustes).

### Desde el código

```bash
sudo pacman -S nodejs npm git        # Arch / CachyOS
sudo apt install nodejs npm git      # Debian / Ubuntu (Node 22 o más nuevo: usa nodesource o nvm)
git clone https://github.com/alexdrgpy06/AlyssDJ.git && cd AlyssDJ
npm install && npm start
```

Si ya tienes `ffmpeg` o `yt-dlp` en el sistema, los usa. En Wayland el sistema ignora la posición de la ventana de video: elige la pantalla en el selector y usa «Completa».

## Actualizaciones automáticas

La app **instalada** (instalador de Windows, AppImage de Linux) busca versiones nuevas al abrirse y cada 6 horas, consultando solo los releases públicos de GitHub. Si hay una, avisa con el número y las notas, y **tú eliges**: «Descargar e instalar», «Más tarde» u «Omitir esta versión». Nunca descarga sin preguntar y no se reinicia con música sonando (espera a que pares los decks o cierres la app). Se desactiva en Ajustes → «Buscar actualizaciones automáticamente».

En **macOS** la app no está firmada, así que no puede instalarse sola: solo avisa de la versión nueva con un enlace a su página de descarga.

## Si algo falla

- `npm run setup` repite la descarga de herramientas y muestra el error.
- Sin internet o sin acceso a GitHub, descarga a mano `yt-dlp` y `ffmpeg` y ponlos en la carpeta `bin/`.
- Más casos en [Problemas frecuentes](07-problemas-frecuentes.md).
