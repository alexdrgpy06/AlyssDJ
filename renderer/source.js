// Fuente de una pista: archivo (local o copia guardada) o streaming. Función pura: la usan el deck y la librería.
// `forced` ('file' | 'stream' | null) es la elección manual del usuario para el deck actual.
export const ORIGINS = { LOCAL: 'ARCHIVO LOCAL', GUARDADA: 'GUARDADA', STREAM: 'STREAM' };

export function resolveSource({ track, analysis, preferSaved = true, forced = null }) {
  if (!track) return { source: 'stream', origin: 'STREAM', canSwitch: false, why: null, missing: false };
  // Archivo del disco del usuario: no existe otra fuente.
  if (track.local) return { source: 'file', origin: 'LOCAL', canSwitch: false, why: null, missing: false };
  const saved = !!analysis?.saved;
  const cached = !!analysis?.audio; // audio conservado en la caché (no es una copia en la librería)
  if (saved || cached) {
    // Solo la copia guardada se usa sola; el audio de la caché se puede elegir a mano.
    const auto = saved && preferSaved ? 'file' : 'stream';
    return { source: forced === 'file' || forced === 'stream' ? forced : auto, origin: 'GUARDADA', canSwitch: true, why: null, missing: false };
  }
  if (analysis?.savedMissing) {
    return { source: 'stream', origin: 'STREAM', canSwitch: false, why: 'La copia guardada ya no existe; analiza la pista para volver a tenerla', missing: true };
  }
  return { source: 'stream', origin: 'STREAM', canSwitch: false, why: 'Analiza la pista para tener archivo', missing: false };
}

// Texto corto del origen en la fila de la librería.
export const originChip = (info) => (info.origin === 'LOCAL' ? 'ARCHIVO' : info.origin);
