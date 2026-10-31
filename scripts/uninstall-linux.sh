#!/usr/bin/env bash
# Quita lo que instaló install-linux.sh. Conserva tus ajustes y tu librería de música salvo que pidas --purge.
#   bash scripts/uninstall-linux.sh            # quita la app, el menú, el icono y el comando
#   bash scripts/uninstall-linux.sh --purge    # además borra los ajustes (~/.config/AlyssDJ) y pregunta por la librería
set -euo pipefail
OPT="${ALYSSDJ_OPT:-$HOME/.local/opt/AlyssDJ}"
BIN="$HOME/.local/bin"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
CONF="${XDG_CONFIG_HOME:-$HOME/.config}/AlyssDJ"
LIB="${ALYSSDJ_LIBRARY:-$HOME/Música/AlyssDJ}"
PURGE=0; for a in "$@"; do case "$a" in --purge) PURGE=1 ;; -h|--help) sed -n '2,4p' "$0"; exit 0 ;; *) echo "Opción desconocida: $a" >&2; exit 2 ;; esac; done
say() { printf '[AlyssDJ] %s\n' "$*"; }

rm -rf "$OPT"
rm -f "$BIN/alyssdj" "$DATA/applications/alyssdj.desktop" "$DATA/icons/hicolor/512x512/apps/alyssdj.png"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
say "Aplicación quitada."

if [ "$PURGE" = 1 ]; then
  rm -rf "$CONF"; say "Ajustes borrados ($CONF)."
  if [ -d "$LIB" ]; then
    if [ -t 0 ]; then
      read -r -p "¿Borrar también tu librería de música en $LIB? [s/N] " r
      case "$r" in s|S|si|sí|y|Y) rm -rf "$LIB"; say "Librería borrada." ;; *) say "Librería conservada." ;; esac
    else say "Librería conservada ($LIB): para borrarla hazlo a mano."; fi
  fi
else
  say "Tus ajustes ($CONF) y tu librería se conservan. Usa --purge para borrar los ajustes."
fi
