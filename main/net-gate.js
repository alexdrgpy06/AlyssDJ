'use strict';
// Modo local: si el ajuste `localMode` está activo, la app no hace ninguna petición de red. Todo punto que sale a internet
// pregunta aquí (búsqueda online, sesión de YouTube Music, actualizaciones, descarga de herramientas y modelos, yt-dlp).
const MESSAGE = 'Modo local: sin red';

function createGate(settings) {
  const offline = () => !!settings.get().localMode;
  return {
    offline,
    message: MESSAGE,
    // Falla con el mensaje estándar si el modo local está activo.
    assert() { if (offline()) throw Object.assign(new Error(MESSAGE), { code: 'local' }); },
    // Envuelve un manejador de red: en modo local ni se llama.
    wrap(fn) { return (...a) => { if (offline()) throw Object.assign(new Error(MESSAGE), { code: 'local' }); return fn(...a); }; },
    // ¿Se permite esta URL? En modo local solo lo que no sale del equipo.
    allowUrl(url) {
      if (!offline()) return true;
      try {
        const u = new URL(url);
        return !/^(https?|wss?|ftp):$/.test(u.protocol) || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
      } catch { return true; }
    },
  };
}

module.exports = { createGate, MESSAGE };
