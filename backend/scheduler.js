const cron = require('node-cron');
const { pool, sql } = require('./src/db/db');
const axios = require('axios');

// Ejecutar cada hora
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Ejecutando scheduler de conexiones...');
  try {
    const result = await pool.request().query('SELECT * FROM Connections');
    const now = new Date();

    for (const conn of result.recordset) {
      if (conn.frequency === 'manual') continue;
      if (!conn.status || conn.status === 'error') continue;

      let shouldSync = false;
      const lastSync = conn.lastSync ? new Date(conn.lastSync) : null;
      if (conn.frequency === 'hourly' && (!lastSync || (now - lastSync) / 1000 / 60 >= 60)) shouldSync = true;
      if (conn.frequency === 'daily' && (!lastSync || (now - lastSync) / 1000 / 60 / 60 >= 24)) shouldSync = true;
      if (conn.frequency === 'weekly' && (!lastSync || (now - lastSync) / 1000 / 60 / 60 / 24 >= 7)) shouldSync = true;

      if (shouldSync) {
        try {
          console.log(`🔄 Lanzando importación automática para conexión ${conn.id} (${conn.name})`);
          await axios.post(`http://localhost:3000/api/connections/${conn.id}/import`);
        } catch (err) {
          console.error(`❌ Error al importar conexión ${conn.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error en el scheduler:', err.message);
  }
}); 