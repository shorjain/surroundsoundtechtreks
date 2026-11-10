import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    // Placeholder: we'll connect this to the backend later
    console.log('Login submitted', { email });
  }

  return (
    <div className="login-page">
      <div className="login-column">
        <Link className="login-back" to="/">
          ← Back to join a party
        </Link>

        <div className="login-logo">Roomfull</div>

        <div className="login-heading">
          <div className="login-eyebrow">Admin space</div>
          <h1>Log in to host</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="login-submit" type="submit">
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}