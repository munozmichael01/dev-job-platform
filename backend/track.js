// Endpoint /track para modelo CPC
const express = require('express');
const { pool, poolConnect, sql } = require('./src/db/db');
const app = express();

// Redireccionamiento de ofertas con tracking de clics
app.get('/track', async (req, res) => {
  const offerId = parseInt(req.query.offer);
  const channel = req.query.channel;

  if (!offerId || !channel) {
    return res.status(400).send('Missing offer or channel parameter');
  }

  await poolConnect;
  try {
    // Obtener datos de campaña para esta oferta y canal
    const { recordset } = await pool.request()
      .input('OfferId', sql.Int, offerId)
      .input('Channel', sql.NVarChar(100), channel)
      .query(`
        SELECT GoalType, GoalValue, Clicks, ExternalUrl, Status
        FROM OfferTracking
        WHERE OfferId = @OfferId AND Channel = @Channel
      `);

    const tracking = recordset[0];

    if (!tracking) return res.status(404).send('Campaign not found');
    if (tracking.Status === 'completed') return res.redirect('/closed');

    // Insertar clic
    await pool.request()
      .input('OfferId', sql.Int, offerId)
      .input('Channel', sql.NVarChar(100), channel)
      .input('Timestamp', sql.DateTime, new Date())
      .query(`
        INSERT INTO ClickLogs (OfferId, Channel, Timestamp)
        VALUES (@OfferId, @Channel, @Timestamp);
      `);

    // Actualizar contador de clics
    await pool.request()
      .input('OfferId', sql.Int, offerId)
      .input('Channel', sql.NVarChar(100), channel)
      .query(`
        UPDATE OfferTracking
        SET Clicks = Clicks + 1
        WHERE OfferId = @OfferId AND Channel = @Channel;
      `);

    // Verificar si se alcanzó el objetivo
    if (tracking.GoalType === 'CPC' && tracking.Clicks + 1 >= tracking.GoalValue) {
      await pool.request()
        .input('OfferId', sql.Int, offerId)
        .input('Channel', sql.NVarChar(100), channel)
        .query(`
          UPDATE OfferTracking
          SET Status = 'completed'
          WHERE OfferId = @OfferId AND Channel = @Channel;
        `);
    }

    return res.redirect(tracking.ExternalUrl);
  } catch (err) {
    console.error('Tracking error:', err);
    return res.status(500).send('Internal error');
  }
});

module.exports = app;