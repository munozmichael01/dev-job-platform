/**
 * XML Importer — Clean MVP
 *
 * Pipeline:
 *   fetch XML → parse → per offer:
 *     1. save RawJobRecords (raw payload, hash)
 *     2. transform to canonical JobOffer
 *     3. upsert JobOffers (UserId + ConnectionId + ExternalId)
 *     4. link RawJobRecord.JobOfferId
 *     5. archive removed offers (status = 'archived')
 *
 * Rules:
 *   - No pool.request() — Supabase client only
 *   - No LLM — deterministic field mapping first
 *   - Mapping source: FieldMappings table if present, otherwise auto-detect for Turijobs/Bebee XML
 *   - ExternalId is NEVER the PK; it's the source system ID
 *   - Status is a string ('active', 'paused', 'archived')
 */

const axios = require('axios');
const xml2js = require('xml2js');
const crypto = require('crypto');
const { supabase } = require('../db/db');

// ─── Auto-detection mapping for Turijobs / Bebee feed format ─────────────────
// Source XML field → canonical JobOffers column
// Extend or override via FieldMappings table per connection.

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
  'idpais':           'CountryCode',       // raw country ID — store as-is
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
  return crypto.createHash('sha256').update(str).digest('hex');
}

function safeStr(val, maxLen = null) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === 'undefined') return null;
  return maxLen ? s.substring(0, maxLen) : s;
}

