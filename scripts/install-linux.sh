#!/usr/bin/env bash
# Instala AlyssDJ como app para tu usuario en Linux (sin sudo): el AppImage del último release en ~/.local/opt/AlyssDJ,
# una entrada en el menú de aplicaciones con su icono y el comando `alyssdj`. La app se actualiza sola desde ahí.
#
#   bash scripts/install-linux.sh                 # descarga el último release de GitHub
#   bash scripts/install-linux.sh --build         # (desde un clon) construye el AppImage en vez de descargarlo
#   bash scripts/install-linux.sh --from-file X   # instala un AppImage que ya tienes
#   bash scripts/install-linux.sh --from-dir D    # busca el .AppImage más nuevo en D
# Variables: ALYSSDJ_OPT (destino), ALYSSDJ_API (API de GitHub), ALYSSDJ_BUILD_CMD (comando de construcción).
set -euo pipefail

REPO="alexdrgpy06/AlyssDJ"
API="${ALYSSDJ_API:-https://api.github.com}"
OPT="${ALYSSDJ_OPT:-$HOME/.local/opt/AlyssDJ}"
BIN="$HOME/.local/bin"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS="$DATA/applications"
ICONS="$DATA/icons/hicolor/512x512/apps"
BUILD_CMD="${ALYSSDJ_BUILD_CMD:-npm run dist:linux}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLONE=""; [ -f "$HERE/../package.json" ] && grep -q '"name": "alyssdj"' "$HERE/../package.json" && CLONE="$(cd "$HERE/.." && pwd)"

FROM_FILE=""; FROM_DIR=""; BUILD=0; TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from-file) FROM_FILE="$2"; shift 2 ;;
    --from-dir) FROM_DIR="$2"; shift 2 ;;
    --build) BUILD=1; shift ;;
    --version) TAG="$2"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

say() { printf '[AlyssDJ] %s\n' "$*"; }
die() { printf '[AlyssDJ] %s\n' "$*" >&2; exit 1; }
newest() { ls -t "$1"/*.AppImage 2>/dev/null | head -n1 || true; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
APPIMAGE=""

if [ -n "$FROM_FILE" ]; then
  [ -f "$FROM_FILE" ] || die "No existe $FROM_FILE"
  APPIMAGE="$FROM_FILE"
elif [ -n "$FROM_DIR" ]; then
  APPIMAGE="$(newest "$FROM_DIR")"; [ -n "$APPIMAGE" ] || die "No hay ningún .AppImage en $FROM_DIR"
elif [ "$BUILD" = 1 ]; then
  [ -n "$CLONE" ] || die "--build solo funciona desde un clon del repositorio."
  say "Construyendo el AppImage ($BUILD_CMD)…"
  (cd "$CLONE" && bash -c "$BUILD_CMD") >&2
  APPIMAGE="$(newest "$CLONE/dist")"; [ -n "$APPIMAGE" ] || die "La construcción no produjo ningún .AppImage."
else
  URL=""
  if [ -n "$TAG" ]; then ENDPOINT="$API/repos/$REPO/releases/tags/$TAG"; else ENDPOINT="$API/repos/$REPO/releases/latest"; fi
  say "Buscando el release en GitHub…"
  if JSON="$(curl -fsSL --max-time 30 -H 'Accept: application/vnd.github+json' "$ENDPOINT" 2>/dev/null)"; then
    URL="$(printf '%s' "$JSON" | grep -o '"browser_download_url": *"[^"]*\.AppImage"' | head -n1 | sed 's/.*"\(http[^"]*\)"/\1/')"
  fi
  if [ -n "$URL" ]; then
    say "Descargando $(basename "$URL")…"
    curl -fL --progress-bar --max-time 900 -o "$TMP/AlyssDJ.AppImage" "$URL" || die "No se pudo descargar el AppImage."
    APPIMAGE="$TMP/AlyssDJ.AppImage"
  elif [ -n "$CLONE" ]; then
    say "No hay un release con AppImage (o no hay conexión): construyo desde este clon ($BUILD_CMD)…"
    (cd "$CLONE" && bash -c "$BUILD_CMD") >&2
    APPIMAGE="$(newest "$CLONE/dist")"; [ -n "$APPIMAGE" ] || die "La construcción no produjo ningún .AppImage."
  else
    die "No encontré un release con AppImage en github.com/$REPO ni hay conexión. Descarga el .AppImage a mano y usa: bash install-linux.sh --from-file RUTA"
  fi
fi

say "Instalando en $OPT…"
mkdir -p "$OPT" "$BIN" "$APPS" "$ICONS"
install -m 755 "$APPIMAGE" "$OPT/AlyssDJ.AppImage.new"
mv -f "$OPT/AlyssDJ.AppImage.new" "$OPT/AlyssDJ.AppImage"   # reemplaza sin dejar la app a medias

# Icono: el del clon, o el del repositorio público; si no hay, la entrada queda sin icono propio.
if [ -n "$CLONE" ] && [ -f "$CLONE/build/icon.png" ]; then cp -f "$CLONE/build/icon.png" "$ICONS/alyssdj.png"
elif curl -fsSL --max-time 20 -o "$TMP/icon.png" "https://raw.githubusercontent.com/$REPO/main/build/icon.png" 2>/dev/null; then cp -f "$TMP/icon.png" "$ICONS/alyssdj.png"
else say "No pude obtener el icono; la entrada del menú no lo tendrá."; fi

# Comando `alyssdj`: sin FUSE el AppImage se ejecuta extrayéndose.
cat > "$BIN/alyssdj" <<WRAP
#!/usr/bin/env bash
# Lanzador de AlyssDJ (instalado por install-linux.sh)
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then export APPIMAGE_EXTRACT_AND_RUN=1; fi
exec "$OPT/AlyssDJ.AppImage" "\$@"
WRAP
chmod 755 "$BIN/alyssdj"

cat > "$APPS/alyssdj.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=AlyssDJ
GenericName=DJ de dos decks
Comment=DJ de dos decks con YouTube Music Premium y música local — un software de AlystechPY, por Alejandro Ramírez
Exec=$BIN/alyssdj %U
Icon=alyssdj
Terminal=false
Categories=AudioVideo;Audio;Player;
Keywords=DJ;mix;music;YouTube;
StartupWMClass=AlyssDJ
DESK

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true
command -v desktop-file-validate >/dev/null 2>&1 && ! desktop-file-validate "$APPS/alyssdj.desktop" && say "Aviso: el archivo .desktop tiene advertencias." || true

case ":$PATH:" in *":$BIN:"*) ;; *) say "Añade $BIN a tu PATH para usar el comando \`alyssdj\`." ;; esac
say "Listo. Búscala como «AlyssDJ» en el menú de aplicaciones, o ejecuta: alyssdj"
say "Se actualiza sola cuando haya una versión nueva (con tu permiso). Para quitarla: bash scripts/uninstall-linux.sh"
