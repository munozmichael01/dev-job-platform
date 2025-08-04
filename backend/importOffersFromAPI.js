// importOffersFromAPI.js
const { pool, sql, poolConnect } = require('./src/db/db');
const APIProcessor = require('./src/processors/apiProcessor');

async function getClientConfig(clientId) {
    await poolConnect; // Espera a que la conexión esté lista
    const result = await pool.request()
        .input('Id', sql.Int, clientId)
        .query('SELECT * FROM Clients WHERE Id = @Id');
    if (result.recordset.length === 0) {
        throw new Error(`No se encontró el cliente con Id ${clientId}`);
    }
    // Normalizar los campos para el procesador
    const client = result.recordset[0];
    return {
        id: client.Id,
        name: client.Name,
        endpoint: client.Endpoint,
        headers: client.Headers,
        method: client.Method || 'post', // por defecto post
        body: client.PayloadTemplate // usa el body correcto
    };
}

async function main() {
    try {
        await poolConnect; // Espera a que la conexión esté lista
        // Cambia el ID por el del cliente API que quieras procesar
        const clientId = 2; // Ejemplo: 2 para Turijobs API
        const clientConfig = await getClientConfig(clientId);
        const processor = new APIProcessor(clientConfig);
        await processor.process(50); // Puedes ajustar el tamaño del lote
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en el proceso principal:', error.message);
        process.exit(1);
    }
}

main(); 