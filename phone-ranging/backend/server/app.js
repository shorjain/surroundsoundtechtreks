/**
 * app.js — the ping-session API as a PURE function: (method, path, body) → (status, json).
 *
 * No sockets or files in here — server.js wraps it in Node's http module, and
 * the tests call it directly. That keeps the logic easy to read and to test.
 *
 * ─── HOW A ROUND WORKS ───────────────────────────────────────────────────
 *
 *   1. Someone creates a session              POST /api/sessions
 *   2. Each phone joins and gets a slot       POST /api/sessions/:sid/join
 *   3. Phones sync their clock (roughly)      GET  /api/time   (NTP-style, ±10s of ms is fine)
 *   4. Someone presses Start                  POST /api/sessions/:sid/rounds
 *        → server picks startAt = now + 3 s and publishes the schedule
 *   5. Each phone polls the session, sees the round, and at startAt:
 *        starts recording, plays its chirp at startAt + leadIn + slot·slotSeconds,
 *        stops recording at startAt + recordSeconds
 *   6. Each phone uploads its raw audio        POST /api/sessions/:sid/rounds/:r/upload
 *   7. When all uploads are in, the server runs processRound()
 *   8. Anyone fetches the map                  GET  /api/sessions/:sid/rounds/:r
 *
 *   Why the timing can be sloppy: the math cancels both the unknown recording
 *   start (S_i) and the unknown beep time (T_j). The schedule only has to be
 *   good enough that beeps don't overlap and land in the right search window.
 *
 * ─── ALSO ────────────────────────────────────────────────────────────────
 *
 *   POST /api/solve            distances in → map out (no audio; for experiments
 *                              where distances come from somewhere else)
 *   PUT  /api/sessions/:sid/labels   ground-truth / experiment labels attached
 *                              to every later round (room, layout, true positions…)
 */

import { processRound } from '../processRound.js';
import { finishRound, procrustesAlign, solveLayout } from '../pybridge.js';
import { base64ToFloat32 } from './wav.js';
import { BANDS } from '../signal/chirp.js';

const DEFAULT_ROUND = {
  band: '2-6k',
  chirpDuration: 0.01, // 10 ms
  slotSeconds: 0.5, // > search window + room reverb tail, see detectArrivals.js
  leadInS: 0.5, // silence before slot 0 so recording is running
  countdownMs: 3000, // time for every phone to see the schedule
  temperatureC: 20,
};

/**
 * @param {{ storage?: { saveRecording?, saveRound? }, now?: () => number, newId?: () => string }} deps
 *        storage: where raw audio + results go (server.js passes a disk version)
 */
