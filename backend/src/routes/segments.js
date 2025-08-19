const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db/db');
const { addUserToRequest, requireAuth, onlyOwnData, isSuperAdmin } = require('../middleware/authMiddleware');

const parseFilters = (filters) => {
  if (!filters) return { jobTitles: [], locations: [], sectors: [], experienceLevels: [], contractTypes: [], companies: [] };
  try {
    const f = typeof filters === 'string' ? JSON.parse(filters) : filters;
    return {
      jobTitles: f.jobTitles || [],
      locations: f.locations || [],
      sectors: f.sectors || [],
      experienceLevels: f.experienceLevels || [],
      contractTypes: f.contractTypes || [],
      companies: f.companies || [],
    };
  } catch {
    return { jobTitles: [], locations: [], sectors: [], experienceLevels: [], contractTypes: [], companies: [] };
  }
};

// SOLO activas; locations -> City/Region/concat; sectors -> Sector; companies -> CompanyName; jobTitles opcional
function buildWhereFromFilters(f, sql) {
  const where = [];
  const inputs = [];

  if (Array.isArray(f.jobTitles) && f.jobTitles.length > 0) {
    const parts = [];
    f.jobTitles.slice(0, 5).forEach((t, i) => {
      parts.push(`Title LIKE @jt${i} OR CompanyName LIKE @jt${i}`);
      inputs.push({ name: `jt${i}`, type: sql.NVarChar, value: `%${t}%` });
    });
    where.push(`(${parts.join(' OR ')})`);
  }

  if (Array.isArray(f.locations) && f.locations.length > 0) {
    const parts = [];
    f.locations.slice(0, 5).forEach((loc, i) => {
      parts.push(`City = @locExact${i} OR Region = @locExact${i} OR
        (CASE WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
              THEN CONCAT(City, ', ', Region)
              WHEN City IS NOT NULL THEN City ELSE Region END) = @locExact${i}
        OR City LIKE @loc${i} OR Region LIKE @loc${i} OR
        (CASE WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
              THEN CONCAT(City, ', ', Region)
              WHEN City IS NOT NULL THEN City ELSE Region END) LIKE @loc${i}`);
      inputs.push({ name: `locExact${i}`, type: sql.NVarChar, value: loc });
      inputs.push({ name: `loc${i}`, type: sql.NVarChar, value: `%${loc}%` });
    });
    where.push(`(${parts.join(' OR ')})`);
  }

  if (Array.isArray(f.sectors) && f.sectors.length > 0) {
    const parts = [];
    f.sectors.slice(0, 5).forEach((s, i) => {
      parts.push(`Sector = @secExact${i} OR Sector LIKE @sec${i}`);
      inputs.push({ name: `secExact${i}`, type: sql.NVarChar, value: s });
      inputs.push({ name: `sec${i}`, type: sql.NVarChar, value: `%${s}%` });
    });
    where.push(`(${parts.join(' OR ')})`);
  }

  if (Array.isArray(f.companies) && f.companies.length > 0) {
    const parts = [];
    f.companies.slice(0, 5).forEach((c, i) => {
      parts.push(`CompanyName = @compExact${i} OR CompanyName LIKE @comp${i}`);
      inputs.push({ name: `compExact${i}`, type: sql.NVarChar, value: c });
      inputs.push({ name: `comp${i}`, type: sql.NVarChar, value: `%${c}%` });
    });
    where.push(`(${parts.join(' OR ')})`);
  }

  // SOLO ofertas activas
  where.push(`StatusId = 1`);
  return { where, inputs };
}

router.get('/', addUserToRequest, requireAuth, onlyOwnData(), async (req, res) => {
  try {
    await poolConnect;
    
    // Construir query con filtrado por usuario
    let query = `
      SELECT 
        s.Id, s.Name, s.Description, s.Filters, s.Status, s.OfferCount, s.CreatedAt, s.UpdatedAt,
        COALESCE(c.CampaignCount, 0) AS Campaigns,
        CASE WHEN COALESCE(c.CampaignCount, 0) > 0 THEN 1 ELSE 0 END AS HasCampaigns
      FROM Segments s
      LEFT JOIN (
        SELECT SegmentId, COUNT(*) AS CampaignCount
        FROM Campaigns
        WHERE Status IN ('active', 'scheduled', 'paused')`;
    
    const request = pool.request();
    
    console.log(`🔍 Segments DEBUG: req.userId = ${req.userId}, req.user.role = ${req.user.role}`);
    console.log(`🔍 Segments DEBUG: isSuperAdmin(req) = ${isSuperAdmin(req)}`);
    
    // Super admin puede ver todos los segmentos, usuarios normales solo los suyos
    if (!isSuperAdmin(req)) {
      query += ` AND UserId = @userId`;
      request.input('userId', sql.BigInt, req.userId);
      console.log(`🔍 Segments: Agregando filtro UserId = ${req.userId} en subquery`);
    } else {
      console.log(`🔍 Segments: Super admin - sin filtro en subquery`);
    }
    
    query += `
        GROUP BY SegmentId
      ) c ON s.Id = c.SegmentId`;
    
    // Filtrar segmentos por usuario (DEFINITIVO)
    if (!isSuperAdmin(req)) {
      query += ` WHERE s.UserId = @userIdSegments`;
      request.input('userIdSegments', sql.BigInt, req.userId);
      console.log(`🔍 Segments: Agregando filtro WHERE s.UserId = ${req.userId}`);
    } else {
      console.log(`🔍 Segments: Super admin - sin filtro WHERE`);
    }
    
    query += ` ORDER BY s.UpdatedAt DESC`;
    
    console.log(`🔍 Segments query para usuario ${req.userId} (${req.user.role}): ${isSuperAdmin(req) ? 'TODOS' : 'FILTRADO'}`);
    console.log(`🔍 Segments query final:`, query);
    
    const result = await request.query(query);
    const rows = result.recordset.map(r => ({ ...r, Filters: parseFilters(r.Filters) }));
    res.json(rows);
  } catch (e) {
    console.error('❌ Error listando segmentos:', e.message);
    res.status(500).json({ error: 'Error listando segmentos', details: e.message });
  }
});

