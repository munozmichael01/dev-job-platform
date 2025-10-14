const axios = require('axios');

async function debugTurijobsResponse() {
  try {
    console.log('🔍 DEBUGGING TURIJOBS API RESPONSE STRUCTURE');

    const url = 'https://www.turijobs.com/ngapi/api/search';
    const headers = {
      "accept": "*/*",
      "x-site-id": "6",
      "x-lang-id": "7",
      "x-country-id": "40",
      "Content-Type": "application/json"
    };

    const body = {
      userId: null,
      page: { index: 1, size: 8, featuredSize: 4, difussionSize: 2 },
      filter: {}
    };

    console.log('📞 Making test request to Turijobs API...');
    const response = await axios.post(url, body, { headers, timeout: 30000 });

    console.log('\n📊 RESPONSE STATUS:', response.status);
    console.log('📦 RESPONSE HEADERS:');
    console.log(JSON.stringify(response.headers, null, 2));

    console.log('\n🔑 RESPONSE DATA KEYS:');
    console.log(Object.keys(response.data));

    console.log('\n📋 FULL RESPONSE STRUCTURE:');
    console.log(JSON.stringify(response.data, null, 2));

    // Analizar estructura específica
    const data = response.data;

    if (data.offerts) {
      console.log(`\n✅ Found 'offerts' key with ${data.offerts.length} offers`);
      if (data.offerts.length > 0) {
        console.log('\n🔍 FIRST OFFER STRUCTURE:');
        console.log(JSON.stringify(data.offerts[0], null, 2));
      }
    } else if (data.offers) {
      console.log(`\n✅ Found 'offers' key with ${data.offers.length} offers`);
      if (data.offers.length > 0) {
        console.log('\n🔍 FIRST OFFER STRUCTURE:');
        console.log(JSON.stringify(data.offers[0], null, 2));
      }
    } else if (data.jobs) {
      console.log(`\n✅ Found 'jobs' key with ${data.jobs.length} jobs`);
    } else if (data.results) {
      console.log(`\n✅ Found 'results' key with ${data.results.length} results`);
    } else {
      console.log('\n❌ No offers found in expected keys (offerts, offers, jobs, results)');
      console.log('🔍 Available keys:', Object.keys(data));

      // Buscar cualquier array que pueda contener ofertas
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          console.log(`\n🔍 Found array '${key}' with ${value.length} items`);
          if (typeof value[0] === 'object') {
            console.log(`First item structure:`, JSON.stringify(value[0], null, 2));
          }
        }
      }
    }

    console.log('\n📈 PAGINATION INFO:');
    console.log('Pages:', data.pages || 'Not found');
    console.log('Total:', data.total || 'Not found');
    console.log('Current page:', data.page || data.currentPage || 'Not found');
    console.log('Per page:', data.perPage || data.size || 'Not found');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugTurijobsResponse();