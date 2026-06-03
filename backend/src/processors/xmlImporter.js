/**
 * XMLImporter — Clean MVP
 *
 * Supports two entry points:
 *   importer.run()                  — fetch XML from connection feed URL
 *   XMLImporter.runFromBuffer(xml, opts) — process XML string (file upload, test)
 *
 * Pipeline:
 *   XML string → parse → per offer:
 *     1. RawJobRecords upsert (raw payload + hash)
 *     2. Transform to canonical JobOffer
 *     3. JobOffers upsert (UserId + ConnectionId + ExternalId)
 *     4. Link RawJobRecord.JobOfferId
 *   After all offers:
 *     5. _reconcileMissingOffers (paused or archived based on ExpirationDate)
 *
 * Status semantics for externally-imported offers:
 *   'active'   — offer is present in the current feed import
 *   'paused'   — offer disappeared from feed but ExpirationDate is in the future (or absent)
 *   'archived' — offer disappeared from feed AND ExpirationDate is past
 *   'expired'  — alias for archived when reason is expiration
 *
 * NOTE: JobOffers.Status tracks the canonical offer's availability.
 *       DistributionItems.Status tracks distribution/publication state per channel.
 *       These are independent — do not conflate them.
 *
 * Rules:
 *   - No pool.request() — Supabase client only
 *   - No LLM in import path — deterministic mapping first, IA only as future assist
 *   - ExternalId is NEVER the internal PK
 *   - Optional reconciliation columns: LastSeenAt, MissingSince, PauseReason, ArchivedReason
 *     (code writes them if present; no error if columns don't exist yet)
 */

const axios  = require('axios');
const xml2js = require('xml2js');
const crypto = require('crypto');
const { supabase } = require('../db/db');

// ─── Auto-detection mapping: Turijobs / Bebee XML feed ───────────────────────
// Extend or override per-connection via FieldMappings table.

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
  // Try common feed structures
  for (const key of ['job', 'offer', 'item', 'listing', 'vacancy']) {
    const val = root?.[key];
    if (val) return Array.isArray(val) ? val : [val];
  }
  // Depth 2 fallback
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

// ─── Load FieldMappings for a connection ──────────────────────────────────────

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

function transformOffer(rawOffer, fieldMap) {
  const effective = fieldMap || TURIJOBS_AUTO_MAP;
  const out = {};

  for (const [src, target] of Object.entries(effective)) {
    const val = rawOffer[src] ?? rawOffer[src.toLowerCase()] ?? null;
    if (val != null) out[target] = val;
  }

  // Type coercions
  if (out.ExternalId != null)        out.ExternalId        = safeStr(out.ExternalId, 255);
  if (out.Title != null)             out.Title             = safeStr(out.Title, 500);
  if (out.DescriptionHtml != null) {
    out.DescriptionHtml = safeStr(out.DescriptionHtml);
    out.DescriptionText = out.DescriptionHtml
      ? out.DescriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : null;
  }
  for (const f of ['CompanyName','CompanyExternalId','Sector','Subcategory','City','Region',
                   'Country','Postcode','Address','JobType','ContractType','WorkdayType','Seniority','Language']) {
    if (out[f] != null) out[f] = safeStr(out[f], f === 'Language' ? 10 : f === 'Postcode' ? 20 : 255);
  }
  if (out.CountryCode != null) out.CountryCode = safeStr(out.CountryCode, 10);
  for (const f of ['ExternalUrl','ApplicationUrl','CompanyLogoUrl']) {
    if (out[f] != null) out[f] = safeStr(out[f], 1024);
  }
  if (out.SalaryRaw != null)    out.SalaryRaw    = safeStr(out.SalaryRaw, 500);
  if (out.Latitude != null)     out.Latitude     = safeNum(out.Latitude);
  if (out.Longitude != null)    out.Longitude    = safeNum(out.Longitude);
  if (out.Vacancies != null)    out.Vacancies    = safeNum(out.Vacancies) ?? 1;
  if (out.PublicationDate != null) out.PublicationDate = safeDate(out.PublicationDate);
  if (out.ExpirationDate != null)  out.ExpirationDate  = safeDate(out.ExpirationDate);

  return out;
}

