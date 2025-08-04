const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
console.log("API_URL:", API_URL);
console.log("Environment NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL);

export async function fetchConnections() {
  const res = await fetch(`${API_URL}/api/connections`);
  if (!res.ok) throw new Error('Error al obtener conexiones');
  return res.json();
}

export async function createConnection(data: any) {
  const res = await fetch(`${API_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear conexión');
  return res.json();
}

export async function importConnection(connectionId: number) {
  const res = await fetch(`${API_URL}/api/connections/${connectionId}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error al importar conexión');
  return res.json();
} 