/**
 * wav.js — save recordings as standard .wav files (32-bit float, mono).
 *
 * Every raw recording is kept: it is the dataset for later ML work, and lets
 * us re-run a better detector on old experiments without re-collecting.
 *
 * WAV layout (44-byte header, little-endian), then the samples:
 *   "RIFF" <file size − 8> "WAVE"
 *   "fmt " 16  format=3 (IEEE float)  channels=1  sampleRate  byteRate  blockAlign=4  bits=32
 *   "data" <data bytes>  samples…
 */

export function encodeWavFloat32(samples, sampleRate) {
  const dataBytes = samples.length * 4;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (off, s) => [...s].forEach((ch, k) => v.setUint8(off + k, ch.charCodeAt(0)));

  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 3, true); // 3 = IEEE float
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true); // byte rate
  v.setUint16(32, 4, true); // block align
  v.setUint16(34, 32, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  for (let k = 0; k < samples.length; k++) v.setFloat32(44 + 4 * k, samples[k], true);
  return new Uint8Array(buf);
}

export function decodeWavFloat32(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = v.getUint32(24, true);
  const n = v.getUint32(40, true) / 4;
  const samples = new Float64Array(n);
  for (let k = 0; k < n; k++) samples[k] = v.getFloat32(44 + 4 * k, true);
  return { samples, sampleRate };
}

/** Phones upload audio as base64 of little-endian Float32 — decode that here. */
export function base64ToFloat32(b64) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return new Float32Array(bytes.buffer);
}

export function float32ToBase64(samples) {
  const bytes = new Uint8Array(Float32Array.from(samples).buffer);
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