function safeNum(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseXmlPayload(xmlString) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      trim: true,
    });
    parser.parseString(xmlString, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function extractOfferList(parsed) {
  // Try common XML structures for job feeds
  const root = parsed;
  const rootKey = Object.keys(root)[0];
  const rootObj = root[rootKey];

  const candidates = [
    rootObj?.job,
    rootObj?.offer,
    rootObj?.item,
    rootObj?.listing,
    root?.job,
    root?.offer,
  ];

  for (const c of candidates) {
    if (c) return Array.isArray(c) ? c : [c];
  }

  // Last resort: find first array-valued key at depth 2
  if (rootObj && typeof rootObj === 'object') {
    for (const key of Object.keys(rootObj)) {
      const val = rootObj[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // depth 3
        for (const k2 of Object.keys(val)) {
          const v2 = val[k2];
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

  if (error || !data || data.length === 0) return null;

  const map = {};
  for (const row of data) {
    const src = (row.SourcePath || row.SourceField || '').toLowerCase();
    if (src && row.TargetField) map[src] = row.TargetField;
  }
  return Object.keys(map).length > 0 ? map : null;
}

// ─── Transform a raw XML offer object to canonical JobOffer ──────────────────

function transformOffer(rawOffer, fieldMap) {
  const canonical = {};

  const effectiveMap = fieldMap || TURIJOBS_AUTO_MAP;

  for (const [srcField, targetField] of Object.entries(effectiveMap)) {
    // Try exact field name and lowercase
    const val = rawOffer[srcField] ?? rawOffer[srcField.toLowerCase()] ?? null;
    if (val !== null && val !== undefined) {
      canonical[targetField] = val;
    }
  }

  // Post-processing — clean types
  if (canonical.ExternalId !== undefined)    canonical.ExternalId    = safeStr(canonical.ExternalId, 255);
  if (canonical.Title !== undefined)         canonical.Title         = safeStr(canonical.Title, 500);
  if (canonical.DescriptionHtml !== undefined) {
    canonical.DescriptionHtml = safeStr(canonical.DescriptionHtml);
    canonical.DescriptionText = canonical.DescriptionHtml
      ? canonical.DescriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : null;
  }
  if (canonical.CompanyName !== undefined)   canonical.CompanyName   = safeStr(canonical.CompanyName, 255);
  if (canonical.CompanyExternalId !== undefined) canonical.CompanyExternalId = safeStr(canonical.CompanyExternalId, 100);
  if (canonical.Sector !== undefined)        canonical.Sector        = safeStr(canonical.Sector, 255);
  if (canonical.Subcategory !== undefined)   canonical.Subcategory   = safeStr(canonical.Subcategory, 255);
  if (canonical.City !== undefined)          canonical.City          = safeStr(canonical.City, 100);
  if (canonical.Region !== undefined)        canonical.Region        = safeStr(canonical.Region, 100);
  if (canonical.Country !== undefined)       canonical.Country       = safeStr(canonical.Country, 100);
  if (canonical.CountryCode !== undefined)   canonical.CountryCode   = safeStr(canonical.CountryCode, 10);
  if (canonical.Postcode !== undefined)      canonical.Postcode      = safeStr(canonical.Postcode, 20);
  if (canonical.Address !== undefined)       canonical.Address       = safeStr(canonical.Address, 500);
  if (canonical.Latitude !== undefined)      canonical.Latitude      = safeNum(canonical.Latitude);
  if (canonical.Longitude !== undefined)     canonical.Longitude     = safeNum(canonical.Longitude);
  if (canonical.SalaryRaw !== undefined)     canonical.SalaryRaw     = safeStr(canonical.SalaryRaw, 500);
  if (canonical.JobType !== undefined)       canonical.JobType       = safeStr(canonical.JobType, 100);
  if (canonical.ContractType !== undefined)  canonical.ContractType  = safeStr(canonical.ContractType, 100);
  if (canonical.WorkdayType !== undefined)   canonical.WorkdayType   = safeStr(canonical.WorkdayType, 100);
  if (canonical.Seniority !== undefined)     canonical.Seniority     = safeStr(canonical.Seniority, 100);
  if (canonical.Language !== undefined)      canonical.Language      = safeStr(canonical.Language, 10);
  if (canonical.ExternalUrl !== undefined)   canonical.ExternalUrl   = safeStr(canonical.ExternalUrl, 1024);
  if (canonical.ApplicationUrl !== undefined) canonical.ApplicationUrl = safeStr(canonical.ApplicationUrl, 1024);
  if (canonical.CompanyLogoUrl !== undefined) canonical.CompanyLogoUrl = safeStr(canonical.CompanyLogoUrl, 1024);
  if (canonical.Vacancies !== undefined)     canonical.Vacancies     = safeNum(canonical.Vacancies) ?? 1;
  if (canonical.PublicationDate !== undefined) canonical.PublicationDate = safeDate(canonical.PublicationDate);
  if (canonical.ExpirationDate !== undefined)  canonical.ExpirationDate  = safeDate(canonical.ExpirationDate);

  return canonical;
}

// ─── Main importer class ──────────────────────────────────────────────────────

class XMLImporter {
  constructor({ userId, connectionId, feedUrl, sourceSystem = 'xml-feed' }) {
    if (!userId || !connectionId || !feedUrl) {
      throw new Error('XMLImporter requires userId, connectionId, feedUrl');
    }
    this.userId       = userId;
    this.connectionId = connectionId;
    this.feedUrl      = feedUrl;
    this.sourceSystem = sourceSystem;
    this.fieldMap     = null;   // loaded on run()
    this.stats = { total: 0, inserted: 0, updated: 0, failed: 0, archived: 0, warnings: [] };
  }

  async run() {
    console.log(`🚀 XMLImporter: starting for connection ${this.connectionId}, user ${this.userId}`);

    // 1. Load FieldMappings (may be null → use auto-detect)
    this.fieldMap = await loadFieldMappings(this.connectionId);
    const mappingSource = this.fieldMap ? 'FieldMappings table' : 'auto-detect (Turijobs/Bebee)';
    console.log(`📋 Field mapping source: ${mappingSource}`);

    // 2. Fetch XML
    const xmlString = await this._fetchXml();
    console.log(`📥 Fetched ${xmlString.length} bytes`);

    // 3. Parse
    const parsed = await parseXmlPayload(xmlString);
    const offers = extractOfferList(parsed);
    this.stats.total = offers.length;
    console.log(`📦 Found ${offers.length} offers in XML`);

    if (offers.length === 0) {
      this.stats.warnings.push('No offers found in XML — check feed structure');
      return this.stats;
    }

    // 4. Process each offer
    const activeExternalIds = [];
    for (const rawOffer of offers) {
      try {
        await this._processOffer(rawOffer, activeExternalIds);
      } catch (err) {
        this.stats.failed++;
        this.stats.warnings.push(`Offer failed: ${err.message}`);
        if (this.stats.failed <= 10) {
          console.error(`❌ Offer error: ${err.message}`);
        }
      }
    }

    // 5. Archive removed offers
    if (activeExternalIds.length > 0) {
      this.stats.archived = await this._archiveRemoved(activeExternalIds);
    }

    // 6. Update connection last sync
    await supabase
      .from('Connections')
      .update({ lastSync: new Date().toISOString(), status: 'active' })
      .eq('id', this.connectionId);

    console.log(`✅ Import complete: ${JSON.stringify(this.stats)}`);
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

  async _processOffer(rawOffer, activeExternalIds) {
    const rawPayload = JSON.stringify(rawOffer);
    const payloadHash = sha256(rawPayload);

    // Transform to canonical
    const canonical = transformOffer(rawOffer, this.fieldMap);

    if (!canonical.Title) {
      this.stats.warnings.push(`Offer skipped: no Title (ExternalId=${canonical.ExternalId || 'unknown'})`);
      return;
    }

    const externalId = canonical.ExternalId;
    if (!externalId) {
      // Use hash as stable ID — flag as warning
      canonical.ExternalId = `hash:${payloadHash.substring(0, 20)}`;
      this.stats.warnings.push(`Offer has no ExternalId — using hash-based ID: ${canonical.ExternalId}`);
    }

    activeExternalIds.push(canonical.ExternalId);

    // ── Step 1: save RawJobRecord ─────────────────────────────────────────────
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
        ReceivedAt:       new Date().toISOString(),
        ProcessingStatus: 'processing',
      }, {
        onConflict:       'ConnectionId,ExternalId',
        ignoreDuplicates: false,
      })
      .select('Id, ProcessingStatus')
      .single();

    if (!rawErr && rawRec) {
      rawRecordId = rawRec.Id;
    }

    // ── Step 2: upsert JobOffer ───────────────────────────────────────────────
    const offerPayload = {
      UserId:         this.userId,
      ConnectionId:   this.connectionId,
      RawJobRecordId: rawRecordId,
      SourceSystem:   this.sourceSystem,
      PayloadHash:    payloadHash,
      Status:         'active',
      UpdatedAt:      new Date().toISOString(),
      ...canonical,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from('JobOffers')
      .upsert(offerPayload, {
        onConflict:       'UserId,ConnectionId,ExternalId',
        ignoreDuplicates: false,
      })
      .select('Id')
      .single();

    if (upsertErr) throw new Error(`JobOffers upsert failed: ${upsertErr.message}`);

    const jobOfferId = upserted?.Id;

    // ── Step 3: link RawJobRecord → JobOffer + mark processed ────────────────
    if (rawRecordId && jobOfferId) {
      await supabase
        .from('RawJobRecords')
        .update({ JobOfferId: jobOfferId, ProcessingStatus: 'processed' })
        .eq('Id', rawRecordId);
    }

    this.stats.inserted++;
  }

  async _archiveRemoved(activeExternalIds) {
    // Mark as archived any offer from this connection that is no longer in the feed
    // Uses Supabase NOT IN via .not('ExternalId', 'in', ...)
    // NOTE: Supabase PostgREST .not().in() has a practical limit of ~1000 values.
    // For feeds > 1000 offers, we batch.

    let archived = 0;
    const batchSize = 500;

    for (let i = 0; i < activeExternalIds.length; i += batchSize) {
      const batch = activeExternalIds.slice(i, i + batchSize);
      const { count } = await supabase
        .from('JobOffers')
        .update({ Status: 'archived', UpdatedAt: new Date().toISOString() })
        .eq('UserId', this.userId)
        .eq('ConnectionId', this.connectionId)
        .eq('Status', 'active')
        .not('ExternalId', 'in', `(${batch.map(id => `"${String(id).replace(/"/g, '')}"`).join(',')})`)
        .select('Id', { count: 'exact', head: true });

      archived += count || 0;
    }

    if (archived > 0) {
      console.log(`🗄️ Archived ${archived} removed offers`);
    }
    return archived;
  }
}

module.exports = XMLImporter;
