/**
 * XMLImporter — Canonical deduplication model
 *
 * Three-table ingestion pipeline:
 *   RawJobRecords  — immutable raw payload, one row per (ConnectionId, ExternalId)
 *   JobOffers      — canonical offer, one row per (UserId, SourceSystem, ExternalId)
 *   JobOfferSources — M:N link: one canonical offer → many (connection, externalId) sources
 *
 * Deduplication contract:
 *   Two connections sending the same ExternalId from the same SourceSystem
 *   → ONE canonical JobOffer row (deduplicated)
 *   → TWO JobOfferSources rows (one per connection)
 *
 * Reconciliation rule:
 *   JobOfferSources.StatusInSource tracks per-connection availability.
 *   JobOffers.Status is only changed to paused/archived when ALL linked sources
 *   are no longer active. A canonical offer survives if any source still sends it.
 *
 * Entry points:
 *   XMLImporter.run()              — fetch from feed URL, full pipeline
 *   XMLImporter.runFromBuffer()    — process XML string (file upload / test)
 *   XMLImporter.fetchToBuffer()    — Phase 1: fetch XML → save all to RawJobRecords
 *   XMLImporter.processBatch()     — Phase 2+: transform pending RawJobRecords → JobOffers
 *
 * Rules:
 *   - No pool.request() — Supabase only
 *   - No LLM — deterministic mapping
 *   - ExternalId is never the internal PK
 *   - Truncation aligned with VARCHAR(255) columns in schema
 */

const axios  = require('axios');
const xml2js = require('xml2js');
const crypto = require('crypto');
const { supabase } = require('../db/db');

// ─── Source system inference ──────────────────────────────────────────────────
// Canonical SourceSystem is derived from the feed URL hostname, not the
// connection name. This ensures the same provider is always identified the same
// way regardless of how the connection is named.

function inferSourceSystem(feedUrl) {
  try {
    const host = new URL(feedUrl).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('turijobs')) return 'turijobs';
    if (host.includes('bebee'))    return 'bebee';
    if (host.includes('infojobs')) return 'infojobs';
    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('indeed'))   return 'indeed';
    if (host.includes('jooble'))   return 'jooble';
    if (host.includes('talent'))   return 'talent';
    // Fallback: use the second-level domain as identifier
    const parts = host.split('.');
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch {
    return 'xml-feed';
  }
}

// ─── Auto-detection mapping: Turijobs / Bebee XML feed ───────────────────────

const TURIJOBS_AUTO_MAP = {
  'id':               'ExternalId',
  'url':              'ExternalUrl',
  'url_apply':        'ApplicationUrl',
  'title':            'Title',
  'content':          'DescriptionHtml',
  'company':          'CompanyName',
  'companyid':        'CompanyExternalId',
  'company_logo_url': 'CompanyLogoUrl',
  'category':         'Sector',
  'subcategory':      'Subcategory',
  'city':             'City',
  'region':           'Region',
  'postcode':         'Postcode',
  'idpais':           'CountryCode',
  'country':          'Country',
  'address':          'Address',
  'latitude':         'Latitude',
  'longitude':        'Longitude',
  'salary':           'SalaryRaw',
  'jobtype':          'JobType',
  'contracttype':     'ContractType',
  'workdaytype':      'WorkdayType',
  'seniority':        'Seniority',
  'num_vacancies':    'Vacancies',
  'publication':      'PublicationDate',
  'expiration':       'ExpirationDate',
  'language':         'Language',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function safeStr(val, maxLen = null) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === '' || s === 'undefined' || s === 'null') return null;
  return maxLen ? s.substring(0, maxLen) : s;
}

