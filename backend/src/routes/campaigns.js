const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db/db');

const parseJSON = (val) => {
  if (!val) return [];
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return []; }
};

router.get('/', async (_req, res) => {
  try {
    await poolConnect;
    const r = await pool.request().query(`SELECT * FROM Campaigns ORDER BY CreatedAt DESC`);
    const rows = r.recordset.map(c => ({ ...c, Channels: parseJSON(c.Channels) }));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error listando campañas', details: e.message });
  }
});

router.post('/', async (req, res) => {
  const {
    name, description = '', segmentId,
    distributionType = 'automatic',
    startDate = null, endDate = null,
    budget = null, targetApplications = null, maxCPA = null,
    channels = [], bidStrategy = 'automatic', manualBid = null,
    priority = 'medium', autoOptimization = true
  } = req.body || {};
  if (!name || !segmentId) return res.status(400).json({ error: 'name y segmentId son requeridos' });

  try {
    await poolConnect;
    const now = new Date();
    const ins = await pool.request()
      .input('Name', sql.NVarChar(255), name)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('SegmentId', sql.Int, segmentId)
      .input('DistributionType', sql.NVarChar(50), distributionType)
      .input('StartDate', sql.DateTime, startDate ? new Date(startDate) : null)
      .input('EndDate', sql.DateTime, endDate ? new Date(endDate) : null)
      .input('Budget', sql.Decimal(12,2), budget)
      .input('TargetApplications', sql.Int, targetApplications)
      .input('MaxCPA', sql.Decimal(12,2), maxCPA)
      .input('Channels', sql.NVarChar(sql.MAX), JSON.stringify(parseJSON(channels)))
      .input('BidStrategy', sql.NVarChar(50), bidStrategy)
      .input('ManualBid', sql.Decimal(12,2), manualBid)
      .input('Priority', sql.NVarChar(20), priority)
      .input('AutoOptimization', sql.Bit, !!autoOptimization)
      .input('Status', sql.NVarChar(50), 'active')
      .input('CreatedAt', sql.DateTime, now)
      .input('UpdatedAt', sql.DateTime, now)
      .query(`
        INSERT INTO Campaigns
        (Name, Description, SegmentId, DistributionType, StartDate, EndDate, Budget, TargetApplications, MaxCPA, Channels, BidStrategy, ManualBid, Priority, AutoOptimization, Status, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES
        (@Name, @Description, @SegmentId, @DistributionType, @StartDate, @EndDate, @Budget, @TargetApplications, @MaxCPA, @Channels, @BidStrategy, @ManualBid, @Priority, @AutoOptimization, @Status, @CreatedAt, @UpdatedAt)
      `);
    const row = ins.recordset[0];
    res.status(201).json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error creando campaña', details: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const r = await pool.request().input('Id', sql.Int, id).query(`SELECT * FROM Campaigns WHERE Id=@Id`);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const row = r.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error obteniendo campaña', details: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const cur = await pool.request().input('Id', sql.Int, id).query(`SELECT * FROM Campaigns WHERE Id=@Id`);
    if (cur.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const prev = cur.recordset[0];

    const body = req.body || {};
    const upd = {
      Name: body.name ?? prev.Name,
      Description: body.description ?? prev.Description,
      SegmentId: body.segmentId ?? prev.SegmentId,
      DistributionType: body.distributionType ?? prev.DistributionType,
      StartDate: body.startDate ? new Date(body.startDate) : prev.StartDate,
      EndDate: body.endDate ? new Date(body.endDate) : prev.EndDate,
      Budget: body.budget ?? prev.Budget,
      TargetApplications: body.targetApplications ?? prev.TargetApplications,
      MaxCPA: body.maxCPA ?? prev.MaxCPA,
      Channels: body.channels ? JSON.stringify(parseJSON(body.channels)) : prev.Channels,
      BidStrategy: body.bidStrategy ?? prev.BidStrategy,
      ManualBid: body.manualBid ?? prev.ManualBid,
      Priority: body.priority ?? prev.Priority,
      AutoOptimization: typeof body.autoOptimization === 'boolean' ? body.autoOptimization : prev.AutoOptimization,
      Status: body.status ?? prev.Status
    };

    const u = await pool.request()
      .input('Id', sql.Int, id)
      .input('Name', sql.NVarChar(255), upd.Name)
      .input('Description', sql.NVarChar(sql.MAX), upd.Description)
      .input('SegmentId', sql.Int, upd.SegmentId)
      .input('DistributionType', sql.NVarChar(50), upd.DistributionType)
      .input('StartDate', sql.DateTime, upd.StartDate)
      .input('EndDate', sql.DateTime, upd.EndDate)
      .input('Budget', sql.Decimal(12,2), upd.Budget)
      .input('TargetApplications', sql.Int, upd.TargetApplications)
      .input('MaxCPA', sql.Decimal(12,2), upd.MaxCPA)
      .input('Channels', sql.NVarChar(sql.MAX), upd.Channels)
      .input('BidStrategy', sql.NVarChar(50), upd.BidStrategy)
      .input('ManualBid', sql.Decimal(12,2), upd.ManualBid)
      .input('Priority', sql.NVarChar(20), upd.Priority)
      .input('AutoOptimization', sql.Bit, upd.AutoOptimization)
      .input('Status', sql.NVarChar(50), upd.Status)
      .query(`
        UPDATE Campaigns
        SET Name=@Name, Description=@Description, SegmentId=@SegmentId, DistributionType=@DistributionType,
            StartDate=@StartDate, EndDate=@EndDate, Budget=@Budget, TargetApplications=@TargetApplications, MaxCPA=@MaxCPA,
            Channels=@Channels, BidStrategy=@BidStrategy, ManualBid=@ManualBid, Priority=@Priority,
            AutoOptimization=@AutoOptimization, Status=@Status, UpdatedAt=GETDATE()
        WHERE Id=@Id;
        SELECT * FROM Campaigns WHERE Id=@Id;
      `);

    const row = u.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error actualizando campaña', details: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const del = await pool.request().input('Id', sql.Int, id).query(`DELETE FROM Campaigns WHERE Id=@Id`);
    if (del.rowsAffected[0] === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error eliminando campaña', details: e.message });
  }
});

router.post('/:id/pause', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const u = await pool.request()
      .input('Id', sql.Int, id)
      .query(`UPDATE Campaigns SET Status='paused', UpdatedAt=GETDATE() WHERE Id=@Id; SELECT * FROM Campaigns WHERE Id=@Id`);
    if (u.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const row = u.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error al pausar campaña', details: e.message });
  }
});

router.post('/:id/resume', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const u = await pool.request()
      .input('Id', sql.Int, id)
      .query(`UPDATE Campaigns SET Status='active', UpdatedAt=GETDATE() WHERE Id=@Id; SELECT * FROM Campaigns WHERE Id=@Id`);
    if (u.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const row = u.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error al reanudar campaña', details: e.message });
  }
});

module.exports = router;
