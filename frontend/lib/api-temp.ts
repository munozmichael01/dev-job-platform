// Temporary API file with hardcoded URL for debugging
const API_URL = 'http://localhost:3002';

export async function fetchConnections() {
  console.log("🔍 fetchConnections using URL:", API_URL);
  const res = await fetch(`${API_URL}/api/connections`, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Error al obtener conexiones');
  return res.json();
}

export async function createConnection(data: any) {
  console.log("🔍 createConnection using URL:", API_URL, "data:", data);
  const res = await fetch(`${API_URL}/api/connections`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ createConnection error:", res.status, errorText);
    throw new Error('Error al crear conexión');
  }
  return res.json();
}

export async function importConnection(connectionId: number) {
  console.log("🔍 importConnection using URL:", API_URL, "ID:", connectionId);
  const res = await fetch(`${API_URL}/api/connections/${connectionId}/import`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ importConnection error:", res.status, errorText);
    throw new Error('Error al importar conexión');
  }
  return res.json();
}

export async function uploadFile(connectionId: number, file: File) {
  console.log("🔍 uploadFile starting with:", { 
    url: API_URL, 
    connectionId, 
    fileName: file.name, 
    fileSize: file.size, 
    fileType: file.type,
    fileLastModified: new Date(file.lastModified).toISOString()
  });
  
  // Verificar que el archivo tiene contenido
  if (file.size === 0) {
    console.error("❌ File is empty");
    throw new Error("El archivo está vacío");
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  // Debug FormData
  console.log("🔍 FormData entries:");
  for (const [key, value] of formData.entries()) {
    console.log(`  ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
  }
  
  const uploadUrl = `${API_URL}/api/connections/${connectionId}/upload`;
  console.log("🔍 About to send request to:", uploadUrl);
  console.log("🔍 Request headers will be automatically set by browser for FormData");
  
  try {
    console.log("🔍 Sending fetch request...");
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
    
    console.log("🔍 Response received:", { 
      status: res.status, 
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ uploadFile HTTP error:", {
        status: res.status,
        statusText: res.statusText, 
        errorText,
        url: uploadUrl
      });
      throw new Error(`Error al subir archivo: ${res.status} ${errorText}`);
    }
    
    const result = await res.json();
    console.log("✅ uploadFile success:", result);
    return result;
  } catch (error) {
    console.error("❌ uploadFile exception:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: uploadUrl,
      connectionId,
      fileName: file.name
    });
    throw error;
  }
}