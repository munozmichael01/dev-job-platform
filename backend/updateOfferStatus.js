// updateOfferStatus.js
const { pool, poolConnect, sql } = require('./db');
require('dotenv').config();

// updateOfferStatus.js
async function updateOfferStatus() {
  await poolConnect;
  try {
    // 1. Mark as Completed Goal (StatusId = 3)
    await pool.request()
      .query(`
        UPDATE JobOffers
        SET StatusId = 3  -- Cambiado de 2 a 3
        WHERE ApplicationsReceived >= ApplicationsGoal
        AND StatusId = 1
      `);

    // 2. Mark as Completed Budget (StatusId = 4)
    await pool.request()
      .query(`
        UPDATE JobOffers
        SET StatusId = 4  -- Cambiado de 3 a 4
        WHERE BudgetSpent >= Budget
        AND StatusId = 1
      `);

    console.log('✅ Estados de ofertas actualizados (Completed Goal y Budget).');
  } catch (err) {
    console.error('❌ Error al actualizar estados:', err.message);
  }
}

updateOfferStatus();