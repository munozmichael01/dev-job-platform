const express = require('express');
const router = express.Router();
const { saveMapping, getMapping } = require('../controllers/importOffers');

// POST /api/mappings - Guardar mapeo
router.post('/', saveMapping);

// GET /api/mappings/connection/:connectionId - Obtener mapeo de una conexión
router.get('/connection/:connectionId', getMapping);

module.exports = router; 