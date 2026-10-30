'use strict';
const { parentPort, workerData } = require('worker_threads');
const { decode } = require('./decode');
const { analyze, ANALYSIS_SR } = require('../shared/analysis');

(async () => {
  const samples = await decode(workerData.file, ANALYSIS_SR, workerData.ffmpeg || 'ffmpeg');
  parentPort.postMessage({ ok: true, result: analyze(samples, ANALYSIS_SR) });
})().catch((e) => parentPort.postMessage({ ok: false, error: e.message }));