function safeNum(val) {
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function now() {
  return new Date().toISOString();
}

function parseXml(xmlString) {
  return new Promise((resolve, reject) => {
    new xml2js.Parser({
      explicitArray: false, ignoreAttrs: false, mergeAttrs: true, trim: true,
    }).parseString(xmlString, (err, result) => {
      if (err) reject(err); else resolve(result);
    });
  });
}

function extractOfferList(parsed) {
  const rootKey = Object.keys(parsed)[0];
  const root    = parsed[rootKey];
  for (const key of ['job', 'offer', 'item', 'listing', 'vacancy']) {
    const val = root?.[key];
    if (val) return Array.isArray(val) ? val : [val];
  }
  if (root && typeof root === 'object') {
    for (const k of Object.keys(root)) {
      const v = root[k];
      if (Array.isArray(v) && v.length > 0) return v;
      if (v && typeof v === 'object') {
        for (const k2 of Object.keys(v)) {
          const v2 = v[k2];
          if (Array.isArray(v2) && v2.length > 0) return v2;
        }
      }
    }
  }
  return [];
}

async function loadFieldMappings(connectionId) {
  const { data, error } = await supabase
    .from('FieldMappings')
    .select('SourceField, SourcePath, TargetField')
    .eq('ConnectionId', connectionId);
  if (error || !data?.length) return null;
  const map = {};
  for (const row of data) {
    const src = (row.SourcePath || row.SourceField || '').toLowerCase();
    if (src && row.TargetField) map[src] = row.TargetField;
  }
  return Object.keys(map).length ? map : null;
}

// ─── Transform raw XML offer → canonical JobOffer fields ─────────────────────
// Truncation lengths aligned with current schema:
//   VARCHAR(500)  → Title
//   VARCHAR(255)  → most classification fields (now widened from 100)
//   VARCHAR(100)  → Language, CountryCode (short codes)
//   VARCHAR(20)   → Postcode
//   VARCHAR(1024) → URLs
//   TEXT          → descriptions (no limit)

function transformOffer(rawOffer, fieldMap) {
  const effective = fieldMap || TURIJOBS_AUTO_MAP;
  const out = {};

  for (const [src, target] of Object.entries(effective)) {
    const val = rawOffer[src] ?? rawOffer[src.toLowerCase()] ?? null;
    if (val != null) out[target] = val;
  }

  if (out.ExternalId != null)        out.ExternalId    = safeStr(out.ExternalId, 255);
  if (out.Title != null)             out.Title         = safeStr(out.Title, 500);
  if (out.DescriptionHtml != null) {
    out.DescriptionHtml = safeStr(out.DescriptionHtml);
    out.DescriptionText = out.DescriptionHtml
      ? out.DescriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : null;
  }

  // VARCHAR(255) fields — schema widened from 100 to handle real feed values
  for (const f of ['CompanyName','CompanyExternalId','Sector','Subcategory','City','Region',
                   'Country','Address','JobType','ContractType','WorkdayType','Seniority']) {
    if (out[f] != null) out[f] = safeStr(out[f], 255);
  }

  // Short code fields — stay at their natural lengths
  if (out.Language    != null) out.Language    = safeStr(out.Language, 10);
  if (out.CountryCode != null) out.CountryCode = safeStr(out.CountryCode, 10);
  if (out.Postcode    != null) out.Postcode    = safeStr(out.Postcode, 20);

  for (const f of ['ExternalUrl','ApplicationUrl','CompanyLogoUrl']) {
    if (out[f] != null) out[f] = safeStr(out[f], 1024);
  }

  if (out.SalaryRaw  != null) out.SalaryRaw  = safeStr(out.SalaryRaw, 500);
  if (out.Latitude   != null) out.Latitude   = safeNum(out.Latitude);
  if (out.Longitude  != null) out.Longitude  = safeNum(out.Longitude);
  if (out.Vacancies  != null) out.Vacancies  = safeNum(out.Vacancies) ?? 1;
  if (out.PublicationDate != null) out.PublicationDate = safeDate(out.PublicationDate);
  if (out.ExpirationDate  != null) out.ExpirationDate  = safeDate(out.ExpirationDate);

  return out;
}

// ─── XMLImporter class ────────────────────────────────────────────────────────

class XMLImporter {
  constructor({ userId, connectionId, feedUrl, sourceSystem = null }) {
    if (!userId || !connectionId) throw new Error('XMLImporter requires userId and connectionId');
    this.userId       = userId;
    this.connectionId = connectionId;
    this.feedUrl      = feedUrl || null;
    // sourceSystem is inferred from feedUrl if not provided
    this.sourceSystem = sourceSystem || (feedUrl ? inferSourceSystem(feedUrl) : 'xml-feed');
    this.fieldMap     = null;
    this.stats = { total: 0, inserted: 0, updated: 0, failed: 0, paused: 0, archived: 0, warnings: [] };
  }

  // ── Entry point 1: fetch XML from feed URL ──────────────────────────────────

  async run() {
    if (!this.feedUrl) throw new Error('XMLImporter.run() requires a feedUrl');
    console.log(`🚀 XMLImporter.run(): conn ${this.connectionId}, user ${this.userId}, source=${this.sourceSystem}`);
    const xmlString = await this._fetchXml();
    return this._processXmlString(xmlString);
  }

  // ── Entry point 2: process XML string (file upload / test) ──────────────────

  static async runFromBuffer(xmlString, { userId, connectionId, feedUrl = '', sourceSystem = null }) {
    const ss = sourceSystem || (feedUrl ? inferSourceSystem(feedUrl) : 'xml-upload');
    const importer = new XMLImporter({ userId, connectionId, feedUrl, sourceSystem: ss });
    console.log(`🚀 XMLImporter.runFromBuffer(): conn ${connectionId}, source=${ss}`);
    return importer._processXmlString(xmlString);
  }

  // ── Entry point 3: buffer — fetch XML → save all to RawJobRecords ───────────

  static async fetchToBuffer(feedUrl, { userId, connectionId }) {
    const sourceSystem = inferSourceSystem(feedUrl);
    const importer = new XMLImporter({ userId, connectionId, feedUrl, sourceSystem });
    console.log(`🚀 XMLImporter.fetchToBuffer(): conn ${connectionId}, source=${sourceSystem}`);

    importer.fieldMap  = await loadFieldMappings(connectionId);
    const xmlString    = await importer._fetchXml();
    const parsed       = await parseXml(xmlString);
    const offers       = extractOfferList(parsed);
    console.log(`📦 Feed has ${offers.length} offers — buffering to RawJobRecords`);

    let buffered = 0;
    const warnings = [];

    for (const rawOffer of offers) {
      const rawPayload  = JSON.stringify(rawOffer);
      const payloadHash = sha256(rawPayload);
      const canonical   = transformOffer(rawOffer, importer.fieldMap);

      if (!canonical.Title) { warnings.push(`Skipped (no Title): ${canonical.ExternalId}`); continue; }
      if (!canonical.ExternalId) {
        canonical.ExternalId = `hash:${payloadHash.substring(0, 20)}`;
        warnings.push(`No ExternalId, using hash: ${canonical.ExternalId}`);
      }

      const { error } = await supabase
        .from('RawJobRecords')
        .upsert({
          UserId: userId, ConnectionId: connectionId, ExternalId: canonical.ExternalId,
          RawFormat: 'xml', RawPayload: rawPayload, PayloadHash: payloadHash,
          ReceivedAt: now(), ProcessingStatus: 'pending',
        }, { onConflict: 'ConnectionId,ExternalId' });

      if (error) { warnings.push(`Buffer error ${canonical.ExternalId}: ${error.message}`); }
      else buffered++;
    }

    const { count: pendingCount } = await supabase
      .from('RawJobRecords')
      .select('Id', { count: 'exact', head: true })
      .eq('ConnectionId', connectionId)
      .in('ProcessingStatus', ['pending', 'failed']);

    console.log(`✅ Buffer: ${buffered} upserted, ${pendingCount ?? 0} pending`);
    return { total: offers.length, buffered, pendingCount: pendingCount ?? 0, sourceSystem, warnings };
  }

  // ── Entry point 4: process one batch from RawJobRecords ─────────────────────
  // Reads up to batchSize pending RawJobRecords for the connection,
  // upserts to JobOffers (canonical dedup), upserts to JobOfferSources (per-source link),
  // marks records processed.
  //
  // Returns: { processed, failed, remaining, pendingOnly, batchExternalIds, warnings }

  static async processBatch({ userId, connectionId, feedUrl = '', sourceSystem = null, batchSize = 200 }) {
    const ss = sourceSystem || (feedUrl ? inferSourceSystem(feedUrl) : 'xml-feed');
    console.log(`🔄 XMLImporter.processBatch(): conn ${connectionId}, source=${ss}, batchSize=${batchSize}`);

    const fieldMap = await loadFieldMappings(connectionId);

    // Fetch pending batch — failed records are NOT included (non-blocking)
    const { data: batch, error: fetchErr } = await supabase
      .from('RawJobRecords')
      .select('Id, ExternalId, RawPayload, PayloadHash')
      .eq('ConnectionId', connectionId)
      .eq('ProcessingStatus', 'pending')
      .order('Id', { ascending: true })
      .limit(batchSize);

    if (fetchErr) throw new Error(`processBatch fetch: ${fetchErr.message}`);
    if (!batch?.length) {
      const { count: remaining } = await supabase
        .from('RawJobRecords').select('Id', { count: 'exact', head: true })
        .eq('ConnectionId', connectionId).eq('ProcessingStatus', 'pending');
      return { processed: 0, failed: 0, remaining: remaining ?? 0, pendingOnly: remaining ?? 0, batchExternalIds: new Set(), warnings: [] };
    }

    const warnings = [];
    const batchExternalIds = new Set();
    let processed = 0;
    let failedCount = 0;

    for (const record of batch) {
      try {
        let rawOffer;
        try { rawOffer = JSON.parse(record.RawPayload); }
        catch { throw new Error('Invalid JSON in RawPayload'); }

        const canonical = transformOffer(rawOffer, fieldMap);
        if (!canonical.Title) throw new Error('No Title after transform');
        if (!canonical.ExternalId) canonical.ExternalId = `hash:${record.PayloadHash?.substring(0,20)}`;

        const nowTs = now();

        // ── 1. Upsert to JobOffers — canonical dedup ─────────────────────────
        // Conflict key: UserId + SourceSystem + ExternalId
        // Two connections with the same offer → same canonical row, updated in place.
        const offerPayload = {
          UserId: userId, ConnectionId: connectionId, // ConnectionId = first/primary connection (informational)
          RawJobRecordId: record.Id, SourceSystem: ss,
          PayloadHash: record.PayloadHash, Status: 'active', LastSeenAt: nowTs, UpdatedAt: nowTs,
          ...canonical,
        };

        const { data: upserted, error: upsertErr } = await supabase
          .from('JobOffers')
          .upsert(offerPayload, { onConflict: 'UserId,SourceSystem,ExternalId' })
          .select('Id')
          .single();

        if (upsertErr) throw new Error(`JobOffers upsert: ${upsertErr.message}`);
        const jobOfferId = upserted?.Id;
        if (!jobOfferId) throw new Error('JobOffers upsert returned no Id');

        // ── 2. Upsert to JobOfferSources — per-source link ────────────────────
        // Conflict key: UserId + ConnectionId + ExternalId
        // This row records that this connection/feed sent this offer.
        const { error: srcErr } = await supabase
          .from('JobOfferSources')
          .upsert({
            UserId: userId, JobOfferId: jobOfferId, ConnectionId: connectionId,
            RawJobRecordId: record.Id, SourceSystem: ss, ExternalId: canonical.ExternalId,
            PayloadHash: record.PayloadHash, StatusInSource: 'active', LastSeenAt: nowTs, UpdatedAt: nowTs,
          }, { onConflict: 'UserId,ConnectionId,ExternalId' });

        if (srcErr) throw new Error(`JobOfferSources upsert: ${srcErr.message}`);

        // ── 3. Link RawJobRecord → JobOffer, mark processed ───────────────────
        await supabase
          .from('RawJobRecords')
          .update({ JobOfferId: jobOfferId, ProcessingStatus: 'processed' })
          .eq('Id', record.Id);

        batchExternalIds.add(canonical.ExternalId);
        processed++;

      } catch (err) {
        failedCount++;
        const msg = `Record ${record.Id} (${record.ExternalId}): ${err.message}`;
        if (failedCount <= 5) console.error(`❌ ${msg}`);
        warnings.push(msg);
        await supabase
          .from('RawJobRecords')
          .update({ ProcessingStatus: 'failed', ProcessingError: err.message.substring(0, 500) })
          .eq('Id', record.Id);
      }
    }

    // Count remaining PENDING only (failed are non-blocking)
    const { count: pendingOnly } = await supabase
      .from('RawJobRecords').select('Id', { count: 'exact', head: true })
      .eq('ConnectionId', connectionId).eq('ProcessingStatus', 'pending');
    const { count: failedTotal } = await supabase
      .from('RawJobRecords').select('Id', { count: 'exact', head: true })
      .eq('ConnectionId', connectionId).eq('ProcessingStatus', 'failed');

    console.log(`✅ Batch: ${processed} ok, ${failedCount} failed, ${pendingOnly ?? 0} pending remaining, ${failedTotal ?? 0} total failed`);
    return {
      processed, failed: failedCount,
      remaining: pendingOnly ?? 0,   // hasMore = remaining > 0
      pendingOnly: pendingOnly ?? 0,
      failedTotal: failedTotal ?? 0,
      batchExternalIds,
      warnings,
    };
  }

  // ── Core pipeline ────────────────────────────────────────────────────────────

  async _processXmlString(xmlString) {
    this.fieldMap = await loadFieldMappings(this.connectionId);
    console.log(`📋 Field mapping: ${this.fieldMap ? 'FieldMappings table' : `auto-detect (${this.sourceSystem})`}`);

    const parsed = await parseXml(xmlString);
    const offers = extractOfferList(parsed);
    this.stats.total = offers.length;
    console.log(`📦 Feed contains ${offers.length} offers`);

    if (offers.length === 0) {
      this.stats.warnings.push('No offers found — verify feed structure');
      return this.stats;
    }

    const activeExternalIds = new Set();

    for (const rawOffer of offers) {
      try {
        const extId = await this._processOffer(rawOffer);
        if (extId) activeExternalIds.add(extId);
      } catch (err) {
        this.stats.failed++;
        const msg = `Offer failed: ${err.message}`;
        if (this.stats.failed <= 10) console.error(`❌ ${msg}`);
        this.stats.warnings.push(msg);
      }
    }

    if (activeExternalIds.size > 0) {
      await this._reconcileMissingOffers(activeExternalIds);
    }

    await supabase.from('Connections').update({ status: 'active', lastSync: now() })
      .eq('id', this.connectionId).catch(() => {});

    console.log(`✅ Import done: ${JSON.stringify(this.stats)}`);
    return this.stats;
  }

  async _fetchXml() {
    const response = await axios.get(this.feedUrl, {
      timeout: 30000,
      headers: { 'User-Agent': 'TalentOS-Importer/1.0' },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });
    return response.data;
  }

  async _processOffer(rawOffer) {
    const rawPayload  = JSON.stringify(rawOffer);
    const payloadHash = sha256(rawPayload);
    const canonical   = transformOffer(rawOffer, this.fieldMap);
    const nowTs       = now();

    if (!canonical.Title) {
      this.stats.warnings.push(`Skipped (no Title): ${canonical.ExternalId ?? 'unknown'}`);
      return null;
    }
    if (!canonical.ExpirationDate) {
      this.stats.warnings.push(`No ExpirationDate: ${canonical.ExternalId ?? 'unknown'} — will be paused if missing from future feed`);
    }
    if (!canonical.ExternalId) {
      canonical.ExternalId = `hash:${payloadHash.substring(0, 20)}`;
      this.stats.warnings.push(`No ExternalId, using hash: ${canonical.ExternalId}`);
    }

    // 1. RawJobRecords upsert
    let rawRecordId = null;
    const { data: rawRec, error: rawErr } = await supabase
      .from('RawJobRecords')
      .upsert({
        UserId: this.userId, ConnectionId: this.connectionId, ExternalId: canonical.ExternalId,
        RawFormat: 'xml', RawPayload: rawPayload, PayloadHash: payloadHash,
        ReceivedAt: nowTs, ProcessingStatus: 'processing',
      }, { onConflict: 'ConnectionId,ExternalId' })
      .select('Id').single();
    if (!rawErr && rawRec) rawRecordId = rawRec.Id;

    // 2. JobOffers upsert — canonical dedup by UserId+SourceSystem+ExternalId
    const offerPayload = {
      UserId: this.userId, ConnectionId: this.connectionId,
      RawJobRecordId: rawRecordId, SourceSystem: this.sourceSystem,
      PayloadHash: payloadHash, Status: 'active', LastSeenAt: nowTs, UpdatedAt: nowTs,
      ...canonical,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from('JobOffers')
      .upsert(offerPayload, { onConflict: 'UserId,SourceSystem,ExternalId' })
      .select('Id').single();
    if (upsertErr) throw new Error(`JobOffers upsert: ${upsertErr.message}`);
    const jobOfferId = upserted?.Id;

    // 3. JobOfferSources upsert — per-source link
    if (jobOfferId) {
      const { error: srcErr } = await supabase
        .from('JobOfferSources')
        .upsert({
          UserId: this.userId, JobOfferId: jobOfferId, ConnectionId: this.connectionId,
          RawJobRecordId: rawRecordId, SourceSystem: this.sourceSystem, ExternalId: canonical.ExternalId,
          PayloadHash: payloadHash, StatusInSource: 'active', LastSeenAt: nowTs, UpdatedAt: nowTs,
        }, { onConflict: 'UserId,ConnectionId,ExternalId' });
      if (srcErr) throw new Error(`JobOfferSources upsert: ${srcErr.message}`);
    }

    // 4. Link RawJobRecord → JobOffer + mark processed
    if (rawRecordId && jobOfferId) {
      await supabase
        .from('RawJobRecords')
        .update({ JobOfferId: jobOfferId, ProcessingStatus: 'processed' })
        .eq('Id', rawRecordId);
    }

    this.stats.inserted++;
    return canonical.ExternalId;
  }

  // ── Reconcile missing offers ──────────────────────────────────────────────
  //
  // For this connection's active JobOfferSources, if an offer is no longer in the feed:
  //   1. Update JobOfferSources.StatusInSource (paused / archived)
  //   2. Only update JobOffers.Status if NO other source still has StatusInSource='active'
  //
  // This preserves canonical offers that are still being sent by another connection.

  async _reconcileMissingOffers(activeExternalIds) {
    const nowTs = new Date();
    const missingSince = now();
    const BATCH = 100;

    // Fetch all active JobOfferSources for this connection
    const { data: sources, error } = await supabase
      .from('JobOfferSources')
      .select('Id, JobOfferId, ExternalId, StatusInSource')
      .eq('UserId', this.userId)
      .eq('ConnectionId', this.connectionId)
      .eq('StatusInSource', 'active');

    if (error) {
      console.error('❌ _reconcileMissingOffers fetch failed:', error.message);
      this.stats.warnings.push(`Reconciliation skipped: ${error.message}`);
      return;
    }
    if (!sources?.length) return;

    // Categorise missing sources
    // We need ExpirationDate from the canonical JobOffer for the decision
    const missingSourceIds = sources
      .filter(s => !activeExternalIds.has(s.ExternalId))
      .map(s => s.Id);

    if (missingSourceIds.length === 0) return;

    // Fetch JobOffer details for missing sources to get ExpirationDate
    const missingOfferIds = [...new Set(
      sources.filter(s => !activeExternalIds.has(s.ExternalId)).map(s => s.JobOfferId)
    )];

    const { data: canonicalOffers } = await supabase
      .from('JobOffers')
      .select('Id, ExpirationDate')
      .in('Id', missingOfferIds);

    const expiryMap = new Map((canonicalOffers || []).map(o => [o.Id, o.ExpirationDate]));

    const toPauseFuture  = []; // { sourceId, jobOfferId }
    const toPauseNoExp   = []; // { sourceId, jobOfferId }
    const toArchive      = []; // { sourceId, jobOfferId }

    for (const src of sources) {
      if (activeExternalIds.has(src.ExternalId)) continue;
      const expStr = expiryMap.get(src.JobOfferId);
      const expiry = expStr ? new Date(expStr) : null;
      const entry  = { sourceId: src.Id, jobOfferId: src.JobOfferId };

      if (!expiry)              toPauseNoExp.push(entry);
      else if (expiry <= nowTs) toArchive.push(entry);
      else                      toPauseFuture.push(entry);
    }

    // Helper: update JobOfferSources in batches
    const updateSources = async (entries, patch) => {
      const ids = entries.map(e => e.sourceId);
      for (let i = 0; i < ids.length; i += BATCH) {
        await supabase.from('JobOfferSources')
          .update({ ...patch, UpdatedAt: missingSince })
          .in('Id', ids.slice(i, i + BATCH));
      }
    };

    // Helper: update canonical JobOffers that have NO remaining active source.
    // Uses a single "fetch all still-active sources" query instead of N queries.
    const updateCanonicalIfNoActiveSources = async (entries, canonicalPatch) => {
      const jobOfferIds = [...new Set(entries.map(e => e.jobOfferId))];
      if (jobOfferIds.length === 0) return;

      // Single query: which of these JobOfferIds still have at least one active source?
      const { data: stillActive } = await supabase
        .from('JobOfferSources')
        .select('JobOfferId')
        .in('JobOfferId', jobOfferIds)
        .eq('StatusInSource', 'active');

      const activeSet = new Set((stillActive || []).map(r => r.JobOfferId));
      const noActiveSources = jobOfferIds.filter(id => !activeSet.has(id));

      if (noActiveSources.length === 0) return;

      // Batch update canonical offers with no remaining active source
      for (let i = 0; i < noActiveSources.length; i += BATCH) {
        const slice = noActiveSources.slice(i, i + BATCH);
        await supabase.from('JobOffers')
          .update({ ...canonicalPatch, UpdatedAt: missingSince })
          .in('Id', slice)
          .catch(() =>
            supabase.from('JobOffers').update({ Status: canonicalPatch.Status, UpdatedAt: missingSince }).in('Id', slice)
          );
      }
      console.log(`📝 Updated ${noActiveSources.length} canonical offers (no active sources remaining)`);
    };

    if (toPauseFuture.length > 0) {
      await updateSources(toPauseFuture, { StatusInSource: 'paused', MissingSince: missingSince, PauseReason: 'missing_from_source_feed' });
      await updateCanonicalIfNoActiveSources(toPauseFuture, { Status: 'paused', MissingSince: missingSince, PauseReason: 'missing_from_source_feed' });
      this.stats.paused += toPauseFuture.length;
      console.log(`⏸️  Paused ${toPauseFuture.length} sources (missing, future expiry)`);
    }
    if (toPauseNoExp.length > 0) {
      await updateSources(toPauseNoExp, { StatusInSource: 'paused', MissingSince: missingSince, PauseReason: 'missing_from_source_feed_no_expiration' });
      await updateCanonicalIfNoActiveSources(toPauseNoExp, { Status: 'paused', MissingSince: missingSince, PauseReason: 'missing_from_source_feed_no_expiration' });
      this.stats.paused += toPauseNoExp.length;
      console.log(`⏸️  Paused ${toPauseNoExp.length} sources (missing, no expiration)`);
    }
    if (toArchive.length > 0) {
      await updateSources(toArchive, { StatusInSource: 'archived', ArchivedReason: 'expired' });
      await updateCanonicalIfNoActiveSources(toArchive, { Status: 'archived', ArchivedReason: 'expired' });
      this.stats.archived += toArchive.length;
      console.log(`🗄️  Archived ${toArchive.length} sources (expired and missing)`);
    }
  }
}

XMLImporter.inferSourceSystem = inferSourceSystem;
module.exports = XMLImporter;
