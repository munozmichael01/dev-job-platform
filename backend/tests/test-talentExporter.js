// tests/test-talentExporter.js
const TalentExporter = require('../src/exporters/talent/TalentExporter');

// Usar la misma oferta de prueba que usamos antes
const standardOffer = {
    externalId: "12345678",
    title: "Recepcionista",
    description: "Buscamos recepcionista para hotel de 4 estrellas con experiencia en trabajo remoto...",
    companyName: "Hotel XYZ",
    location: {
        country: "España",
        region: "Cataluña",
        city: "Barcelona",
        postalCode: "08001",
        latitude: 41.38,
        longitude: 2.17
    },
    address: "Calle Ejemplo 123",
    externalUrl: "https://turijobs.com/oferta/123",
    publicationDate: "2025-05-15T16:39:33.233Z",
    expirationDate: "2025-06-01T00:00:00.000Z",
    jobType: "Full-time",
    remoteOption: "Híbrido",
    benefits: [
        "Medical insurance",
        "Dental insurance",
        "Paid maternity leave"
    ]
};

// Crear instancia del exportador
const exporter = new TalentExporter();

// Validar la oferta
const validation = exporter.validate(standardOffer);
console.log('\n=== VALIDACIÓN PARA TALENT.COM ===');
console.log(JSON.stringify(validation, null, 2));

// Si la validación es exitosa, generar XML
if (validation.isValid) {
    console.log('\n=== XML GENERADO PARA TALENT.COM ===');
    console.log(exporter.toXML(standardOffer));
}