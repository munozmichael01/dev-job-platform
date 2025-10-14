// Script para limpiar mapeos duplicados del frontend

function cleanupMappingDuplicates(mappingObject) {
  console.log('🧹 LIMPIANDO MAPEOS DUPLICADOS');
  console.log(`📥 Mapeos originales: ${Object.keys(mappingObject).length}`);

  const cleanMapping = {};
  const seenTargetFields = new Set();
  const duplicates = [];
  const cleaned = [];

  // Procesar cada mapeo
  Object.entries(mappingObject).forEach(([targetField, sourceField]) => {
    // Normalizar el targetField (PascalCase priority)
    const normalizedTarget = normalizeTargetField(targetField);

    if (seenTargetFields.has(normalizedTarget)) {
      duplicates.push(`${targetField} -> ${normalizedTarget} (duplicate)`);
      return; // Skip duplicate
    }

    seenTargetFields.add(normalizedTarget);
    cleanMapping[normalizedTarget] = sourceField;
    cleaned.push(`${targetField} -> ${normalizedTarget}: ${sourceField}`);
  });

  console.log(`✅ Mapeos limpios: ${Object.keys(cleanMapping).length}`);
  console.log(`❌ Duplicados eliminados: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log('🗑️ Duplicados eliminados:');
    duplicates.forEach(dup => console.log(`  - ${dup}`));
  }

  return cleanMapping;
}

function normalizeTargetField(field) {
  // Mapa de normalización para campos estándar
  const normalizationMap = {
    // Title variations
    'title': 'Title',
    'Title': 'Title',
    'job_title': 'JobTitle',
    'JobTitle': 'JobTitle',

    // Description variations
    'description': 'Description',
    'Description': 'Description',

    // Company variations
    'company': 'CompanyName',
    'Company': 'CompanyName',
    'CompanyName': 'CompanyName',
    'company_name': 'CompanyName',

    // Location variations
    'location': 'City', // Default location to City
    'city': 'City',
    'City': 'City',
    'region': 'Region',
    'Region': 'Region',
    'country': 'Country',
    'Country': 'Country',

    // URL variations
    'url': 'ApplicationUrl',
    'apply_url': 'ApplicationUrl',
    'ApplicationUrl': 'ApplicationUrl',
    'application_url': 'ApplicationUrl',
    'ExternalUrl': 'ExternalUrl',
    'external_url': 'ExternalUrl',

    // Date variations
    'published_at': 'PublicationDate',
    'publication_date': 'PublicationDate',
    'PublicationDate': 'PublicationDate',

    // Salary variations
    'salary_min': 'SalaryMin',
    'salary_max': 'SalaryMax',
    'SalaryMin': 'SalaryMin',
    'SalaryMax': 'SalaryMax',
    'salary': 'SalaryMin', // Default single salary to min

    // ID variations
    'id': 'ExternalId',
    'external_id': 'ExternalId',
    'ExternalId': 'ExternalId',

    // Sector variations
    'sector': 'Sector',
    'Sector': 'Sector',
    'sector_id': 'Sector',
    'sectorId': 'Sector'
  };

  return normalizationMap[field] || field;
}

// Test data (simulating the problematic mapping from frontend)
const problematicMapping = {
  'Address': 'company.address',
  'ApplicationUrl': 'url',
  'ApplicationsGoal': 'applies',
  'City': 'location.cityName',
  'CompanyName': 'company.enterpriseName',
  'Country': 'location.countryName',
  'Description': 'description',
  'ExternalId': 'id',
  'ExternalUrl': 'externalUrl',
  'JobType': 'type',
  'Latitude': 'location.latitude',
  'Longitude': 'location.longitude',
  'PublicationDate': 'publicationDate',
  'Region': 'location.regionName',
  'Sector': 'company.sector',
  'Title': 'title',
  'Vacancies': 'vacancies',
  'apply_url': 'url', // DUPLICATE with ApplicationUrl
  'company': 'company', // DUPLICATE with CompanyName
  'description': 'offerDescriptionTags', // DUPLICATE with Description
  'location': 'location', // DUPLICATE with City
  'published_at': 'publicationDate', // DUPLICATE with PublicationDate
  'salary_max': 'salary',
  'salary_min': 'salary',
  'sector': 'sectorId', // DUPLICATE with Sector
  'title': 'title', // DUPLICATE with Title
  'url': 'url' // DUPLICATE with ApplicationUrl
};

console.log('🧪 TESTING CLEANUP FUNCTION');
const cleaned = cleanupMappingDuplicates(problematicMapping);

console.log('\n📋 RESULTADO FINAL:');
console.log(JSON.stringify(cleaned, null, 2));