/**
 * Import Scheduler — server-driven batch processing
 *
 * Architecture: DB as queue, backend as batch processor, cron as trigger.
 *   - RawJobRecords.ProcessingStatus = 'pending' IS the persistent queue
 *   - Each invocation processes as many batches as fit in the time budget
 *   - Progress is persisted after every batch — fully resumable
 *   - No fire-and-forget. No browser dependency.
 *
 * Endpoints:
 *   GET  /api/import/run-scheduled     ← Vercel Cron (Authorization: Bearer CRON_SECRET)
 *   POST /api/import/run-scheduled     ← manual trigger (same auth)
 *   POST /api/import/start/:id         ← frontend Sync button (JWT user auth)
 *
 * Auth for cron:
 *   Vercel Cron sends: Authorization: Bearer ${CRON_SECRET}
 *   CRON_SECRET must be set in Vercel environment variables.
 *   No hardcoded fallback — missing CRON_SECRET blocks execution in production.
 */

const express = require('express');
const router  = express.Router();
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');

const SAFE_BUDGET_MS = 42000; // 42s — safe margin before Vercel's 60s function limit
const BATCH_SIZE     = 50;   // 75 was ~29s (too close), 50 targets ~18-20s

// ── Auth middleware for cron endpoint ─────────────────────────────────────────

