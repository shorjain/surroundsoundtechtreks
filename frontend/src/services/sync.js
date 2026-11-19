import { api } from './api';

const clock = () => performance.timeOrigin + performance.now();

// Server clock minus ours, from the shortest of 8 round trips (least room for network delay).
export async function measureClock() {
  let best = { rttMs: Infinity };
  for (let i = 0; i < 8; i++) {
    const sent = clock();
    const { serverTime } = await api('/time');
    const rttMs = clock() - sent;
    if (rttMs < best.rttMs) best = { rttMs, offsetMs: serverTime - (sent + rttMs / 2) };
  }
  return best;
}

// The AudioContext time at which a server-clock moment comes out of the speaker.
export function audioTimeAt(ctx, serverMs, offsetMs) {
  const t = ctx.getOutputTimestamp?.() ?? {};
  const heard = t.performanceTime ? t.contextTime : ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  const serverNow = performance.timeOrigin + (t.performanceTime || performance.now()) + offsetMs;
  return heard + (serverMs - serverNow) / 1000;
}

// Test beat: a 5 ms click every half second for a minute. In sync, all phones sound like one click.
export function clickTrack(ctx) {
  const buffer = ctx.createBuffer(2, ctx.sampleRate * 60, ctx.sampleRate);
  for (const data of [buffer.getChannelData(0), buffer.getChannelData(1)]) {
    for (let i = 0; i < data.length; i++) {
      const t = (i / ctx.sampleRate) % 0.5;
      data[i] = t < 0.005 ? Math.sin(2 * Math.PI * 2000 * t) : 0;
    }
  }
  return buffer;
}
