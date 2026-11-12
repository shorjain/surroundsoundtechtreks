/**
 * server.js — run with:  node backend/server.js   (Node 18+, no npm install needed)
 *
 * Thin wrapper: Node's http module → app.handle(). Also:
 *   - serves ../frontend (the phone page, the solver lab) as static files
 *   - writes every recording to data/<session>/round<N>/<phone>.wav + .json
 *     and every result to data/<session>/round<N>/result.json
 *
 * Phones need HTTPS (or localhost) to use the microphone. For testing on real
 * phones on the same Wi-Fi, run a tunnel such as `npx localtunnel --port 8080`
 * or put the server behind any HTTPS reverse proxy.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server/app.js';
import { encodeWavFloat32 } from './server/wav.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const STATIC_DIR = ROOT; // serves /frontend/*, /backend/* (the lab imports backend modules), /tests/*
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 8080;

// ── Disk storage: the dataset for later analysis / ML ─────────────────────
const storage = {
  saveRecording(sid, round, phoneId, samples, sampleRate, meta) {
    const dir = path.join(DATA_DIR, sid, `round${round}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${phoneId}.wav`), encodeWavFloat32(samples, sampleRate));
    fs.writeFileSync(path.join(dir, `${phoneId}.json`), JSON.stringify({ sampleRate, ...meta }, null, 2));
  },
  saveRound(sid, round, data) {
    const dir = path.join(DATA_DIR, sid, `round${round}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(data, null, 2));
  },
};

const app = createApp({ storage });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.resolve(STATIC_DIR, '.' + (urlPath === '/' ? '/frontend/index.html' : urlPath));
  // Refuse anything outside the project folder, and the raw data folder.
  if (!file.startsWith(STATIC_DIR + path.sep) || file.startsWith(DATA_DIR + path.sep) ||!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    if (!req.url.startsWith('/api/')) return serveStatic(req, res);

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 50e6) req.destroy(); // 50 MB cap: ~4 min of float32 audio
    });
    req.on('end', () => {
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"invalid JSON"}');
        return;
      }
      const { status, json } = app.handle(req.method, new URL(req.url, 'http://x').pathname, body);
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json));
    });
  })
  .listen(PORT, () => console.log(`phone-ranging server on http://localhost:${PORT}`));
