/**
 * Import Scheduler — server-driven batch processing
 *
 * Architecture: DB as queue, backend as batch processor, cron as trigger.
 *   - RawJobRecords.ProcessingStatus = 'pending' IS the queue
 *   - Each invocation processes batches within a safe time budget
 *   - Progress is persisted after every batch — any failure is resumable
 *   - No fire-and-forget, no browser dependency
 *
 * Endpoints:
 *   POST /api/import/run-scheduled
 *     Called by Vercel Cron daily. Finds due connections, processes one
 *     batch per connection within the time budget. Returns summary.
 *
 *   POST /api/import/start/:connectionId
 *     Called by the frontend Sync button. Marks connection for import and
 *     processes the first batch. Frontend then polls /import/status.
 *     Does NOT loop — one batch per call, idempotent.
 */

const express = require('express');
const router  = express.Router();
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');

const SAFE_BUDGET_MS = 42000; // 42 seconds — leaves buffer before Vercel's 60s limit
const BATCH_SIZE     = 200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(startMs) {
  return Date.now() - startMs;
}

/** Parse frequency string into milliseconds */
function frequencyToMs(freq) {
  if (!freq) return 24 * 60 * 60 * 1000; // default: daily
  const f = freq.toLowerCase();
  if (f === 'hourly')  return 60 * 60 * 1000;
  if (f === 'daily')   return 24 * 60 * 60 * 1000;
  if (f === 'weekly')  return 7 * 24 * 60 * 60 * 1000;
  if (f.endsWith('m')) return parseInt(f) * 60 * 1000;
  if (f.endsWith('h')) return parseInt(f) * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

/** Process one batch for a connection. Returns { processed, failed, remaining, complete } */
async function processOneBatch(connId, userId, sourceSystem) {
  const XMLImporter = require('../processors/xmlImporter');
  const result = await XMLImporter.processBatch({
    userId, connectionId: connId, sourceSystem, batchSize: BATCH_SIZE,
  });

  const remaining = result.pendingOnly ?? result.remaining ?? 0;
  const complete  = remaining === 0;

  // Update connection importedOffers incrementally
  const { count: linked } = await supabase
    .from('JobOfferSources')
    .select('Id', { count: 'exact', head: true })
    .eq('ConnectionId', connId).eq('StatusInSource', 'active');

  await supabase.from('Connections').update({
    importedOffers: linked || 0,
    lastSync:       new Date().toISOString(),
    ...(complete ? { status: 'active', errorCount: 0 } : { status: 'importing' }),
  }).eq('id', connId);

  // On final batch, run reconciliation (best-effort, non-fatal)
  if (complete) {
    try {
      const { data: recs } = await supabase
        .from('RawJobRecords').select('ExternalId')
        .eq('ConnectionId', connId).eq('ProcessingStatus', 'processed');
      const activeIds = new Set((recs || []).map(r => r.ExternalId).filter(Boolean));
      const imp = new XMLImporter({ userId, connectionId: connId, feedUrl: null, sourceSystem });
      await imp._reconcileMissingOffers(activeIds);
    } catch (e) {
      console.warn(`⚠️ Reconciliation skipped for conn ${connId}: ${e.message}`);
    }
  }

  return { processed: result.processed, failed: result.failed ?? 0, remaining, complete };
}

/** Buffer XML feed into RawJobRecords (Phase 1). Returns pendingCount. */
async function bufferConnection(conn) {
  const feedUrl = conn.url || conn.FeedUrl || conn.Endpoint;
  if (!feedUrl) return 0;

  const XMLImporter = require('../processors/xmlImporter');
  const sourceSystem = XMLImporter.inferSourceSystem(feedUrl);

  await supabase.from('Connections').update({
    status: 'importing', lastSync: new Date().toISOString(),
  }).eq('id', conn.id);

  const result = await XMLImporter.fetchToBuffer(feedUrl, {
    userId: conn.UserId || conn.userId,
    connectionId: conn.id,
  });

  return { pendingCount: result.pendingCount || 0, sourceSystem };
}


// ── POST /api/import/run-scheduled ────────────────────────────────────────────
// Called by Vercel Cron or external scheduler. No user auth — uses internal token.

router.post('/run-scheduled', async (req, res) => {
  // Simple internal token check — not user-facing
  const internalToken = process.env.IMPORT_INTERNAL_TOKEN || 'talentOS-scheduled-2026';
  const provided = req.headers['x-import-token'] || req.body?.token;

  if (provided !== internalToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startMs = Date.now();
  console.log(`🕐 run-scheduled started at ${new Date().toISOString()}`);

  try {
    // 1. Find XML connections that need syncing
    const { data: allConns } = await supabase
      .from('Connections')
      .select('id, name, type, url, FeedUrl, Endpoint, UserId, userId, frequency, status, lastSync')
      .in('type', ['XML', 'xml'])
      .neq('status', 'error');   // skip connections in error — require manual intervention

    const now = Date.now();
    const dueConnections = [];

    for (const conn of (allConns || [])) {
      // Has pending records → always process (catch-up)
      const { count: pending } = await supabase
        .from('RawJobRecords').select('Id', { count: 'exact', head: true })
        .eq('ConnectionId', conn.id).eq('ProcessingStatus', 'pending');

      if ((pending || 0) > 0) {
        dueConnections.push({ ...conn, pendingCount: pending || 0, reason: 'catch-up' });
        continue;
      }

      // Check if frequency has elapsed since lastSync
      if (conn.status === 'importing') continue; // already running (fresh lock)

      const freqMs   = frequencyToMs(conn.frequency);
      const lastSync = conn.lastSync ? new Date(conn.lastSync).getTime() : 0;
      const overdue  = (now - lastSync) >= freqMs;

      if (overdue || !conn.lastSync) {
        dueConnections.push({ ...conn, pendingCount: 0, reason: 'scheduled' });
      }
    }

    console.log(`📋 ${dueConnections.length} connections due for import`);

    const summary = { processed: 0, failed: 0, completed: [], partial: [], skipped: [] };

    for (const conn of dueConnections) {
      if (elapsed(startMs) > SAFE_BUDGET_MS) {
        summary.skipped.push(conn.id);
        console.log(`⏱️ Budget exhausted, skipping conn ${conn.id}`);
        continue;
      }

      const feedUrl = conn.url || conn.FeedUrl || conn.Endpoint;
      if (!feedUrl) { summary.skipped.push(conn.id); continue; }

      const userId     = conn.UserId || conn.userId;
      const XMLImporter = require('../processors/xmlImporter');
      const sourceSystem = XMLImporter.inferSourceSystem(feedUrl);

      try {
        // Buffer if no pending records yet
        if (conn.pendingCount === 0) {
          console.log(`📥 Buffering conn ${conn.id} (${conn.name})`);
          if (elapsed(startMs) > SAFE_BUDGET_MS - 15000) {
            // Not enough budget for a full buffer + at least one batch — defer
            summary.skipped.push(conn.id);
            continue;
          }
          const { pendingCount } = await bufferConnection(conn);
          conn.pendingCount = pendingCount;
          if (pendingCount === 0) { summary.skipped.push(conn.id); continue; }
        }

        // Process one batch
        if (elapsed(startMs) < SAFE_BUDGET_MS) {
          console.log(`⚙️ Processing batch for conn ${conn.id} (${conn.pendingCount} pending)`);
          const r = await processOneBatch(conn.id, userId, sourceSystem);
          summary.processed += r.processed;
          summary.failed    += r.failed;

          if (r.complete) {
            summary.completed.push(conn.id);
          } else {
            summary.partial.push({ id: conn.id, remaining: r.remaining });
          }
        }
      } catch (err) {
        console.error(`❌ Error processing conn ${conn.id}: ${err.message}`);
        await supabase.from('Connections').update({ status: 'error' }).eq('id', conn.id);
        summary.failed++;
      }
    }

    const nextRunNeeded = summary.partial.length > 0 || summary.skipped.length > 0;

    console.log(`✅ run-scheduled done in ${elapsed(startMs)}ms:`, summary);

    return res.json({
      success: true,
      durationMs: elapsed(startMs),
      ...summary,
      nextRunNeeded,
      message: nextRunNeeded
        ? `${summary.partial.length} conexiones con lotes pendientes para la próxima ejecución`
        : 'Todas las conexiones procesadas completamente',
    });

  } catch (err) {
    console.error('❌ run-scheduled error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── POST /api/import/start/:connectionId ──────────────────────────────────────
// Called by frontend Sync button. Processes ONE batch and returns.
// Frontend then polls GET /api/connections/:id/import/status for progress.
// Idempotent — safe to call multiple times (picks up where it left off).

router.post('/start/:connectionId', addUserToRequest, requireAuth, async (req, res) => {
  const connId = parseInt(req.params.connectionId);
  if (!connId) return res.status(400).json({ error: 'Invalid connectionId' });

  try {
    // Verify ownership
    let q = supabase.from('Connections')
      .select('id, name, type, url, FeedUrl, Endpoint, UserId, status, lastSync')
      .eq('id', connId).limit(1);
    if (!isSuperAdmin(req)) q = q.eq('UserId', req.userId);

    const { data: rows } = await q;
    if (!rows?.length) return res.status(404).json({ error: 'Conexión no encontrada' });

    const conn      = rows[0];
    const feedUrl   = conn.url || conn.FeedUrl || conn.Endpoint;
    const userId    = conn.UserId || conn.userId || req.userId;

    if (!feedUrl) return res.status(400).json({ error: 'Conexión sin URL configurada' });

    const XMLImporter  = require('../processors/xmlImporter');
    const sourceSystem = XMLImporter.inferSourceSystem(feedUrl);

    // Check pending records
    const { count: pending } = await supabase
      .from('RawJobRecords').select('Id', { count: 'exact', head: true })
      .eq('ConnectionId', connId).eq('ProcessingStatus', 'pending');

    let phase, result;

    if ((pending || 0) === 0) {
      // Phase 1: buffer
      phase = 'buffer';
      const buf = await bufferConnection(conn);
      result = {
        phase,
        hasMore:   buf.pendingCount > 0,
        remaining: buf.pendingCount,
        processed: 0,
        total:     buf.pendingCount,
        message:   `Feed descargado: ${buf.pendingCount} ofertas en cola`,
      };
    } else {
      // Phase 2: one batch
      phase = 'process';
      const r = await processOneBatch(connId, userId, sourceSystem);
      result = {
        phase,
        hasMore:   !r.complete,
        remaining: r.remaining,
        processed: r.processed,
        failed:    r.failed,
        complete:  r.complete,
        message:   r.complete
          ? `Importación completa`
          : `Lote procesado: ${r.processed} ofertas, ${r.remaining} pendientes`,
      };
    }

    return res.json({ success: true, connectionId: connId, ...result });

  } catch (err) {
    console.error(`❌ import/start ${connId}:`, err.message);
    await supabase.from('Connections').update({ status: 'error' }).eq('id', connId).catch(() => {});
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
