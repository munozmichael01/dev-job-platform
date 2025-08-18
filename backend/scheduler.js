const cron = require('node-cron');
const { pool, sql } = require('./src/db/db');
const { InternalLimitsController } = require('./src/services/internalLimitsController');
const MetricsSync = require('./src/services/metricsSync');
const axios = require('axios');

// Instancia del controlador de límites internos y sync de métricas
const limitsController = new InternalLimitsController();
const metricsSync = new MetricsSync();

// Inicializar sync automático de métricas al arrancar
console.log('🚀 Iniciando sistema de sync automático de métricas...');
metricsSync.startAutomaticSync().catch(error => {
  console.error('❌ Error iniciando sync automático:', error.message);
});

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

// Ejecutar verificación de límites internos cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('🛡️ Ejecutando verificación de límites internos...');
  try {
    const result = await limitsController.checkAllActiveCampaigns();
    
    if (result.error) {
      console.error('❌ Error en verificación de límites:', result.error);
    } else {
      console.log(`✅ Límites verificados: ${result.successful}/${result.total} campañas`);
      
      // Log de acciones tomadas
      const actionsCount = result.results.filter(r => r.actions && r.actions.length > 0).length;
      if (actionsCount > 0) {
        console.log(`🎯 Acciones automáticas aplicadas en ${actionsCount} campañas`);
      }
    }
    
  } catch (err) {
    console.error('❌ Error en verificación de límites internos:', err.message);
  }
});