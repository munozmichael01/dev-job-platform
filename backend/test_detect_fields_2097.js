const APIProcessor = require('./src/processors/apiProcessor');

async function testDetectFields() {
  try {
    console.log('🔍 TESTING FIELD DETECTION FOR CONNECTION 2097 WITH FIXED OBJECT HANDLING');

    const mockConnection = {
      id: 2097,
      name: 'Turijobs API Production',
      type: 'API',
      url: 'https://www.turijobs.com/ngapi/api/search',
      Method: 'POST',
      Headers: '{"accept": "*/*", "x-site-id": "6", "x-lang-id": "7", "x-country-id": "40", "Content-Type": "application/json"}',
      Body: '{"userId":null,"page":{"index":1,"size":8,"featuredSize":4,"difussionSize":2},"filter":{}}',
      SourceType: 'REST',
      Endpoint: 'https://www.turijobs.com/ngapi/api/search',
      UserId: 11
    };

    const processor = new APIProcessor(mockConnection);

    console.log('🔗 Testing API connection with improved object handling...');
    const fields = await processor.detectFields();

    console.log('✅ DETECTED FIELDS WITH IMPROVED OBJECT PROCESSING:');
    console.log(JSON.stringify(fields, null, 2));

    console.log(`📊 Found ${fields.length} fields total`);

    // Verificar específicamente los campos problemáticos
    const locationField = fields.find(f => f.name === 'location');
    const companyField = fields.find(f => f.name === 'company');
    const salaryField = fields.find(f => f.name === 'salary_min' || f.name === 'salary_max');

    if (locationField) {
      console.log('\n🔍 LOCATION FIELD:');
      console.log(`- Name: ${locationField.name}`);
      console.log(`- Type: ${locationField.type}`);
      console.log(`- Sample: ${locationField.sampleValue}`);
    }

    if (companyField) {
      console.log('\n🔍 COMPANY FIELD:');
      console.log(`- Name: ${companyField.name}`);
      console.log(`- Type: ${companyField.type}`);
      console.log(`- Sample: ${companyField.sampleValue}`);
    }

    if (salaryField) {
      console.log('\n🔍 SALARY FIELD:');
      console.log(`- Name: ${salaryField.name}`);
      console.log(`- Type: ${salaryField.type}`);
      console.log(`- Sample: ${salaryField.sampleValue}`);
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      console.log('🔧 This is a network/VPN issue. Make sure VPN is connected.');
    }
  }
}

testDetectFields();