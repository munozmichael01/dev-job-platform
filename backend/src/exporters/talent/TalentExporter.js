 // src/exporters/talent/TalentExporter.js
class TalentExporter {
    constructor() {
        this.requiredFields = {
            referencenumber: 'externalId',
            title: 'title',  // Corregido
            company: 'companyName',
            city: 'location.city',
            state: 'location.region',
            country: 'location.country',
            dateposted: 'publicationDate',
            url: 'externalUrl',
            description: 'description'
        };

        this.recommendedFields = {
            expirationdate: 'expirationDate',
            streetaddress: 'address',
            postalcode: 'location.postalCode',
            jobtype: 'jobType',
            isremote: 'remoteOption',
            benefit: 'benefits'
        };
    }

    toXML(standardOffer) {
        // Crear el documento XML
        const xmlParts = [];
        xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
        xmlParts.push('<source>');
        
        // Añadir atributos generales
        xmlParts.push(`  <publisher>JobPlatform</publisher>`);
        xmlParts.push(`  <publisherurl>https://jobplatform.com</publisherurl>`);
        xmlParts.push(`  <lastbuilddate>${new Date().toISOString()}</lastbuilddate>`);

        // Iniciar el job
        xmlParts.push('  <job>');

        // Añadir campos requeridos
        xmlParts.push(`    <referencenumber><![CDATA[${standardOffer.externalId}]]></referencenumber>`);
        xmlParts.push(`    <title><![CDATA[${standardOffer.title}]]></title>`);
        xmlParts.push(`    <company><![CDATA[${standardOffer.companyName}]]></company>`);
        xmlParts.push(`    <city><![CDATA[${standardOffer.location?.city || ''}]]></city>`);
        xmlParts.push(`    <state><![CDATA[${standardOffer.location?.region || ''}]]></state>`);
        xmlParts.push(`    <country><![CDATA[${standardOffer.location?.country || ''}]]></country>`);
        xmlParts.push(`    <dateposted><![CDATA[${standardOffer.publicationDate}]]></dateposted>`);
        xmlParts.push(`    <url><![CDATA[${standardOffer.externalUrl}]]></url>`);
        xmlParts.push(`    <description><![CDATA[${this.formatDescription(standardOffer.description)}]]></description>`);

        // Añadir campos recomendados si existen
        if (standardOffer.expirationDate) {
            xmlParts.push(`    <expirationdate><![CDATA[${standardOffer.expirationDate}]]></expirationdate>`);
        }
        if (standardOffer.address) {
            xmlParts.push(`    <streetaddress><![CDATA[${standardOffer.address}]]></streetaddress>`);
        }
        if (standardOffer.location?.postalCode) {
            xmlParts.push(`    <postalcode><![CDATA[${standardOffer.location.postalCode}]]></postalcode>`);
        }
        if (standardOffer.jobType) {
            xmlParts.push(`    <jobtype><![CDATA[${this.formatJobType(standardOffer.jobType)}]]></jobtype>`);
        }
        if (standardOffer.remoteOption) {
            xmlParts.push(`    <isremote><![CDATA[${this.formatRemoteOption(standardOffer.remoteOption)}]]></isremote>`);
        }

        // Añadir beneficios si existen
        if (standardOffer.benefits?.length > 0) {
            standardOffer.benefits.forEach(benefit => {
                if (this.isValidBenefit(benefit)) {
                    xmlParts.push(`    <benefit><![CDATA[${benefit}]]></benefit>`);
                }
            });
        }

        // Cerrar tags
        xmlParts.push('  </job>');
        xmlParts.push('</source>');

        return xmlParts.join('\n');
    }

    formatDescription(description) {
        if (!description) return '<p></p>';
        // Asegurarse de que la descripción tenga formato HTML
        if (!description.includes('<')) {
            return `<p>${description}</p>`;
        }
        return description;
    }

    formatJobType(jobType) {
        // Mapear nuestros tipos de trabajo a los aceptados por Talent.com
        const jobTypeMap = {
            'Full-time': 'Full time',
            'Part-time': 'Part time',
            'Contract': 'Contract',
            'Temporary': 'Temporary',
            'Internship': 'Internship',
            'Volunteer': 'Volunteer'
        };
        return jobTypeMap[jobType] || 'Other';
    }

    formatRemoteOption(remoteOption) {
        return remoteOption === 'Remoto' ? 'yes' : 'no';
    }

    isValidBenefit(benefit) {
        const validBenefits = [
            'Medical insurance',
            'Pension plan',
            'Student loan assistance',
            'Vision insurance',
            'Child care support',
            'Tuition assistance',
            'Dental insurance',
            'Paid maternity leave',
            'Disability insurance',
            '401(k) match',
            'Commuter benefits'
        ];
        return validBenefits.includes(benefit);
    }

    validate(standardOffer) {
        const errors = [];

        // Validar campos requeridos
        for (const [xmlField, standardField] of Object.entries(this.requiredFields)) {
            const value = standardField.includes('.')
                ? standardField.split('.').reduce((obj, key) => obj?.[key], standardOffer)
                : standardOffer[standardField];

            if (!value && value !== 0) {
                errors.push(`Campo requerido faltante para Talent.com: ${xmlField}`);
            }
        }

        // Validar longitud mínima de la descripción
        if (standardOffer.description && standardOffer.description.length < 50) {
            errors.push('La descripción debe tener al menos 50 caracteres');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = TalentExporter;