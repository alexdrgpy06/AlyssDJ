// Rueda Camelot: color por clave y compatibilidad armónica entre pistas.
const parse = (c) => {
  const m = /^(\d{1,2})([AB])$/.exec(c || '');
  return m ? { n: Number(m[1]), l: m[2] } : null;
};

export function camelotColor(code) {
  const k = parse(code);
  if (!k) return null;
  return `hsl(${((k.n - 1) * 30 + 170) % 360} ${k.l === 'A' ? 72 : 80}% ${k.l === 'A' ? 58 : 66}%)`;
}

// Misma clave, ±1 en la rueda, o la relativa (mismo número, otra letra).
export function keysCompatible(a, b) {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return false;
  if (x.n === y.n) return true;
  const d = Math.abs(x.n - y.n);
  return x.l === y.l && (d === 1 || d === 11);
}

// BPM dentro de ±tol (también a mitad o doble de tempo).
export function bpmCompatible(a, b, tol = 0.06) {
  if (!a || !b) return false;
  return [1, 0.5, 2].some((f) => Math.abs(a * f - b) / b <= tol);
}