router.post('/', addUserToRequest, requireAuth, async (req, res) => {
  const { name, description = '', filters = {}, status = 'active' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Campo "name" es requerido' });
  try {
    await poolConnect;
    const f = parseFilters(filters);
    const { where, inputs } = buildWhereFromFilters(f, sql);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const reqSql = pool.request(); inputs.forEach(p => reqSql.input(p.name, p.type, p.value));
    const countRes = await reqSql.query(`SELECT COUNT(*) AS total FROM JobOffers WITH (READPAST) ${whereClause}`);
    const offerCount = countRes.recordset[0].total || 0;

    const now = new Date();
    const insert = await pool.request()
      .input('Name', sql.NVarChar(255), name)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('Filters', sql.NVarChar(sql.MAX), JSON.stringify(f))
      .input('Status', sql.NVarChar(50), status)
      .input('OfferCount', sql.Int, offerCount)
      .input('CreatedAt', sql.DateTime, now)
      .input('UpdatedAt', sql.DateTime, now)
      .query(`
        INSERT INTO Segments (Name, Description, Filters, Status, OfferCount, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES (@Name, @Description, @Filters, @Status, @OfferCount, @CreatedAt, @UpdatedAt)
      `);
    const row = insert.recordset[0];
    res.status(201).json({ ...row, Filters: parseFilters(row.Filters) });
  } catch (e) {
    res.status(500).json({ error: 'Error creando segmento', details: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const r = await pool.request().input('Id', sql.Int, id).query(`SELECT * FROM Segments WHERE Id = @Id`);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Segmento no encontrado' });
    const row = r.recordset[0];
    res.json({ ...row, Filters: parseFilters(row.Filters) });
  } catch (e) {
    res.status(500).json({ error: 'Error obteniendo segmento', details: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, filters, status } = req.body || {};
  try {
    await poolConnect;
    const existing = await pool.request().input('Id', sql.Int, id).query(`SELECT * FROM Segments WHERE Id = @Id`);
    if (existing.recordset.length === 0) return res.status(404).json({ error: 'Segmento no encontrado' });
    const prev = existing.recordset[0];

    const newFilters = filters ? parseFilters(filters) : parseFilters(prev.Filters);
    const { where, inputs } = buildWhereFromFilters(newFilters, sql);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const reqSql = pool.request(); inputs.forEach(p => reqSql.input(p.name, p.type, p.value));
    const countRes = await reqSql.query(`SELECT COUNT(*) AS total FROM JobOffers WITH (READPAST) ${whereClause}`);
    const offerCount = countRes.recordset[0].total || 0;

    const u = await pool.request()
      .input('Id', sql.Int, id)
      .input('Name', sql.NVarChar(255), name ?? prev.Name)
      .input('Description', sql.NVarChar(sql.MAX), description ?? prev.Description)
      .input('Filters', sql.NVarChar(sql.MAX), filters ? JSON.stringify(newFilters) : prev.Filters)
      .input('Status', sql.NVarChar(50), status ?? prev.Status)
      .input('OfferCount', sql.Int, offerCount)
      .query(`
        UPDATE Segments
        SET Name=@Name, Description=@Description, Filters=@Filters, Status=@Status, OfferCount=@OfferCount, UpdatedAt=GETDATE()
        WHERE Id=@Id;
        SELECT * FROM Segments WHERE Id=@Id;
      `);
    const row = u.recordset[0];
    res.json({ ...row, Filters: parseFilters(row.Filters) });
  } catch (e) {
    res.status(500).json({ error: 'Error actualizando segmento', details: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const c = await pool.request().input('Id', sql.Int, id).query(`SELECT COUNT(*) AS n FROM Campaigns WHERE SegmentId=@Id`);
    if (c.recordset[0].n > 0) return res.status(409).json({ error: 'No se puede eliminar: hay campañas asociadas' });
    const del = await pool.request().input('Id', sql.Int, id).query(`DELETE FROM Segments WHERE Id=@Id`);
    if (del.rowsAffected[0] === 0) return res.status(404).json({ error: 'Segmento no encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error eliminando segmento', details: e.message });
  }
});

// Estimación por id
router.get('/:id/estimate', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const r = await pool.request().input('Id', sql.Int, id).query(`SELECT Filters FROM Segments WHERE Id=@Id`);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Segmento no encontrado' });
    const f = parseFilters(r.recordset[0].Filters);
    const { where, inputs } = buildWhereFromFilters(f, sql);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const reqSql = pool.request(); inputs.forEach(p => reqSql.input(p.name, p.type, p.value));
    const result = await reqSql.query(`SELECT COUNT(*) AS total FROM JobOffers WITH (READPAST) ${whereClause}`);
    res.json({ success: true, count: result.recordset[0].total || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Error estimando ofertas', details: e.message });
  }
});

// Estimación para preview (sin guardar)
router.post('/estimate-preview', async (req, res) => {
  const filters = parseFilters(req.body?.filters || {});
  try {
    await poolConnect;
    const { where, inputs } = buildWhereFromFilters(filters, sql);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const reqSql = pool.request(); inputs.forEach(p => reqSql.input(p.name, p.type, p.value));
    const result = await reqSql.query(`SELECT COUNT(*) AS total FROM JobOffers WITH (READPAST) ${whereClause}`);
    res.json({ success: true, count: result.recordset[0].total || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Error en estimate-preview', details: e.message });
  }
});

// Recalcular ofertas de un segmento específico
router.post('/:id/recalculate', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    
    // Obtener el segmento
    const segmentResult = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Id, Name, Filters FROM Segments WHERE Id = @Id');
      
    if (segmentResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Segmento no encontrado' });
    }
    
    const segment = segmentResult.recordset[0];
    const filters = parseFilters(segment.Filters);
    
    // Recalcular el número de ofertas
    const { where, inputs } = buildWhereFromFilters(filters, sql);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const reqSql = pool.request();
    inputs.forEach(p => reqSql.input(p.name, p.type, p.value));
    const countResult = await reqSql.query(`SELECT COUNT(*) AS total FROM JobOffers WITH (READPAST) ${whereClause}`);
    const newOfferCount = countResult.recordset[0].total || 0;
    
    // Actualizar el segmento con el nuevo contador
    const updateResult = await pool.request()
      .input('Id', sql.Int, id)
      .input('OfferCount', sql.Int, newOfferCount)
      .input('UpdatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Segments 
        SET OfferCount = @OfferCount, UpdatedAt = @UpdatedAt 
        WHERE Id = @Id;
        
        SELECT Id, Name, OfferCount, UpdatedAt FROM Segments WHERE Id = @Id;
      `);
    
    const updated = updateResult.recordset[0];
    res.json({ 
      success: true, 
      message: `Segmento "${segment.Name}" recalculado exitosamente`,
      data: {
        id: updated.Id,
        name: updated.Name,
        oldCount: segment.OfferCount || 0,
        newCount: updated.OfferCount,
        updatedAt: updated.UpdatedAt
      }
    });
    
  } catch (e) {
    res.status(500).json({ error: 'Error recalculando segmento', details: e.message });
  }
});

// Duplicar un segmento
router.post('/:id/duplicate', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name } = req.body || {};
  
  try {
    await poolConnect;
    
    // Obtener el segmento original
    const originalResult = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT * FROM Segments WHERE Id = @Id');
      
    if (originalResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Segmento no encontrado' });
    }
    
    const original = originalResult.recordset[0];
    const duplicateName = name || `${original.Name} (Copia)`;
    
    // Recalcular ofertas para el duplicado
    const filters = parseFilters(original.Filters);
    const { where, inputs } = buildWhereFromFilters(filters, sql);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const reqSql = pool.request();
    inputs.forEach(p => reqSql.input(p.name, p.type, p.value));
    const countResult = await reqSql.query(`SELECT COUNT(*) AS total FROM JobOffers WITH (READPAST) ${whereClause}`);
    const offerCount = countResult.recordset[0].total || 0;
    
    // Crear el duplicado
    const now = new Date();
    const insertResult = await pool.request()
      .input('Name', sql.NVarChar(255), duplicateName)
      .input('Description', sql.NVarChar(sql.MAX), `${original.Description || ''} (Duplicado)`)
      .input('Filters', sql.NVarChar(sql.MAX), original.Filters)
      .input('Status', sql.NVarChar(50), 'active')
      .input('OfferCount', sql.Int, offerCount)
      .input('CreatedAt', sql.DateTime, now)
      .input('UpdatedAt', sql.DateTime, now)
      .query(`
        INSERT INTO Segments (Name, Description, Filters, Status, OfferCount, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES (@Name, @Description, @Filters, @Status, @OfferCount, @CreatedAt, @UpdatedAt)
      `);
    
    const duplicated = insertResult.recordset[0];
    res.status(201).json({
      success: true,
      message: `Segmento duplicado exitosamente como "${duplicateName}"`,
      data: { ...duplicated, Filters: parseFilters(duplicated.Filters) }
    });
    
  } catch (e) {
    res.status(500).json({ error: 'Error duplicando segmento', details: e.message });
  }
});

module.exports = router;