export function createApp({ storage = {}, now = () => Date.now(), newId } = {}) {
  const sessions = new Map();
  let counter = 0;
  const makeId = newId || (() => (++counter).toString(36) + Math.random().toString(36).slice(2, 6));

  // ── helpers ──────────────────────────────────────────────────────────────
  const ok = (json) => ({ status: 200, json });
  const err = (status, message) => ({ status, json: { error: message } });
  const getSession = (sid) => sessions.get(sid);

  const publicSession = (s) => ({
    id: s.id,
    phones: s.phones,
    labels: s.labels,
    rounds: s.rounds.map((r) => ({
      number: r.number,
      status: r.status,
      schedule: r.schedule,
      uploaded: Object.keys(r.recordings),
    })),
  });

  // ── routes ───────────────────────────────────────────────────────────────
  const routes = [
    ['GET', /^\/api\/time$/, () => ok({ serverTime: now() })],

    ['POST', /^\/api\/sessions$/, () => {
      const s = { id: makeId(), phones: [], labels: {}, rounds: [] };
      sessions.set(s.id, s);
      return ok(publicSession(s));
    }],

    ['GET', /^\/api\/sessions\/([^/]+)$/, (_, [sid]) => {
      const s = getSession(sid);
      return s ? ok(publicSession(s)) : err(404, 'no such session');
    }],

    ['POST', /^\/api\/sessions\/([^/]+)\/join$/, (body, [sid]) => {
      const s = getSession(sid);
      if (!s) return err(404, 'no such session');
      const name = String(body?.name || '').trim() || `phone${s.phones.length + 1}`;
      if (s.phones.some((p) => p.id === name)) return err(409, `name "${name}" already taken`);
      const phone = {
        id: name,
        slot: s.phones.length, // join order = beep order
        model: body?.model || 'unknown',
        selfDistance: Number(body?.selfDistance) || 0.12, // speaker→mic, metres; calibrate per model
      };
      s.phones.push(phone);
      return ok({ phone, session: publicSession(s) });
    }],

    ['PUT', /^\/api\/sessions\/([^/]+)\/labels$/, (body, [sid]) => {
      const s = getSession(sid);
      if (!s) return err(404, 'no such session');
      s.labels = { ...body };
      return ok(publicSession(s));
    }],

    ['POST', /^\/api\/sessions\/([^/]+)\/rounds$/, (body, [sid]) => {
      const s = getSession(sid);
      if (!s) return err(404, 'no such session');
      if (s.phones.length < 2) return err(400, 'need at least 2 phones');
      const o = { ...DEFAULT_ROUND, ...(body || {}) };
      const band = BANDS[o.band];
      if (!band) return err(400, `unknown band "${o.band}"; options: ${Object.keys(BANDS).join(', ')}`);
      const lastSlot = s.phones.length - 1;
      const schedule = {
        startAt: now() + o.countdownMs, // server clock, ms
        leadInS: o.leadInS,
        slotSeconds: o.slotSeconds,
        recordSeconds: o.leadInS + (lastSlot + 1) * o.slotSeconds + 0.4,
        chirp: { ...band, duration: o.chirpDuration },
        slots: Object.fromEntries(s.phones.map((p) => [p.id, p.slot])),
      };
      const round = {
        number: s.rounds.length + 1,
        status: 'scheduled',
        schedule,
        temperatureC: o.temperatureC,
        anchors: o.anchors,
        phones: s.phones.map((p) => ({ ...p })), // freeze roster for this round
        recordings: {},
        result: null,
      };
      s.rounds.push(round);
      return ok({ round: { number: round.number, schedule } });
    }],

    ['POST', /^\/api\/sessions\/([^/]+)\/rounds\/(\d+)\/upload$/, (body, [sid, rn]) => {
      const s = getSession(sid);
      const round = s?.rounds[Number(rn) - 1];
      if (!round) return err(404, 'no such round');
      const phone = round.phones.find((p) => p.id === body?.phoneId);
      if (!phone) return err(400, 'phoneId is not part of this round');
      if (!(body.sampleRate > 0) || typeof body.samplesBase64 !== 'string') {
        return err(400, 'need sampleRate and samplesBase64 (little-endian Float32)');
      }
      const samples = base64ToFloat32(body.samplesBase64);
      round.recordings[phone.id] = { samples, sampleRate: body.sampleRate, meta: body.meta || {} };
      storage.saveRecording?.(s.id, round.number, phone.id, samples, body.sampleRate, {
        labels: s.labels,
        phone,
        schedule: round.schedule,
        meta: body.meta || {},
      });

      // Last upload in → crunch.
      if (Object.keys(round.recordings).length === round.phones.length) {
        round.status = 'processing';
        try {
          round.result = processRound({
            phones: round.phones,
            recordings: round.recordings,
            config: {
              chirp: round.schedule.chirp,
              slotSeconds: round.schedule.slotSeconds,
              temperatureC: round.temperatureC,
              anchors: round.anchors,
            },
          });
          round.status = 'done';
        } catch (e) {
          round.status = 'failed';
          round.result = { error: e.message };
        }
        storage.saveRound?.(s.id, round.number, { labels: s.labels, schedule: round.schedule, phones: round.phones, result: round.result });
      } else {
        round.status = 'collecting';
      }
      return ok({ status: round.status, uploaded: Object.keys(round.recordings) });
    }],

    ['GET', /^\/api\/sessions\/([^/]+)\/rounds\/(\d+)$/, (_, [sid, rn]) => {
      const round = getSession(sid)?.rounds[Number(rn) - 1];
      if (!round) return err(404, 'no such round');
      return ok({ number: round.number, status: round.status, schedule: round.schedule, result: round.result });
    }],

    ['POST', /^\/api\/solve$/, (body) => {
      try {
        return ok(solveLayout(body));
      } catch (e) {
        return err(400, e.message);
      }
    }],

    // gaps in → distances, loop check, map. The lab runs detection in the page, then this.
    ['POST', /^\/api\/finish$/, (body) => {
      try {
        return ok(finishRound(body));
      } catch (e) {
        return err(400, e.message);
      }
    }],

    // overlay one point set on another. The host uses it to draw simulated truth in the map's frame.
    ['POST', /^\/api\/procrustes$/, (body) => {
      try {
        return ok(procrustesAlign(body.estimate, body.truth));
      } catch (e) {
        return err(400, e.message);
      }
    }],
  ];

  /** The single entry point. */
  function handle(method, path, body) {
    for (const [m, re, fn] of routes) {
      if (m !== method) continue;
      const match = path.match(re);
      if (match) return fn(body, match.slice(1));
    }
    return err(404, `no route for ${method} ${path}`);
  }

  return { handle, sessions };
}
