// tests/test-standardizer.js
const JobStandardizer = require('../src/transformers/standardizer');

// Datos de prueba que simulan una oferta de trabajo completa
const testOffer = {
    // Campos obligatorios
    ExternalId: "12345678",
    Title: "Recepcionista",
    Description: "Buscamos recepcionista para hotel de 4 estrellas con experiencia en trabajo remoto...",
    CompanyName: "Hotel XYZ",
    Country: "España",
    Region: "Cataluña",
    City: "Barcelona",
    Postcode: "08001",
    Latitude: 41.38,
    Longitude: 2.17,
    Address: "Calle Ejemplo 123",
    ExternalUrl: "https://turijobs.com/oferta/123",
    PublicationDate: new Date(),
    Budget: 10,
    ApplicationsGoal: 25,
    ClientId: 2,
    Source: "API",

    // Campos opcionales con diferentes formatos
    JobTitle: "Recepcionista de Hotel",
    Sector: "Hotelería",
    JobType: "Full-time",
    Vacancies: 1,
    SalaryMin: 18000,
    SalaryMax: 22000,
    Currency: "EUR",
    RemoteOption: "Híbrido",
    
    // Probando diferentes formatos de horario
    WorkingHours: {
        startTime: "09:00",
        endTime: "17:00"
    },
    
    // Experiencia en formato numérico
    ExperienceRequired: 2,
    
    // Educación
    EducationLevel: "Grado Superior en Turismo",
    
    // Arrays con diferentes formatos
    Languages: [
        { name: "Español", level: "Nativo" },
        { language: "Inglés", level: "B2" },
        { name: "Francés" }  // Sin nivel
    ],
    
    Skills: [
        "Opera PMS",
        { name: "Atención al cliente" },
        { skill: "Gestión de reservas" }
    ],
    
    Benefits: [
        "Seguro médico",
        { name: "Ticket restaurante" },
        { description: "Formación continua" }
    ],
    
    // Método de aplicación
    ApplicationUrl: "https://careers.hotel.xyz/apply/123",
    ApplicationEmail: "rrhh@hotel.xyz",
    
    ContractType: "Indefinido",
    ExpirationDate: "2025-06-01",
    
    Categories: [
        "Hostelería",
        { name: "Recepción" },
        { category: "Atención al cliente" }
    ]
};

// Función para mostrar resultados de forma más legible
function displayResults(offer, validation) {
    console.log('\n=== OFERTA ESTANDARIZADA ===');
    console.log(JSON.stringify(offer, null, 2));
    
    console.log('\n=== VALIDACIÓN ===');
    console.log(JSON.stringify(validation, null, 2));
    
    console.log('\n=== VERIFICACIÓN DE CAMPOS ESPECÍFICOS ===');
    console.log('1. Información básica:');
    console.log(`   - Título: ${offer.title}`);
    console.log(`   - Puesto: ${offer.jobTitle}`);
    console.log(`   - Empresa: ${offer.companyName}`);
    
    console.log('\n2. Ubicación:');
    console.log(`   - País: ${offer.location.country}`);
    console.log(`   - Ciudad: ${offer.location.city}`);
    console.log(`   - Dirección: ${offer.address}`);
    
    console.log('\n3. Condiciones:');
    console.log(`   - Tipo: ${offer.jobType}`);
    console.log(`   - Modalidad: ${offer.remoteOption}`);
    console.log(`   - Horario: ${offer.workingHours}`);
    console.log(`   - Experiencia: ${offer.experienceRequired}`);
    console.log(`   - Contrato: ${offer.contractType}`);
    console.log(`   - Salario: ${offer.salaryMin} - ${offer.salaryMax} ${offer.currency}`);
    
    console.log('\n4. Requisitos:');
    console.log('   Idiomas:');
    offer.languageRequirements.forEach(lang => 
        console.log(`   - ${lang.language}: ${lang.level || 'Nivel no especificado'}`));
    
    console.log('   Habilidades:');
    offer.skills.forEach(skill => console.log(`   - ${skill}`));
    
    console.log('\n5. Beneficios:');
    offer.benefits.forEach(benefit => console.log(`   - ${benefit}`));
    
    console.log('\n6. Categorías:');
    offer.categories.forEach(category => console.log(`   - ${category}`));
    
    console.log('\n7. Método de aplicación:');
    console.log(`   - Tipo: ${offer.applicationMethod}`);
}

// Crear instancia del estandarizador y probar con oferta completa
console.log('\n=== PRUEBA CON OFERTA COMPLETA ===');
const standardizer = new JobStandardizer(testOffer);
const standardOffer = standardizer.toStandard();
const validation = standardizer.validate();
displayResults(standardOffer, validation);

// Prueba adicional con datos mínimos
console.log('\n\n=== PRUEBA CON DATOS MÍNIMOS ===');
const minimalOffer = {
    ExternalId: "99999",
    Title: "Oferta Mínima",
    Description: "Descripción básica",
    CompanyName: "Empresa Test",
    Country: "España",
    City: "Madrid",
    ExternalUrl: "https://test.com",
    PublicationDate: new Date(),
    Budget: 5,
    ApplicationsGoal: 10,
    ClientId: 1,
    Source: "TEST"
};

const minimalStandardizer = new JobStandardizer(minimalOffer);
const minimalStandardOffer = minimalStandardizer.toStandard();
const minimalValidation = minimalStandardizer.validate();
displayResults(minimalStandardOffer, minimalValidation);