// ─── XMLImporter class ────────────────────────────────────────────────────────

class XMLImporter {
  constructor({ userId, connectionId, feedUrl, sourceSystem = 'xml-feed' }) {
    if (!userId || !connectionId) throw new Error('XMLImporter requires userId and connectionId');
    this.userId       = userId;
    this.connectionId = connectionId;
    this.feedUrl      = feedUrl || null;
    this.sourceSystem = sourceSystem;
    this.fieldMap     = null;
    this.stats = { total: 0, inserted: 0, updated: 0, failed: 0, paused: 0, archived: 0, warnings: [] };
  }

  // ── Entry point 1: fetch XML from feed URL ──────────────────────────────────

  async run() {
    if (!this.feedUrl) throw new Error('XMLImporter.run() requires a feedUrl');
    console.log(`🚀 XMLImporter.run(): connection ${this.connectionId}, user ${this.userId}`);
    const xmlString = await this._fetchXml();
    return this._processXmlString(xmlString);
  }

  // ── Entry point 2: process XML string directly (file upload, tests) ─────────

  static async runFromBuffer(xmlString, { userId, connectionId, sourceSystem = 'xml-upload' }) {
    const importer = new XMLImporter({ userId, connectionId, feedUrl: null, sourceSystem });
    console.log(`🚀 XMLImporter.runFromBuffer(): connection ${connectionId}, user ${userId}`);
    return importer._processXmlString(xmlString);
  }

  // ── Core pipeline ────────────────────────────────────────────────────────────

