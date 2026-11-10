import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [code, setCode] = useState('');

  function handleJoin() {
    // Placeholder: we'll connect this to the backend later
    console.log('Joining party with code:', code);
  }

  return (
    <div className="home-page">
      <div className="home-column">
        <div className="home-logo">Roomfull</div>

        <div className="home-heading">
          <h1>Join the party</h1>
          <p>Type the party code from your host.</p>
        </div>

        <div className="home-field">
          <label htmlFor="partyCode">Party code</label>
          <input
            id="partyCode"
            placeholder="000 000"
            autoComplete="off"
            value={code}
            onChange={event => setCode(event.target.value)}
          />
        </div>

        <button className="home-join" onClick={handleJoin}>
          Join
        </button>

        <p className="home-host">
          <Link to="/login">Want to be the DJ? Host a party</Link>
        </p>
      </div>
    </div>
  );
}