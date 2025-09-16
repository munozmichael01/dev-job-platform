const axios = require('axios');

async function testFrontendEndpoint() {
  try {
    console.log('🔍 TESTING FRONTEND ENDPOINT FOR FIELD DETECTION');

    // Test the exact endpoint that frontend uses
    const response = await axios.post('http://localhost:3002/api/connections/2097/detect-fields', {}, {
      timeout: 30000
    });

    console.log('✅ Response status:', response.status);
    console.log('📊 Success:', response.data.success);
    console.log(`📋 Found ${response.data.fields.length} fields`);

    // Check specific problematic fields
    const locationField = response.data.fields.find(f => f.name === 'location');
    const companyField = response.data.fields.find(f => f.name === 'company');
    const salaryField = response.data.fields.find(f => f.name === 'salary');

    console.log('\n🎯 KEY FIELDS CHECK:');
    if (locationField) {
      console.log(`✅ location: ${locationField.sample || 'undefined'}`);
    }
    if (companyField) {
      console.log(`✅ company: ${companyField.sample || 'undefined'}`);
    }
    if (salaryField) {
      console.log(`✅ salary: ${salaryField.sample || 'undefined'}`);
    }

    // Check if any fields still show [object Object]
    const objectFields = response.data.fields.filter(f =>
      f.sample && f.sample.includes('[object Object]')
    );

    if (objectFields.length > 0) {
      console.log(`\n⚠️ Still ${objectFields.length} fields with [object Object]:`);
      objectFields.forEach(f => {
        console.log(`  - ${f.name}: ${f.sample}`);
      });
    } else {
      console.log('\n✅ NO [object Object] values found! Problem resolved.');
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Backend server not running on port 3002');
      console.log('💡 Start with: cd /c/Dev/job-platform/backend && node index.js');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testFrontendEndpoint();