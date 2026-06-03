/**
 * Import Offers Route — Clean MVP
 *
 * POST /api/import/xml/:connectionId
 *   Triggers a full XML import for a connection owned by the authenticated user.
 *   Saves RawJobRecords, upserts JobOffers, archives removed offers.
 *
 * Rules:
 *   - Auth required (JWT)
 *   - User must own the connection (or be superadmin)
 *   - No pool.request() — Supabase only
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');
const XMLImporter = require('../processors/xmlImporter');

router.use(addUserToRequest);
router.use(requireAuth);

// POST /api/import/xml/:connectionId
router.post('/xml/:connectionId', async (req, res) => {
  const connectionId = parseInt(req.params.connectionId);
  if (!connectionId || isNaN(connectionId)) {
    return res.status(400).json({ success: false, error: 'Invalid connectionId' });
  }

  try {
    // Load connection — verify ownership
    let query = supabase
      .from('Connections')
      .select('id, name, url, FeedUrl, Endpoint, type, UserId, status')
      .eq('id', connectionId)
      .limit(1);

    if (!isSuperAdmin(req)) {
      query = query.eq('UserId', req.userId);
    }

    const { data: connections, error: connErr } = await query;
    if (connErr) throw connErr;
    if (!connections || connections.length === 0) {
      return res.status(404).json({ success: false, error: 'Connection not found or access denied' });
    }

    const conn = connections[0];
    const feedUrl = conn.FeedUrl || conn.url || conn.Endpoint;

    if (!feedUrl) {
      return res.status(400).json({ success: false, error: 'Connection has no feed URL configured' });
    }

    const connType = (conn.type || '').toUpperCase();
    if (connType !== 'XML' && connType !== 'XMLFEED') {
      return res.status(400).json({
        success: false,
        error: `Connection type is "${conn.type}" — this endpoint handles XML only`,
      });
    }

    console.log(`🚀 Starting XML import: connection ${connectionId} ("${conn.name}") for user ${req.userId}`);

    // Mark connection as importing
    await supabase
      .from('Connections')
      .update({ status: 'importing' })
      .eq('id', connectionId);

    // Run import
    const importer = new XMLImporter({
      userId:       conn.UserId || req.userId,
      connectionId: connectionId,
      feedUrl:      feedUrl,
      sourceSystem: `conn-${connectionId}`,
    });

    const stats = await importer.run();

    res.json({
      success: true,
      connectionId,
      connectionName: conn.name,
      stats,
    });

  } catch (error) {
    console.error(`❌ Import error for connection ${connectionId}:`, error.message);

    // Mark connection as error
    await supabase
      .from('Connections')
      .update({ status: 'error' })
      .eq('id', connectionId)
      .catch(() => {});

    res.status(500).json({
      success: false,
      error: 'Import failed',
      details: error.message,
    });
  }
});

// GET /api/import/status/:connectionId
// Returns last import stats from RawJobRecords for this connection
router.get('/status/:connectionId', async (req, res) => {
  const connectionId = parseInt(req.params.connectionId);
  if (!connectionId) return res.status(400).json({ success: false, error: 'Invalid connectionId' });

  try {
    const [rawStats, offerStats] = await Promise.all([
      supabase
        .from('RawJobRecords')
        .select('ProcessingStatus', { count: 'exact' })
        .eq('ConnectionId', connectionId),
      supabase
        .from('JobOffers')
        .select('Status', { count: 'exact' })
        .eq('ConnectionId', connectionId),
    ]);

    const rawByStatus = {};
    for (const r of rawStats.data || []) {
      rawByStatus[r.ProcessingStatus] = (rawByStatus[r.ProcessingStatus] || 0) + 1;
    }

    const offerByStatus = {};
    for (const r of offerStats.data || []) {
      offerByStatus[r.Status] = (offerByStatus[r.Status] || 0) + 1;
    }

    res.json({
      success: true,
      connectionId,
      rawRecords: rawByStatus,
      offers: offerByStatus,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