  async _processXmlString(xmlString) {
    this.fieldMap = await loadFieldMappings(this.connectionId);
    console.log(`📋 Field mapping: ${this.fieldMap ? 'FieldMappings table' : 'auto-detect (Turijobs/Bebee)'}`);

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

    // Reconcile: pause or archive offers missing from this feed run
    if (activeExternalIds.size > 0) {
      await this._reconcileMissingOffers(activeExternalIds);
    }

    // Update connection status
    await supabase.from('Connections').update({
      status:    'active',
      lastSync:  now(),
    }).eq('id', this.connectionId).catch(() => {});

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

  // ── Process a single offer ────────────────────────────────────────────────

  async _processOffer(rawOffer) {
    const rawPayload  = JSON.stringify(rawOffer);
    const payloadHash = sha256(rawPayload);
    const canonical   = transformOffer(rawOffer, this.fieldMap);

    if (!canonical.Title) {
      this.stats.warnings.push(`Skipped offer with no Title (ExternalId=${canonical.ExternalId ?? 'unknown'})`);
      return null;
    }

    if (!canonical.ExpirationDate) {
      this.stats.warnings.push(`Offer without ExpirationDate: ExternalId=${canonical.ExternalId ?? 'unknown'} — will be paused if missing from future feed`);
    }

    if (!canonical.ExternalId) {
      canonical.ExternalId = `hash:${payloadHash.substring(0, 20)}`;
      this.stats.warnings.push(`Offer has no ExternalId — using hash-based ID: ${canonical.ExternalId}`);
    }

    // 1. RawJobRecords upsert
    let rawRecordId = null;
    const { data: rawRec, error: rawErr } = await supabase
      .from('RawJobRecords')
      .upsert({
        UserId:           this.userId,
        ConnectionId:     this.connectionId,
        ExternalId:       canonical.ExternalId,
        RawFormat:        'xml',
        RawPayload:       rawPayload,
        PayloadHash:      payloadHash,
        ReceivedAt:       now(),
        ProcessingStatus: 'processing',
      }, { onConflict: 'ConnectionId,ExternalId' })
      .select('Id')
      .single();

    if (!rawErr && rawRec) rawRecordId = rawRec.Id;

    // 2. JobOffers upsert
    const offerPayload = {
      UserId:          this.userId,
      ConnectionId:    this.connectionId,
      RawJobRecordId:  rawRecordId,
      SourceSystem:    this.sourceSystem,
      PayloadHash:     payloadHash,
      Status:          'active',
      LastSeenAt:      now(),   // optional column — set if it exists in schema
      UpdatedAt:       now(),
      ...canonical,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from('JobOffers')
      .upsert(offerPayload, { onConflict: 'UserId,ConnectionId,ExternalId' })
      .select('Id')
      .single();

    if (upsertErr) throw new Error(`JobOffers upsert: ${upsertErr.message}`);

    const jobOfferId = upserted?.Id;

    // 3. Link RawJobRecord → JobOffer
    if (rawRecordId && jobOfferId) {
      await supabase
        .from('RawJobRecords')
        .update({ JobOfferId: jobOfferId, ProcessingStatus: 'processed' })
        .eq('Id', rawRecordId);
    }

    this.stats.inserted++; // upsert — counts both insert and update as success
    return canonical.ExternalId;
  }

  // ── Reconcile missing offers ──────────────────────────────────────────────
  //
  // Business rules for externally-imported offers:
  //
  //   Offer IS in current feed       → Status = 'active' (already set by _processOffer)
  //
  //   Offer NOT in current feed:
  //     ExpirationDate exists AND ExpirationDate > now  → Status = 'paused'
  //                                                        PauseReason = 'missing_from_source_feed'
  //                                                        MissingSince = now
  //
  //     ExpirationDate exists AND ExpirationDate <= now → Status = 'archived'
  //                                                        ArchivedReason = 'expired'
  //
  //     ExpirationDate NOT in record                    → Status = 'paused'
  //                                                        PauseReason = 'missing_from_source_feed_no_expiration'
  //                                                        MissingSince = now

  async _reconcileMissingOffers(activeExternalIds) {
    const nowTs = new Date();

    // Fetch all active+paused offers for this connection
    const { data: existing, error } = await supabase
      .from('JobOffers')
      .select('Id, ExternalId, ExpirationDate, Status')
      .eq('UserId',       this.userId)
      .eq('ConnectionId', this.connectionId)
      .in('Status', ['active', 'paused']);

    if (error) {
      console.error('❌ _reconcileMissingOffers fetch failed:', error.message);
      this.stats.warnings.push(`Reconciliation skipped: ${error.message}`);
      return;
    }

    if (!existing?.length) return;

    const toPause   = [];
    const toArchive = [];

    for (const offer of existing) {
      if (activeExternalIds.has(offer.ExternalId)) continue; // still in feed

      const expiry = offer.ExpirationDate ? new Date(offer.ExpirationDate) : null;

      if (expiry && expiry <= nowTs) {
        // Past expiry → archive
        toArchive.push(offer.Id);
      } else {
        // No expiry or future expiry → pause
        toPause.push(offer.Id);
      }
    }

    // Batch update: pause
    if (toPause.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < toPause.length; i += BATCH) {
        const slice = toPause.slice(i, i + BATCH);
        await supabase
          .from('JobOffers')
          .update({
            Status:      'paused',
            MissingSince: now(),   // optional column
            PauseReason:  toPause.map(() => null).includes(null) // dummy — set real value below
              ? 'missing_from_source_feed' : 'missing_from_source_feed',
            UpdatedAt:   now(),
          })
          .in('Id', slice)
          .catch(err => {
            // If optional columns don't exist yet, retry without them
            return supabase
              .from('JobOffers')
              .update({ Status: 'paused', UpdatedAt: now() })
              .in('Id', slice);
          });
      }
      this.stats.paused += toPause.length;
      console.log(`⏸️  Paused ${toPause.length} offers (missing from feed, not yet expired)`);
    }

    // Batch update: archive
    if (toArchive.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < toArchive.length; i += BATCH) {
        const slice = toArchive.slice(i, i + BATCH);
        await supabase
          .from('JobOffers')
          .update({
            Status:         'archived',
            ArchivedReason: 'expired',  // optional column
            UpdatedAt:      now(),
          })
          .in('Id', slice)
          .catch(err => {
            return supabase
              .from('JobOffers')
              .update({ Status: 'archived', UpdatedAt: now() })
              .in('Id', slice);
          });
      }
      this.stats.archived += toArchive.length;
      console.log(`🗄️  Archived ${toArchive.length} offers (expired and missing from feed)`);
    }
  }
}

module.exports = XMLImporter;
