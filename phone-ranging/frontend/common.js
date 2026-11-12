/**
 * common.js — small helpers shared by the phone page (index.html), the host
 * page (host.html) and the lab (lab.html).
 *
 *   api()          one fetch wrapper for every server call
 *   esc()          make user-typed text (phone names) safe to put into HTML
 *   fmtM()         format metres as "12.3 cm" / "2.345 m"
 *   drawMap()      draw a solved layout (and optionally the truth) as SVG
 *   resultHtml()   turn a round's result into tables a person can read
 *
 * Nothing in here does any math — detection lives in /backend/signal,
 * and the map solver lives in backend/py.
 */

/**
 * Call the backend API.
 *   method: 'GET' | 'POST' | 'PUT'
 *   path:   e.g. '/api/sessions/abc/join'
 *   body:   any JSON-able object, or undefined
 * Returns the parsed JSON. On an HTTP error, throws an Error whose message is
 * the server's { error } text and whose .status is the HTTP status code
 * (the phone page uses status 409 = "name already taken").
 */
export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error || res.statusText), { status: res.status });
  return json;
}

/**
 * Escape text before inserting it with innerHTML. Phone names are typed by
 * people, so a name like "<img onerror=…>" must show up as text, not run.
 */
export function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** Metres → readable string: mm under 1 cm, cm under 1 m, otherwise metres. */
export function fmtM(m) {
  if (!Number.isFinite(m)) return '–';
  if (Math.abs(m) < 0.01) return `${(m * 1000).toFixed(1)} mm`;
  return Math.abs(m) < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(3)} m`;
}

/**
 * Draw a layout into an <svg class="map"> element.
 *
 * @param {SVGElement} svg
 * @param {object|null} layout   the `layout` object from processRound / solveLayout:
 *                               { phones: [{id,x,y,ellipse}], pairs: [{a,b}], dropped: [{a,b}] }
 * @param {object} [opts]
 * @param {string} [opts.me]               phone id to highlight (the phone viewing the page)
 * @param {Record<string,[number,number]>} [opts.truth]  true positions, already in the
 *                               same frame as the layout (drawn as hollow rings)
 * @param {number} [opts.ellipseZoom]      multiply ellipse size (they can be tiny)
 * @param {string} [opts.message]          shown in the box when there is no layout yet
 *
 * Coordinates: layout is in metres with y pointing UP; SVG has y pointing DOWN.
 * X() and Y() below convert metres → SVG pixels and flip y.
 */
export function drawMap(svg, layout, { me, truth, ellipseZoom = 1, message = 'No map yet' } = {}) {
  if (!layout?.phones?.length) {
    svg.setAttribute('viewBox', '0 0 600 160');
    svg.innerHTML = `<text x="300" y="84" text-anchor="middle" font-size="14" fill="var(--muted)">${esc(message)}</text>`;
    return;
  }
  const W = 600, H = 400;                                  // drawing size in SVG units
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // 1. Work out the bounding box of everything we'll draw, plus a margin.
  const pts = layout.phones.map((p) => [p.x, p.y]).concat(truth ? Object.values(truth) : []);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 0.5;                                         // metres of margin around the phones
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;

  // 2. One scale for both axes, then center the phones in the box.
  //    A long thin layout (two phones on a line) would otherwise sit on the bottom edge.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const k = Math.min(W / spanX, H / spanY);
  const ox = (W - spanX * k) / 2;
  const oy = (H - spanY * k) / 2;
  const X = (x) => ox + (x - minX) * k;
  const Y = (y) => oy + (spanY - (y - minY)) * k;          // flip: bigger y = higher on screen

  const byId = Object.fromEntries(layout.phones.map((p) => [p.id, p]));
  let out = '';

  // 3. 1-metre grid lines, so distances can be eyeballed.
  for (let g = Math.ceil(minX); g <= maxX; g++) out += `<line x1="${X(g)}" y1="0" x2="${X(g)}" y2="${H}" stroke="#222428"/>`;
  for (let g = Math.ceil(minY); g <= maxY; g++) out += `<line x1="0" y1="${Y(g)}" x2="${W}" y2="${Y(g)}" stroke="#222428"/>`;

  // 4. Lines for every measured pair: faint green if used, dashed red if the
  //    solver threw it out as an outlier (likely an echo).
  for (const pr of layout.pairs || []) {
    const a = byId[pr.a], b = byId[pr.b];
    if (!a || !b) continue;
    out += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="var(--ok)" stroke-opacity="0.3"/>`;
  }
  for (const d of layout.dropped || []) {
    const a = byId[d.a], b = byId[d.b];
    if (!a || !b) continue;
    out += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}" stroke="var(--bad)" stroke-width="2" stroke-dasharray="6 4"/>`;
  }

  // 5. Each phone: 95% error ellipse, true position (if known), dot, label.
  for (const p of layout.phones) {
    const e = p.ellipse || { semiMajor: 0, semiMinor: 0, angleRad: 0 };
    const rx = Math.max(e.semiMajor * k * ellipseZoom, 1);
    const ry = Math.max(e.semiMinor * k * ellipseZoom, 1);
    // SVG rotates clockwise because its y axis points down, so negate the angle.
    const deg = (-e.angleRad * 180) / Math.PI;
    out += `<ellipse cx="${X(p.x)}" cy="${Y(p.y)}" rx="${rx}" ry="${ry}" transform="rotate(${deg} ${X(p.x)} ${Y(p.y)})"
      fill="var(--accent)" fill-opacity="0.12" stroke="var(--accent)" stroke-opacity="0.5"/>`;
    if (truth && truth[p.id]) {
      out += `<circle cx="${X(truth[p.id][0])}" cy="${Y(truth[p.id][1])}" r="9" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`;
    }
    out += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="${p.id === me ? 'var(--accent)' : 'var(--text)'}"/>`;
    out += `<text x="${X(p.x) + 9}" y="${Y(p.y) - 9}" font-size="14" font-weight="600" fill="var(--text)">${esc(p.id)}</text>`;
  }
  out += `<text x="8" y="${H - 8}" font-size="12" fill="var(--muted)">grid 1 m · ${esc(layout.phones[0].id)} at origin` +
    `${truth ? ' · ring = true position' : ''}${ellipseZoom !== 1 ? ` · ellipses ×${ellipseZoom}` : ''}</text>`;
  svg.innerHTML = out;
}

/**
 * Human-readable summary of one processed round (the `result` object that
 * backend/processRound.js returns).
 *
 * Sections:
 *   - distances table: one row per pair, ± uncertainty, "dropped" if the solver rejected it
 *   - loop check: how many phone triangles failed the timing loop test (echo hint)
 *   - detections: per phone, how loudly it heard its own beep and everyone else's
 *   - warnings from the solver (no redundancy, not rigid, …)
 */
export function resultHtml(result) {
  if (!result) return '';
  if (result.error) return `<p class="err">Processing failed: ${esc(result.error)}</p>`;

  const dropped = new Set((result.layout?.dropped || []).map((d) => `${d.a}|${d.b}`));
  const rejected = new Map((result.rejected || []).map((r) => [`${r.a}|${r.b}`, r]));
  let html = '';

  // Distances
  html += '<h2>Distances</h2><div class="scroll"><table><tr><th>Pair</th><th>Distance</th><th>± 1σ</th><th></th></tr>';
  for (const d of result.distances) {
    const isDropped = dropped.has(`${d.a}|${d.b}`) || dropped.has(`${d.b}|${d.a}`);
    const rej = rejected.get(`${d.a}|${d.b}`);
    const note = rej
      ? `<span class="err">rejected: ${esc(rej.reason)}${rej.suspects?.length ? ` · suspect ${rej.suspects.map(esc).join(', ')}` : ''}</span>`
      : isDropped ? '<span class="err">dropped</span>' : '';
    html += `<tr><td>${esc(d.a)}–${esc(d.b)}</td><td>${fmtM(d.d)}</td><td>${fmtM(d.sigma)}</td><td>${note}</td></tr>`;
  }
  html += '</table></div>';
  if (result.missing?.length) html += `<p class="err">No distance (a phone didn't hear the other): ${result.missing.map(esc).join(', ')}</p>`;
  if (result.unplaced?.length) html += `<p class="err">Not on the map (no usable pair left): ${result.unplaced.map(esc).join(', ')}</p>`;

  // Loop check (only meaningful with 3+ phones)
  if (result.loops?.triangles.length) {
    const bad = result.loops.badCount;
    html += `<p class="${bad ? 'err' : 'ok'}">Loop check: ${bad} of ${result.loops.triangles.length} triangles inconsistent` +
      `${bad ? ' (likely an echo)' : ''}</p>`;
  }

  // Detections: own-beep loudness is the #1 health check for a phone.
  html += '<h2 style="margin-top:14px">What each phone heard</h2><div class="scroll"><table><tr><th>Phone</th><th>Own beep</th><th>Own-beep check</th><th>Peak level</th><th>Heard</th></tr>';
  for (const [id, det] of Object.entries(result.detections || {})) {
    const heard = Object.entries(det.heard)
      .map(([other, h]) => (h ? `${esc(other)} ${h.snrDb.toFixed(0)} dB` : `<span class="err">${esc(other)} ✗</span>`))
      .join(', ');
    const own = det.ownSnrDb < 25 ? `<span class="err">${det.ownSnrDb.toFixed(0)} dB</span>` : `${det.ownSnrDb.toFixed(0)} dB`;
    const peak = det.maxAbsSample > 0.9 ? `<span class="err">${det.maxAbsSample.toFixed(2)} clip</span>` : det.maxAbsSample.toFixed(2);
    html += `<tr><td>${esc(id)}</td><td>${own}</td><td style="text-align:left">${ownCheckHtml(det)}</td><td>${peak}</td><td style="text-align:left">${heard}</td></tr>`;
  }
  html += '</table></div>';

  // Map status
  if (result.layoutError) html += `<p class="muted">No map: ${esc(result.layoutError)}</p>`;
  for (const w of result.layout?.warnings || []) html += `<p class="err">⚠ ${esc(w)}</p>`;
  return html;
}

/**
 * One phone's own-beep diagnostics as short text (see backend/signal/detectArrivals.js):
 *   margin    own beep vs the next-loudest thing in the recording (dB)
 *   sched     where the own beep was found vs where the phone scheduled it (ms)
 *   gaps      blocks the browser dropped from the mic stream
 *   round #   1 = this phone's first round since joining
 * Problems are red. Older results without these fields show "–".
 */
export function ownCheckHtml(det) {
  const o = det.own;
  if (!o) return '–';
  const bad = (text, isBad) => (isBad ? `<span class="err">${text}</span>` : text);
  const parts = [bad(`margin ${Number.isFinite(o.marginDb) ? o.marginDb.toFixed(0) : '∞'} dB`, o.ambiguous)];
  if (o.scheduleOffsetS !== null && o.scheduleOffsetS !== undefined) {
    parts.push(bad(`sched ${(o.scheduleOffsetS * 1000).toFixed(0)} ms${o.wrongSlot ? ' (wrong slot)' : ''}`, o.wrongSlot));
  }
  if (det.droppedBlocks?.length) parts.push(bad(`${det.droppedBlocks.length} mic gap(s)`, true));
  const m = det.micSettings;
  if (m) {
    const on = ['echoCancellation', 'noiseSuppression', 'autoGainControl'].filter((k) => m[k] === true);
    if (on.length) parts.push(bad(`still on: ${on.join(', ')}`, true));
  }
  if (det.roundsTaken) parts.push(`round #${det.roundsTaken}`);
  return parts.join(' · ');
}
