const APIProcessor = require('./src/processors/apiProcessor');

async function testImport() {
  try {
    console.log('🚀 TESTING TURIJOBS IMPORT - CONNECTION 2097 (FIXED)');

    // Simular conexión 2097 con datos reales después del fix
    const mockConnection = {
      id: 2097,
      name: 'API Turijobs Prod Sep16',
      type: 'API',
      url: 'https://www.turijobs.com/ngapi/api/search',
      Method: 'POST',
      Headers: '{"accept": "*/*", "x-site-id": "6", "x-lang-id": "7", "x-country-id": "40", "Content-Type": "application/json"}',
      Body: '{"userId":null,"page":{"index":1,"size":8,"featuredSize":4,"difussionSize":2},"filter":{}}',
      SourceType: 'REST',
      Endpoint: 'https://www.turijobs.com/ngapi/api/search',
      clientId: 3
    };

    const processor = new APIProcessor(mockConnection);

    console.log('📞 Calling Turijobs API with fixed Body payload...');
    const result = await processor.process(10); // Procesar en lotes pequeños para testing

    console.log('📊 RESULTADO FINAL:');
    console.log(`✅ Importadas: ${result.imported}`);
    console.log(`❌ Errores: ${result.errors}`);
    console.log(`📝 Ofertas fallidas: ${result.failedOffers.length}`);

    if (result.failedOffers.length > 0) {
      console.log('🔍 PRIMERA OFERTA FALLIDA:');
      console.log(JSON.stringify(result.failedOffers[0], null, 2));
    }

    if (result.imported > 0) {
      console.log(`🎉 CONNECTION 2097 NOW WORKS! Fixed the missing Body payload issue.`);
    }

  } catch (error) {
    console.error('❌ ERROR EN TEST:', error.message);
    console.error(error.stack);
  }
}

testImport();