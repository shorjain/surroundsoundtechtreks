export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export async function checkHealth(signal) {
  const response = await fetch(`${API_URL}/api/health`, { signal });
  if (!response.ok) throw new Error('API health check failed');
  return response.json();
}

// fetch + JSON for the room routes; throws the server's error message.
export async function api(path, { method = 'GET', body, hostToken, headers = {} } = {}) {
  if (hostToken) headers['X-Host-Token'] = hostToken;
  if (body !== undefined && !(body instanceof Blob)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}/api${path}`, { method, body, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || response.statusText);
  return data;
}
