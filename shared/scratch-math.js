// Núcleo del scratch: lee un buffer estéreo con posición fraccionaria y velocidad variable (negativa incluida), con
// interpolación lineal y la velocidad suavizada para que no haya clics. Sin DOM ni audio: lo usan el worklet y las pruebas.
export const SLEW_S = 0.008; // constante de tiempo con la que la velocidad real sigue a la pedida

export function makeState(sampleRate) {
  return { pos: 0, vel: 0, target: 0, a: 1 - Math.exp(-1 / (SLEW_S * sampleRate)), sampleRate };
}

// buf: { L, R: Float32Array }. Escribe n muestras en outL/outR y avanza el estado. Fuera del buffer devuelve silencio
// y deja la posición en el borde (la velocidad se anula para que no se acumule).
export function render(buf, st, outL, outR, n) {
  const len = buf?.L?.length || 0;
  for (let i = 0; i < n; i++) {
    st.vel += (st.target - st.vel) * st.a;
    if (Math.abs(st.vel - st.target) < 1e-7) st.vel = st.target;
    const p = st.pos;
    if (!len || p < 0 || p > len - 1) {
      outL[i] = 0;
      outR[i] = 0;
      st.pos = Math.max(0, Math.min(len - 1, p));
      if ((p < 0 && st.vel < 0) || (p > len - 1 && st.vel > 0)) {
        st.vel = 0;
        st.target = 0;
      }
      continue;
    }
    const k = Math.floor(p);
    const f = p - k;
    const k2 = k + 1 < len ? k + 1 : k;
    outL[i] = buf.L[k] + (buf.L[k2] - buf.L[k]) * f;
    outR[i] = buf.R[k] + (buf.R[k2] - buf.R[k]) * f;
    st.pos = p + st.vel;
  }
  return st;
}

// Velocidad de la pista (muestras por muestra) a partir del giro del plato: 33⅓ rpm ⇒ 1,8 s de pista por vuelta.
export const SECONDS_PER_TURN = 1.8;
export function velFromDrag(deg, dtSeconds) {
  if (!(dtSeconds > 0)) return 0;
  const trackSeconds = (deg / 360) * SECONDS_PER_TURN;
  return Math.max(-8, Math.min(8, trackSeconds / dtSeconds));
}

// Memoria de un buffer decodificado (dos canales Float32) en MiB.
export const bufferMiB = (seconds, sampleRate = 44100) => (seconds * sampleRate * 2 * 4) / 1048576;
