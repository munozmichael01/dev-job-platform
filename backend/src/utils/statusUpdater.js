const { pool, sql } = require('../db/db')

/**
 * Actualiza estados automáticamente basado en presupuesto y objetivos alcanzados
 * @param {number} connectionId - ID de la conexión (opcional, para actualizar solo ofertas de esta conexión)
 * @returns {Promise<Object>} - Estadísticas de actualización
 */
async function updateOfferStatusByGoals(connectionId = null) {
  try {
    const stats = {
      goalCompleted: 0,
      budgetCompleted: 0
    }

    let whereClause = 'WHERE StatusId = 1' // Solo ofertas activas
    const params = []
    
    if (connectionId) {
      whereClause += ' AND ConnectionId = @ConnectionId'
      params.push(['ConnectionId', sql.Int, connectionId])
    }

    // 1. Marcar como Objetivo Completado (StatusId = 3)
    const request1 = pool.request()
    params.forEach(([name, type, value]) => request1.input(name, type, value))
    
    const goalResult = await request1.query(`
      UPDATE JobOffers
      SET StatusId = 3, UpdatedAt = GETDATE()
      ${whereClause}
      AND ApplicationsReceived >= ApplicationsGoal
      AND ApplicationsGoal > 0  -- Solo si tiene objetivo definido
    `)
    stats.goalCompleted = goalResult.rowsAffected[0] || 0

    // 2. Marcar como Presupuesto Completado (StatusId = 4)
    const request2 = pool.request()
    params.forEach(([name, type, value]) => request2.input(name, type, value))
    
    const budgetResult = await request2.query(`
      UPDATE JobOffers
      SET StatusId = 4, UpdatedAt = GETDATE()
      ${whereClause}
      AND BudgetSpent >= Budget
      AND Budget > 0  -- Solo si tiene presupuesto definido
    `)
    stats.budgetCompleted = budgetResult.rowsAffected[0] || 0

    if (stats.goalCompleted > 0 || stats.budgetCompleted > 0) {
      console.log(`🎯 Estados automáticos actualizados: ${stats.goalCompleted} objetivos, ${stats.budgetCompleted} presupuestos completados`)
    }

    return stats
  } catch (error) {
    console.error('❌ Error actualizando estados automáticos:', error.message)
    return { goalCompleted: 0, budgetCompleted: 0 }
  }
}

module.exports = { updateOfferStatusByGoals }