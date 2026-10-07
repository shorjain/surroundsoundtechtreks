import { useEffect, useState } from 'react';
import { checkHealth } from './services/api.js';

export default function App() {
  const [status, setStatus] = useState('Checking API…');
  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal)
      .then(() => setStatus('API connected'))
      .catch(error => { if (error.name !== 'AbortError') setStatus('API unavailable — start the backend'); });
    return () => controller.abort();
  }, []);
  return (
    <main>
      <p className="eyebrow">SurroundSound · project starter</p>
      <h1>One room. Many phones. Shared sound.</h1>
      <p>Turn a group of devices into a synchronized speaker system.</p>
      <p role="status">{status}</p>
      <section><h2>What we’re building next</h2>
        <ul><li>Create and join rooms with a code</li><li>Upload MP3s and share playback controls</li>
        <li>Place devices on a draggable room map</li><li>Measure and improve playback synchronization</li></ul>
      </section>
      <p>This starter checks the API connection. Room joining and audio playback are not implemented yet.</p>
    </main>
  );
}
