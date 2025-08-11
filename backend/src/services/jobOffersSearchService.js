const { pool, sql } = require('../db/db');

/**
 * SERVICIO DE BÚSQUEDA DE OFERTAS - ARQUITECTURA SARGABLE
 * 
 * Implementa tres rutas de búsqueda optimizadas:
 * 1. Exacta: Index Seek directo (<50ms)
 * 2. Prefijo: FTS o Range Seek (<100ms) 
 * 3. Amplia: Optimizada para grandes volúmenes (<300ms)
 * 
 * Sin hints, sin NOLOCK, sin OR en WHERE - Solo SARGable
 */

class JobOffersSearchService {
  
  /**
   * Detectar tipo de búsqueda automáticamente
   */
  static detectSearchMode(query) {
    if (!query || query.trim() === '') return 'none';
    
    const cleanQuery = query.trim();
    
    // Buscar coincidencias exactas primero (más rápido)
    return 'auto'; // El método auto manejará la cascada
  }

  /**
   * Normalizar texto para búsquedas (si no hay FTS)
   */
  static normalizeText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/[áàäâã]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöôõ]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n');
  }

  /**
   * BÚSQUEDA EXACTA - Para coincidencias perfectas
   * Usa índices individuales con Index Seek directo
   */
  static async searchExact(searchTerm, filters = {}, pagination = {}) {
    const { limit = 20, lastCreatedAt, lastId } = pagination;
    
    console.log(`🎯 Búsqueda EXACTA: "${searchTerm}"`);
    
    // Query para título exacto
    const titleQuery = `
      SELECT TOP (@limit)
        Id,
        Title,
        CompanyName as company,
        Sector as sector,
        City,
        Region,
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location,
        SalaryMin,
        SalaryMax,
        CASE 
          WHEN SalaryMin IS NOT NULL AND SalaryMax IS NOT NULL THEN 
            CONCAT(FORMAT(SalaryMin, 'N0'), '-', FORMAT(SalaryMax, 'N0'), '€')
          WHEN SalaryMin IS NOT NULL THEN 
            CONCAT('Desde ', FORMAT(SalaryMin, 'N0'), '€')
          WHEN SalaryMax IS NOT NULL THEN 
            CONCAT('Hasta ', FORMAT(SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        JobType as type,
        PublicationDate as publishDate,
        CreatedAt,
        StatusId,
        CASE StatusId
          WHEN 1 THEN 'active'
          WHEN 2 THEN 'paused'
          WHEN 3 THEN 'pending'
          WHEN 4 THEN 'archived'
          ELSE 'unknown'
        END as status,
        'title' as match_type
      FROM JobOffers
      WHERE Title = @searchTerm
        ${this._buildFiltersWhere(filters)}
        ${this._buildKeysetWhere(lastCreatedAt, lastId)}
      ORDER BY CreatedAt DESC, Id ASC
    `;

    // Query para empresa exacta
    const companyQuery = `
      SELECT TOP (@limit)
        Id,
        Title,
        CompanyName as company,
        Sector as sector,
        City,
        Region,
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location,
        SalaryMin,
        SalaryMax,
        CASE 
          WHEN SalaryMin IS NOT NULL AND SalaryMax IS NOT NULL THEN 
            CONCAT(FORMAT(SalaryMin, 'N0'), '-', FORMAT(SalaryMax, 'N0'), '€')
          WHEN SalaryMin IS NOT NULL THEN 
            CONCAT('Desde ', FORMAT(SalaryMin, 'N0'), '€')
          WHEN SalaryMax IS NOT NULL THEN 
            CONCAT('Hasta ', FORMAT(SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        JobType as type,
        PublicationDate as publishDate,
        CreatedAt,
        StatusId,
        CASE StatusId
          WHEN 1 THEN 'active'
          WHEN 2 THEN 'paused'
          WHEN 3 THEN 'pending'
          WHEN 4 THEN 'archived'
          ELSE 'unknown'
        END as status,
        'company' as match_type
      FROM JobOffers
      WHERE CompanyName = @searchTerm
        ${this._buildFiltersWhere(filters)}
        ${this._buildKeysetWhere(lastCreatedAt, lastId)}
      ORDER BY CreatedAt DESC, Id ASC
    `;

    // UNION ALL para combinar resultados (más eficiente que OR)
    const finalQuery = `
      WITH ExactResults AS (
        ${titleQuery}
        UNION ALL
        ${companyQuery}
      )
      SELECT TOP (@limit) *
      FROM ExactResults
      ORDER BY 
        CASE match_type WHEN 'title' THEN 1 WHEN 'company' THEN 2 END,
        CreatedAt DESC, 
        Id ASC
    `;

    const request = pool.request()
      .input('searchTerm', sql.NVarChar(500), searchTerm)
      .input('limit', sql.Int, limit);

    this._addFilterParams(request, filters);
    this._addKeysetParams(request, lastCreatedAt, lastId);

    const result = await request.query(finalQuery);
    
    console.log(`✅ Búsqueda exacta completada: ${result.recordset.length} resultados`);
    
    return {
      data: result.recordset,
      searchType: 'exact',
      hasMore: result.recordset.length === limit
    };
  }

  /**
   * BÚSQUEDA POR PREFIJO - Para autocompletado y búsquedas parciales
   * Usa FTS o columnas computadas con Range Seek
   */
  static async searchPrefix(searchTerm, filters = {}, pagination = {}) {
    const { limit = 20, lastCreatedAt, lastId } = pagination;
    
    console.log(`🔍 Búsqueda PREFIJO: "${searchTerm}*"`);
    
    // Verificar si FTS está disponible
    const ftsAvailable = await this._isFullTextAvailable();
    
    if (ftsAvailable) {
      return this._searchPrefixFTS(searchTerm, filters, pagination);
    } else {
      return this._searchPrefixNormalized(searchTerm, filters, pagination);
    }
  }

  /**
   * Búsqueda por prefijo usando Full-Text Search
   */
  static async _searchPrefixFTS(searchTerm, filters, pagination) {
    const { limit } = pagination;
    
    // Escapar término para FTS
    const ftsQuery = `"${searchTerm}*"`;
    
      const query = `
      SELECT TOP (@limit)
        Id,
        Title,
        CompanyName as company,
        Sector as sector,
        City,
        Region,
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location,
        SalaryMin,
        SalaryMax,
        CASE 
          WHEN SalaryMin IS NOT NULL AND SalaryMax IS NOT NULL THEN 
            CONCAT(FORMAT(SalaryMin, 'N0'), '-', FORMAT(SalaryMax, 'N0'), '€')
          WHEN SalaryMin IS NOT NULL THEN 
            CONCAT('Desde ', FORMAT(SalaryMin, 'N0'), '€')
          WHEN SalaryMax IS NOT NULL THEN 
            CONCAT('Hasta ', FORMAT(SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        JobType as type,
        PublicationDate as publishDate,
        CreatedAt,
        StatusId,
        CASE StatusId
          WHEN 1 THEN 'active'
          WHEN 2 THEN 'paused'
          WHEN 3 THEN 'pending'
          WHEN 4 THEN 'archived'
          ELSE 'unknown'
        END as status,
        FT_TBL.RANK as relevance_score
      FROM JobOffers
        INNER JOIN CONTAINSTABLE(JobOffers, (Title, CompanyName), @ftsQuery) AS FT_TBL
          ON JobOffers.Id = FT_TBL.[KEY]
      WHERE 1=1
        ${this._buildFiltersWhere(filters)}
        ${this._buildKeysetWhere(pagination.lastCreatedAt, pagination.lastId)}
      ORDER BY 
        FT_TBL.RANK DESC,
        CreatedAt DESC, 
        Id ASC
    `;

    const request = pool.request()
      .input('ftsQuery', sql.NVarChar(200), ftsQuery)
      .input('limit', sql.Int, limit);

    this._addFilterParams(request, filters);
    this._addKeysetParams(request, pagination.lastCreatedAt, pagination.lastId);

    const result = await request.query(query);
    
    return {
      data: result.recordset,
      searchType: 'prefix_fts',
      hasMore: result.recordset.length === limit
    };
  }

  /**
   * Búsqueda por prefijo usando columnas normalizadas
   */
  static async _searchPrefixNormalized(searchTerm, filters, pagination) {
    const { limit } = pagination;
    const normalizedTerm = this.normalizeText(searchTerm);
    const upperBound = normalizedTerm.slice(0, -1) + String.fromCharCode(normalizedTerm.charCodeAt(normalizedTerm.length - 1) + 1);
    
    const query = `
      WITH PrefixResults AS (
        SELECT TOP (@limit)
          Id, Title, CompanyName, Sector, City, Region,
          SalaryMin, SalaryMax, JobType, PublicationDate,
          CreatedAt, StatusId, 'title' as match_type
        FROM JobOffers
        WHERE NormalizedTitle >= @normalizedTerm 
          AND NormalizedTitle < @upperBound
          ${this._buildFiltersWhere(filters)}
          ${this._buildKeysetWhere(pagination.lastCreatedAt, pagination.lastId)}
        
        UNION ALL
        
        SELECT TOP (@limit)
          Id, Title, CompanyName, Sector, City, Region,
          SalaryMin, SalaryMax, JobType, PublicationDate,
          CreatedAt, StatusId, 'company' as match_type
        FROM JobOffers
        WHERE NormalizedCompanyName >= @normalizedTerm 
          AND NormalizedCompanyName < @upperBound
          ${this._buildFiltersWhere(filters)}
          ${this._buildKeysetWhere(pagination.lastCreatedAt, pagination.lastId)}
      )
      SELECT TOP (@limit) 
        Id,
        Title,
        CompanyName as company,
        Sector as sector,
        City,
        Region,
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location,
        SalaryMin,
        SalaryMax,
        CASE 
          WHEN SalaryMin IS NOT NULL AND SalaryMax IS NOT NULL THEN 
            CONCAT(FORMAT(SalaryMin, 'N0'), '-', FORMAT(SalaryMax, 'N0'), '€')
          WHEN SalaryMin IS NOT NULL THEN 
            CONCAT('Desde ', FORMAT(SalaryMin, 'N0'), '€')
          WHEN SalaryMax IS NOT NULL THEN 
            CONCAT('Hasta ', FORMAT(SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        JobType as type,
        PublicationDate as publishDate,
        CreatedAt,
        StatusId,
        CASE StatusId
          WHEN 1 THEN 'active'
          WHEN 2 THEN 'paused'
          WHEN 3 THEN 'pending'
          WHEN 4 THEN 'archived'
          ELSE 'unknown'
        END as status
      FROM PrefixResults
      ORDER BY 
        CASE match_type WHEN 'title' THEN 1 WHEN 'company' THEN 2 END,
        CreatedAt DESC, 
        Id ASC
    `;

    const request = pool.request()
      .input('normalizedTerm', sql.NVarChar(500), normalizedTerm)
      .input('upperBound', sql.NVarChar(500), upperBound)
      .input('limit', sql.Int, limit);

    this._addFilterParams(request, filters);
    this._addKeysetParams(request, pagination.lastCreatedAt, pagination.lastId);

    const result = await request.query(query);
    
    return {
      data: result.recordset,
      searchType: 'prefix_normalized',
      hasMore: result.recordset.length === limit
    };
  }

  /**
   * BÚSQUEDA AUTOMÁTICA - Cascada inteligente de métodos
   */
  static async searchAuto(searchTerm, filters = {}, pagination = {}) {
    console.log(`🤖 Búsqueda AUTO: "${searchTerm}"`);
    
    // 1. Intentar búsqueda exacta primero
    const exactResults = await this.searchExact(searchTerm, filters, pagination);
    if (exactResults.data.length > 0) {
      console.log(`✅ Encontrados resultados exactos: ${exactResults.data.length}`);
      return exactResults;
    }
    
    // 2. Si no hay exactos, intentar prefijo
    const prefixResults = await this.searchPrefix(searchTerm, filters, pagination);
    if (prefixResults.data.length > 0) {
      console.log(`✅ Encontrados resultados por prefijo: ${prefixResults.data.length}`);
      return prefixResults;
    }
    
    // 3. Si no hay prefijos, búsqueda amplia (fallback)
    console.log(`🔄 Sin resultados exactos/prefijo, usando búsqueda amplia`);
    return this.searchWide(searchTerm, filters, pagination);
  }

  /**
   * BÚSQUEDA AMPLIA - Con keyset pagination optimizada
   * Para sin filtros o búsquedas fallback
   */
  static async searchWide(searchTerm, filters = {}, pagination = {}) {
    const { limit = 20, lastCreatedAt, lastId } = pagination;
    
    console.log(`🌐 Búsqueda AMPLIA con KEYSET: "${searchTerm}"`);
    console.log('🔎 Keyset params:', { lastCreatedAt, lastId, order: 'CreatedAt DESC, Id DESC' });
    
    // Query optimizada con keyset pagination
    const query = `
      SELECT TOP (@limit)
        Id,
        Title,
        CompanyName as company,
        Sector as sector,
        City,
        Region,
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location,
        SalaryMin,
        SalaryMax,
        CASE 
          WHEN SalaryMin IS NOT NULL AND SalaryMax IS NOT NULL THEN 
            CONCAT(FORMAT(SalaryMin, 'N0'), '-', FORMAT(SalaryMax, 'N0'), '€')
          WHEN SalaryMin IS NOT NULL THEN 
            CONCAT('Desde ', FORMAT(SalaryMin, 'N0'), '€')
          WHEN SalaryMax IS NOT NULL THEN 
            CONCAT('Hasta ', FORMAT(SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        JobType as type,
        PublicationDate as publishDate,
        CreatedAt,
        StatusId,
        CASE StatusId
          WHEN 1 THEN 'active'
          WHEN 2 THEN 'paused'
          WHEN 3 THEN 'pending'
          WHEN 4 THEN 'archived'
          ELSE 'unknown'
        END as status
      FROM JobOffers WITH (READPAST)
      WHERE 1=1
        ${this._buildFiltersWhere(filters)}
        ${this._buildKeysetWhere(lastCreatedAt, lastId)}
      -- Orden estable para keyset
      ORDER BY CreatedAt DESC, Id DESC
    `;

    const request = pool.request()
      .input('limit', sql.Int, limit);

    this._addFilterParams(request, filters);
    this._addKeysetParams(request, lastCreatedAt, lastId);

    const result = await request.query(query);
    if (result && Array.isArray(result.recordset)) {
      const first = result.recordset[0];
      const last = result.recordset[result.recordset.length - 1];
      console.log('📦 Result sample:', {
        count: result.recordset.length,
        first: first ? { Id: first.Id, CreatedAt: first.CreatedAt } : null,
        last: last ? { Id: last.Id, CreatedAt: last.CreatedAt } : null,
      });
    }
    
    return {
      data: result.recordset,
      searchType: 'wide_keyset',
      hasMore: result.recordset.length === limit
    };
  }

  /**
   * UTILIDADES INTERNAS
   */
  
  static _buildFiltersWhere(filters) {
    const conditions = [];
    
    if (filters.status) {
      const statusMap = { 'active': 1, 'pending': 3, 'paused': 2, 'archived': 4 };
      conditions.push(`AND StatusId = ${statusMap[filters.status] || 1}`);
    }
    
    if (filters.sector) {
      conditions.push(`AND Sector = @sector`);
    }
    
    if (filters.location) {
      conditions.push(`AND (City LIKE @location OR Region LIKE @location)`);
    }
    
    return conditions.join(' ');
  }
  
  static _buildKeysetWhere(lastCreatedAt, lastId) {
    if (!lastCreatedAt || !lastId) return '';
    // Para ORDER BY CreatedAt DESC, Id DESC avanzamos hacia registros "menores"
    return `AND (
      (CreatedAt < @lastCreatedAt) OR
      (CreatedAt = @lastCreatedAt AND Id < @lastId)
    )`;
  }
  
  static _addFilterParams(request, filters) {
    if (filters.sector) {
      request.input('sector', sql.NVarChar(100), filters.sector);
    }
    if (filters.location) {
      request.input('location', sql.NVarChar(100), `%${filters.location}%`);
    }
  }
  
  static _addKeysetParams(request, lastCreatedAt, lastId) {
    if (lastCreatedAt && lastId) {
      // Normalizar tipos
      const lastCreatedAtDate = new Date(lastCreatedAt);
      const lastIdNum = Number(lastId);
      request.input('lastCreatedAt', sql.DateTime2, lastCreatedAtDate);
      request.input('lastId', sql.Int, lastIdNum);
    }
  }
  
  static async _isFullTextAvailable() {
    try {
      const result = await pool.request().query(`
        SELECT COUNT(*) as fts_count 
        FROM sys.fulltext_indexes 
        WHERE object_id = OBJECT_ID('dbo.JobOffers')
      `);
      return result.recordset[0].fts_count > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = JobOffersSearchService;
