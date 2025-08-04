const { pool, sql } = require('../db/db');
const XMLProcessor = require('../processors/xmlProcessor');
const APIProcessor = require('../processors/apiProcessor');

// Función para validar el formato de los datos
function validateData(data) {
    const requiredFields = ['ConnectionId', 'SourceField', 'TargetField', 'TransformationType'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (!['STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ARRAY'].includes(data.TransformationType)) {
        throw new Error('Invalid TransformationType. Must be one of: STRING, NUMBER, DATE, BOOLEAN, ARRAY');
    }
}

// Función para validar el mapeo completo
function validateMapping(mappings) {
    const requiredTargetFields = [
        'Title',
        'JobTitle',
        'Description',
        'CompanyName',
        'Sector',
        'Address',
        'Country',
        'Region',
        'City',
        'Postcode',
        'Latitude',
        'Longitude',
        'Vacancies',
        'SalaryMin',
        'SalaryMax',
        'JobType',
        'ExternalUrl',
        'ApplicationUrl',
        'Budget',
        'ApplicationsGoal',
        'PublicationDate'
    ];

    const mappedFields = mappings.map(m => m.TargetField);
    const missingFields = requiredTargetFields.filter(field => !mappedFields.includes(field));

    if (missingFields.length > 0) {
        throw new Error(`Missing required target fields: ${missingFields.join(', ')}`);
    }
}

// Función para guardar el mapeo
async function saveMapping(mapping) {
    try {
        await pool.request()
            .input('ConnectionId', sql.Int, mapping.ConnectionId)
            .input('SourceField', sql.NVarChar(255), mapping.SourceField)
            .input('TargetField', sql.NVarChar(255), mapping.TargetField)
            .input('TransformationType', sql.NVarChar(50), mapping.TransformationType)
            .input('TransformationRule', sql.NVarChar(sql.MAX), mapping.TransformationRule || null)
            .query(`
                MERGE INTO ClientFieldMappings WITH (HOLDLOCK) AS Target
                USING (VALUES (@ConnectionId, @SourceField, @TargetField)) AS Source(ConnectionId, SourceField, TargetField)
                ON Target.ConnectionId = Source.ConnectionId 
                AND Target.SourceField = Source.SourceField
                AND Target.TargetField = Source.TargetField
                WHEN MATCHED THEN
                    UPDATE SET 
                        TransformationType = @TransformationType,
                        TransformationRule = @TransformationRule
                WHEN NOT MATCHED THEN
                    INSERT (ConnectionId, SourceField, TargetField, TransformationType, TransformationRule)
                    VALUES (@ConnectionId, @SourceField, @TargetField, @TransformationType, @TransformationRule);
            `);
    } catch (error) {
        throw new Error(`Error saving mapping: ${error.message}`);
    }
}

// Función para obtener el mapeo actual
async function getCurrentMapping(connectionId) {
    try {
        const result = await pool.request()
            .input('ConnectionId', sql.Int, connectionId)
            .query('SELECT * FROM ClientFieldMappings WHERE ConnectionId = @ConnectionId');
        return result.recordset;
    } catch (error) {
        throw new Error(`Error getting current mapping: ${error.message}`);
    }
}

// Función para procesar la importación
async function processImport(client, sourceType) {
    let processor;
    switch (sourceType.toLowerCase()) {
        case 'xml':
            processor = new XMLProcessor(client);
            break;
        case 'api':
            processor = new APIProcessor(client);
            break;
        default:
            throw new Error(`Unsupported source type: ${sourceType}`);
    }

    return await processor.process();
}

// Controlador para guardar el mapeo
exports.saveMapping = async (req, res) => {
    try {
        const { mappings } = req.body;
        
        if (!Array.isArray(mappings)) {
            return res.status(400).json({ error: 'Mappings must be an array' });
        }

        // Validar cada mapeo
        for (const mapping of mappings) {
            validateData(mapping);
        }

        // Validar el mapeo completo
        validateMapping(mappings);

        // Guardar cada mapeo
        for (const mapping of mappings) {
            await saveMapping(mapping);
        }

        res.json({ message: 'Mapping saved successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Controlador para obtener el mapeo actual
exports.getMapping = async (req, res) => {
    try {
        let connectionId = req.params.connectionId;
        const mappings = await getCurrentMapping(connectionId);
        res.json(mappings);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Controlador para importar ofertas
exports.importOffers = async (req, res) => {
    try {
        const { clientId, sourceType } = req.params;
        
        // Obtener información del cliente
        const clientResult = await pool.request()
            .input('ClientId', sql.Int, clientId)
            .query('SELECT * FROM Clients WHERE Id = @ClientId');
        
        if (clientResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = clientResult.recordset[0];
        
        // Procesar la importación
        const result = await processImport(client, sourceType);
        
        res.json({
            message: 'Import completed successfully',
            processed: result.processed,
            failed: result.failed,
            failedOffers: result.failedOffers
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}; 