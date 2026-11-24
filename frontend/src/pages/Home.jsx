import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Home() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  function handleJoin() {
    navigate(`/join?code=${code}`);
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