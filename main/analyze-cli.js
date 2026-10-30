// Uso: npm run analyze -- <archivo de audio>   (prueba el análisis sin abrir la app)
'use strict';
const { decode } = require('./decode');
const { analyze, ANALYSIS_SR } = require('../shared/analysis');

(async () => {
  const file = process.argv[2];
  if (!file) return console.error('uso: npm run analyze -- <archivo>');
  const t0 = Date.now();
  const samples = await decode(file, ANALYSIS_SR);
  const r = analyze(samples, ANALYSIS_SR);
  const { waveform, ...rest } = r;
  console.log(JSON.stringify({ ...rest, waveformBins: Buffer.from(waveform.low, 'base64').length, ms: Date.now() - t0 }, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