function verifyCronAuth(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (!cronSecret) {
    if (isProduction) {
      // In production, missing CRON_SECRET is a config error — refuse to run
      res.status(500).json({
        error: 'CRON_SECRET not configured',
        message: 'Set CRON_SECRET in Vercel environment variables before enabling the cron job.'
      });
      return false;
    } else {
      // In local dev, allow without auth but warn loudly
      console.warn('⚠️  CRON_SECRET not set — allowing run-scheduled in non-production environment');
      return true;
    }
  }

  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers['authorization'] || '';
  const provided   = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (provided !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing Authorization header.' });
    return false;
  }

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(startMs) { return Date.now() - startMs; }

function frequencyToMs(freq) {
  if (!freq) return 24 * 60 * 60 * 1000;
  const f = freq.toLowerCase();
  if (f === 'hourly') return 60 * 60 * 1000;
  if (f === 'daily')  return 24 * 60 * 60 * 1000;
  if (f === 'weekly') return 7 * 24 * 60 * 60 * 1000;
  if (f.endsWith('m')) return parseInt(f) * 60 * 1000;
  if (f.endsWith('h')) return parseInt(f) * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

/** Buffer XML feed into RawJobRecords (Phase 1). Returns { pendingCount, sourceSystem }. */
async function bufferConnection(conn) {
  const feedUrl = conn.url || conn.FeedUrl || conn.Endpoint;
  if (!feedUrl) return { pendingCount: 0, sourceSystem: null };

  const XMLImporter  = require('../processors/xmlImporter');
  const sourceSystem = XMLImporter.inferSourceSystem(feedUrl);
  const userId       = conn.UserId || conn.userId;

  await supabase.from('Connections').update({
    status: 'importing', lastSync: new Date().toISOString(),
  }).eq('id', conn.id);

  const result = await XMLImporter.fetchToBuffer(feedUrl, { userId, connectionId: conn.id });
  return { pendingCount: result.pendingCount || 0, sourceSystem };
}

/**
 * Process one batch for a connection.
 * Updates Connections.importedOffers and status after each batch.
 * Runs reconciliation on the final batch (best-effort, non-fatal).
 * Returns { processed, failed, remaining, complete }.
 */
async function processOneBatch(connId, userId, sourceSystem) {
  const XMLImporter = require('../processors/xmlImporter');
  const result = await XMLImporter.processBatch({
    userId, connectionId: connId, sourceSystem, batchSize: BATCH_SIZE,
  });

  const remaining = result.pendingOnly ?? result.remaining ?? 0;
  const complete  = remaining === 0;

  // Count canonical linked offers for this connection
  const sourcesRes = await supabase
    .from('JobOfferSources')
    .select('Id', { count: 'exact', head: true })
    .eq('ConnectionId', connId).eq('StatusInSource', 'active');
  const linked = sourcesRes.error ? 0 : (sourcesRes.count || 0);

  await supabase.from('Connections').update({
    importedOffers: linked,
    lastSync:       new Date().toISOString(),
    ...(complete ? { status: 'active', errorCount: 0 } : { status: 'importing' }),
  }).eq('id', connId);

  // Final batch: reconcile (best-effort, must NOT block status update)
  if (complete) {
    try {
      const { data: recs } = await supabase
        .from('RawJobRecords').select('ExternalId')
        .eq('ConnectionId', connId).eq('ProcessingStatus', 'processed');
      const activeIds = new Set((recs || []).map(r => r.ExternalId).filter(Boolean));
      const imp = new XMLImporter({ userId, connectionId: connId, feedUrl: null, sourceSystem });
      await imp._reconcileMissingOffers(activeIds);
    } catch (e) {
      console.warn(`⚠️  Reconciliation skipped for conn ${connId}: ${e.message}`);
    }
  }

  return { processed: result.processed, failed: result.failed ?? 0, remaining, complete };
}

/**
 * Core scheduler logic — processes all due connections within the time budget.
 * Called by both GET and POST /run-scheduled.
 */
async function runScheduledCore(startMs) {
  // 1. Find due XML connections
  const { data: allConns } = await supabase
    .from('Connections')
    .select('id, name, type, url, FeedUrl, Endpoint, UserId, userId, frequency, status, lastSync')
    .in('type', ['XML', 'xml'])
    .neq('status', 'error');   // connections in 'error' require manual intervention

  const now = Date.now();
  const dueConnections = [];

  for (const conn of (allConns || [])) {
    // Catch-up: has pending records from a previous interrupted run
    const { count: pending } = await supabase
      .from('RawJobRecords').select('Id', { count: 'exact', head: true })
      .eq('ConnectionId', conn.id).eq('ProcessingStatus', 'pending');

    if ((pending || 0) > 0) {
      dueConnections.push({ ...conn, pendingCount: pending, reason: 'catch-up' });
      continue;
    }

    // Skip connections with a fresh lock (another process may be running)
    if (conn.status === 'importing') {
      const lastSyncAge = conn.lastSync ? now - new Date(conn.lastSync).getTime() : Infinity;
      if (lastSyncAge < 10 * 60 * 1000) continue; // < 10 min — respect lock
    }

    // Scheduled: frequency has elapsed
    const freqMs   = frequencyToMs(conn.frequency);
    const lastSync = conn.lastSync ? new Date(conn.lastSync).getTime() : 0;
    if ((now - lastSync) >= freqMs || !conn.lastSync) {
      dueConnections.push({ ...conn, pendingCount: 0, reason: 'scheduled' });
    }
  }

  console.log(`📋 run-scheduled: ${dueConnections.length} connections due`);

  const summary = { processed: 0, failed: 0, completed: [], partial: [], skipped: [] };

  for (const conn of dueConnections) {
    if (elapsed(startMs) > SAFE_BUDGET_MS) {
      summary.skipped.push(conn.id);
      console.log(`⏱️  Budget exhausted — deferring conn ${conn.id}`);
      continue;
    }

    const feedUrl = conn.url || conn.FeedUrl || conn.Endpoint;
    if (!feedUrl) { summary.skipped.push(conn.id); continue; }

    const userId       = conn.UserId || conn.userId;
    const XMLImporter  = require('../processors/xmlImporter');
    const sourceSystem = XMLImporter.inferSourceSystem(feedUrl);

    try {
      // Phase 1: buffer if no pending records yet
      if (conn.pendingCount === 0) {
        if (elapsed(startMs) > SAFE_BUDGET_MS - 15000) {
          // Not enough budget to buffer + at least one batch safely
          summary.skipped.push(conn.id);
          continue;
        }
        console.log(`📥 Buffering conn ${conn.id} (${conn.name})`);
        const buf = await bufferConnection(conn);
        conn.pendingCount = buf.pendingCount;
        if (conn.pendingCount === 0) { summary.skipped.push(conn.id); continue; }
      }

      // Phase 2+: process as many batches as fit in the remaining budget
      let batchesRun = 0;
      while (conn.pendingCount > 0 && elapsed(startMs) < SAFE_BUDGET_MS) {
        console.log(`⚙️  Batch ${batchesRun + 1} for conn ${conn.id} (${conn.pendingCount} pending)`);
        const r = await processOneBatch(conn.id, userId, sourceSystem);
        summary.processed += r.processed;
        summary.failed    += r.failed;
        conn.pendingCount  = r.remaining;
        batchesRun++;

        if (r.complete) {
          summary.completed.push(conn.id);
          console.log(`✅ conn ${conn.id} complete after ${batchesRun} batch(es)`);
          break;
        }
      }

      if (conn.pendingCount > 0) {
        summary.partial.push({ id: conn.id, remaining: conn.pendingCount });
        console.log(`⏸️  conn ${conn.id} partial — ${conn.pendingCount} remaining for next run`);
      }

    } catch (err) {
      console.error(`❌ Error on conn ${conn.id}: ${err.message}`);
      await supabase.from('Connections').update({ status: 'error' }).eq('id', conn.id);
      summary.failed++;
    }
  }

  const nextRunNeeded = summary.partial.length > 0 || summary.skipped.length > 0;
  return { ...summary, nextRunNeeded, durationMs: elapsed(startMs) };
}


// ── GET /api/import/run-scheduled ─────────────────────────────────────────────
// Vercel Cron invokes endpoints with GET + Authorization: Bearer <CRON_SECRET>

router.get('/run-scheduled', async (req, res) => {
  if (!verifyCronAuth(req, res)) return;
  const startMs = Date.now();
  console.log(`🕐 GET run-scheduled at ${new Date().toISOString()}`);
  try {
    const result = await runScheduledCore(startMs);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ run-scheduled error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST kept for manual testing / external triggers using the same CRON_SECRET auth
router.post('/run-scheduled', async (req, res) => {
  if (!verifyCronAuth(req, res)) return;
  const startMs = Date.now();
  console.log(`🕐 POST run-scheduled at ${new Date().toISOString()}`);
  try {
    const result = await runScheduledCore(startMs);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ run-scheduled error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── POST /api/import/start/:connectionId ──────────────────────────────────────
// Called by frontend Sync button. Buffers feed OR processes one batch.
// Returns current status so frontend can start polling.
// Does NOT depend on frontend calling it again — run-scheduled picks up the rest.

router.post('/start/:connectionId', addUserToRequest, requireAuth, async (req, res) => {
  const connId = parseInt(req.params.connectionId);
  if (!connId) return res.status(400).json({ error: 'Invalid connectionId' });

  try {
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

    const { count: pending } = await supabase
      .from('RawJobRecords').select('Id', { count: 'exact', head: true })
      .eq('ConnectionId', connId).eq('ProcessingStatus', 'pending');

    let phase;

    if ((pending || 0) === 0) {
      // Phase 1: buffer the feed
      phase = 'buffer';
      await bufferConnection(conn);
    } else {
      // Phase 2: process one batch, leave the rest for run-scheduled
      phase = 'process';
      await processOneBatch(connId, userId, sourceSystem);
    }

    // Return current status so frontend can switch to polling immediately
    const { count: pendingNow }   = await supabase.from('RawJobRecords').select('Id', { count: 'exact', head: true }).eq('ConnectionId', connId).eq('ProcessingStatus', 'pending');
    const { count: failedNow }    = await supabase.from('RawJobRecords').select('Id', { count: 'exact', head: true }).eq('ConnectionId', connId).eq('ProcessingStatus', 'failed');
    const { count: processedNow } = await supabase.from('RawJobRecords').select('Id', { count: 'exact', head: true }).eq('ConnectionId', connId).eq('ProcessingStatus', 'processed');
    const sourcesRes = await supabase.from('JobOfferSources').select('Id', { count: 'exact', head: true }).eq('ConnectionId', connId).eq('StatusInSource', 'active');
    const importedOffers = sourcesRes.error ? 0 : (sourcesRes.count || 0);

    return res.json({
      success:         true,
      connectionId:    connId,
      phase,
      pendingRecords:  pendingNow  ?? 0,
      failedRecords:   failedNow   ?? 0,
      processedRecords: processedNow ?? 0,
      importedOffers,
      hasMore:         (pendingNow ?? 0) > 0,
      message:         (pendingNow ?? 0) > 0
        ? `Procesando: ${processedNow ?? 0} procesadas, ${pendingNow ?? 0} en cola. El sistema continuará automáticamente.`
        : `Importación completada: ${importedOffers} ofertas`,
    });

  } catch (err) {
    console.error(`❌ import/start ${connId}:`, err.message);
    await supabase.from('Connections').update({ status: 'error' }).eq('id', connId).catch(() => {});
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
