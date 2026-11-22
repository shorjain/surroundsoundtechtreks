import { useEffect, useState } from 'react';
import { api } from '../services/api';

// Host: make a room, watch devices join, upload a track, play it on every phone, mix per phone.
export default function Host() {
  const [room, setRoom] = useState(null); // { code, hostToken }
  const [state, setState] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!room) return;
    const poll = setInterval(() => api(`/rooms/${room.code}`).then(setState), 1000);
    return () => clearInterval(poll);
  }, [room]);

  const host = (path, options, done = '') =>
    api(`/rooms/${room.code}${path}`, { method: 'POST', hostToken: room.hostToken, ...options })
      .then(() => setMessage(done), (error) => setMessage(error.message));

  const upload = (file) =>
    host(`/track?name=${encodeURIComponent(file.name)}`,
      { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }, `Uploaded ${file.name}`);

  const mix = (device, change) =>
    host(`/devices/${device.id}`, {
      method: 'PATCH',
      body: { volume: device.volume, muted: device.muted, channel: device.channel, ...change },
    });

  if (!room) return <button onClick={() => api('/rooms', { method: 'POST' }).then(setRoom)}>Create room</button>;

  return (
    <div>
      <p>Room code: <b>{room.code}</b> (phones open /join and type it)</p>
      <p>
        <button onClick={() => host('/play', { body: { track: 'clicks' } })}>Play test clicks</button>{' '}
        <button onClick={() => host('/play', { body: { track: 'upload' } })}>Play uploaded track</button>{' '}
        <button onClick={() => host('/stop')}>Stop</button>{' '}
        Upload: <input type="file" accept="audio/*" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
      </p>
      <p>{message}</p>
      <p>Playback: {state?.playback ? `${state.playback.track}, starts ${new Date(state.playback.startAt).toLocaleTimeString()}` : 'stopped'}</p>
      <table border="1" cellPadding="4">
        <thead>
          <tr><th>Device</th><th>Online</th><th>Clock offset</th><th>Sync accuracy</th><th>Volume</th><th>Mute</th><th>Channel</th></tr>
        </thead>
        <tbody>
          {state?.devices.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>{d.online ? 'yes' : 'no'}</td>
              <td>{d.offsetMs?.toFixed(1)} ms</td>
              <td>±{(d.rttMs / 2).toFixed(1)} ms</td>
              <td><input type="range" min="0" max="1" step="0.05" value={d.volume} onChange={(e) => mix(d, { volume: +e.target.value })} /></td>
              <td><input type="checkbox" checked={d.muted} onChange={(e) => mix(d, { muted: e.target.checked })} /></td>
              <td>
                <select value={d.channel} onChange={(e) => mix(d, { channel: e.target.value })}>
                  <option>both</option><option>left</option><option>right</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
