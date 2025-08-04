// importOffers.js
const { pool, poolConnect } = require('./src/db/db');
const XMLProcessor = require('./src/processors/xmlProcessor');

async function importOffers() {
    try {
        // 1. Esperamos a que la conexión a la base de datos esté lista
        await poolConnect;

        // 2. Configuración del cliente Turijobs (posteriormente vendrá de la base de datos)
        const turijobsClient = {
            id: 1,
            name: 'Turijobs',
            sourceType: 'XML',
            endpoint: 'https://feed.turijobs.com/partner/files/3DD9745E-4081-4F13-88D2-903F8E06A32D/12486900-D299-43ED-A2FE-3189C52C8542'
        };

        // 3. Creamos una instancia del procesador XML con el cliente
        const processor = new XMLProcessor(turijobsClient);

        // 4. Procesamos las ofertas con un tamaño de lote de 50
        console.log('🔄 Iniciando importación de ofertas de Turijobs...');
        const result = await processor.process(50);
        console.log(`✅ Proceso completado. Procesadas: ${result.processed}, Fallidas: ${result.failed}`);

    } catch (error) {
        console.error('❌ Error en importOffers:', error.message);
    } finally {
        // 5. Cerramos la conexión
        await pool.close();
    }
}

// Ejecutamos la función
importOffers();