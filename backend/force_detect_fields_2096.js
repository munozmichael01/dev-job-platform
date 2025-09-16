const APIProcessor = require('./src/processors/apiProcessor');

async function forceDetectFields() {
  try {
    console.log('🔍 FORCING FIELD DETECTION FOR CONNECTION 2096');

    const mockConnection = {
      id: 2096,
      name: 'Turijobs API Production',
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

    console.log('🔗 Testing API connection...');
    const fields = await processor.detectFields();

    console.log('✅ DETECTED FIELDS:');
    console.log(JSON.stringify(fields, null, 2));

    console.log(`📊 Found ${fields.length} fields total`);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      console.log('🔧 This is a network/VPN issue. Make sure VPN is connected.');
    }
  }
}

forceDetectFields();