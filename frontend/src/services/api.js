const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export async function checkHealth(signal) {
  const response = await fetch(`${API_URL}/api/health`, { signal });
  if (!response.ok) throw new Error('API health check failed');
  return response.json();
}
