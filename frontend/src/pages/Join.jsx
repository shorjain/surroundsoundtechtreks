import { useEffect, useRef, useState } from 'react';
import { api, API_URL } from '../services/api';
import { audioTimeAt, clickTrack, measureClock } from '../services/sync';

// Phone: join with the room code, keep the clock in sync, play what the host schedules.
export default function Join() {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('code') || '');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [joined, setJoined] = useState(false);
  const audio = useRef({}); // { ctx, gain, splitter, source, id, playbackId, clock }

  async function start() {
    const a = audio.current;
    a.ctx = new AudioContext(); // made on the tap, so the browser allows sound
    a.gain = a.ctx.createGain();
    a.splitter = a.ctx.createChannelSplitter(2);
    a.gain.connect(a.ctx.destination);
    a.id = (await api(`/rooms/${code}/devices`, { method: 'POST', body: { name } })).id;
    a.clock = await measureClock();
    setJoined(true);
  }

  useEffect(() => {
    if (!joined) return;
    let pings = 0;
    const loop = setInterval(async () => {
      const a = audio.current;
      if (++pings % 15 === 0) a.clock = await measureClock(); // clocks drift, so re-measure now and then
      const state = await api(`/rooms/${code}/devices/${a.id}/ping`, { method: 'POST', body: a.clock });
      const me = state.devices.find((d) => d.id === a.id);
      await follow(state.playback);
      a.gain.gain.value = me.muted ? 0 : me.volume;
      route(me.channel);
      setStatus(`Clock offset ${a.clock.offsetMs.toFixed(1)} ms (±${(a.clock.rttMs / 2).toFixed(1)}). ` +
        `${state.playback ? 'Playing ' + state.playback.track : 'Stopped'}. Volume ${me.volume}${me.muted ? ' (muted)' : ''}, channel ${me.channel}.`);
    }, 1000);
    return () => clearInterval(loop);
  }, [joined]);

  // Mixer channel: both = stereo as-is; left/right = only that channel, out of every speaker.
  function route(channel) {
    const a = audio.current;
    if (!a.source || a.source.channel === channel) return;
    a.source.disconnect();
    a.splitter.disconnect();
    if (channel === 'both') a.source.connect(a.gain);
    else {
      a.source.connect(a.splitter);
      a.splitter.connect(a.gain, channel === 'left' ? 0 : 1);
    }
    a.source.channel = channel;
  }

  // Start the host's playback at its server time (or mid-track if we're late); stop when it's cleared.
  async function follow(playback) {
    const a = audio.current;
    if (playback?.id === a.playbackId) return;
    a.playbackId = playback?.id;
    a.source?.stop();
    a.source = null;
    if (!playback) return;
    const buffer = playback.track === 'clicks' ? clickTrack(a.ctx)
      : await a.ctx.decodeAudioData(await (await fetch(`${API_URL}/api/rooms/${code}/track`)).arrayBuffer());
    const when = audioTimeAt(a.ctx, playback.startAt, a.clock.offsetMs);
    a.source = a.ctx.createBufferSource();
    a.source.buffer = buffer;
    a.source.start(Math.max(when, a.ctx.currentTime), Math.max(0, a.ctx.currentTime - when));
  }

  if (joined) return <p>Joined room {code} as {name}. {status}</p>;
  return (
    <div>
      <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)} />{' '}
      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />{' '}
      <button onClick={() => start().catch((e) => setStatus(e.message))}>Join and enable sound</button>
      <p>{status}</p>
    </div>
  );
}
