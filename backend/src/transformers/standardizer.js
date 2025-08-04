// src/transformers/standardizer.js
class JobStandardizer {
    constructor(offer) {
        this.offer = offer;
    }

    toStandard() {
        return {
            // Campos obligatorios
            externalId: this.offer.ExternalId.toString(),
            title: this.offer.Title,
            description: this.offer.Description,
            companyName: this.offer.CompanyName,
            location: {
                country: this.offer.Country,
                region: this.offer.Region,
                city: this.offer.City,
                postalCode: this.offer.Postcode,
                latitude: this.offer.Latitude,
                longitude: this.offer.Longitude
            },
            address: this.offer.Address,
            externalUrl: this.offer.ExternalUrl,
            publicationDate: this.formatDate(this.offer.PublicationDate),
            budget: this.offer.Budget,
            applicationsGoal: this.offer.ApplicationsGoal,
            clientId: this.offer.ClientId,
            source: this.offer.Source,

            // Campos opcionales
            jobTitle: this.offer.JobTitle || this.offer.Title,
            sector: this.offer.Sector || null,
            jobType: this.offer.JobType || null,
            vacancies: this.offer.Vacancies || null,
            salaryMin: this.offer.SalaryMin || null,
            salaryMax: this.offer.SalaryMax || null,
            currency: this.getCurrency(),
            remoteOption: this.getRemoteOption(),
            workingHours: this.getWorkingHours(),
            experienceRequired: this.getExperienceRequired(),
            educationLevel: this.offer.EducationLevel || null,
            languageRequirements: this.getLanguageRequirements(),
            skills: this.getSkills(),
            benefits: this.getBenefits(),
            contractType: this.offer.ContractType || null,
            applicationMethod: this.getApplicationMethod(),
            expirationDate: this.offer.ExpirationDate ? this.formatDate(this.offer.ExpirationDate) : null,
            categories: this.getCategories()
        };
    }

    formatDate(date) {
        if (!date) return null;
        try {
            return date instanceof Date 
                ? date.toISOString()
                : new Date(date).toISOString();
        } catch (error) {
            console.warn(`⚠️ Fecha inválida: "${date}", usando null`);
            return null;
        }
    }

    getCurrency() {
        // Si el cliente tiene una moneda configurada, usarla
        return this.offer.Currency || "EUR";
    }

    getRemoteOption() {
        // Si el cliente especifica el tipo de trabajo remoto, usarlo
        if (this.offer.RemoteOption) {
            return this.offer.RemoteOption;
        }
        
        // Intentar inferir basado en la descripción o título
        const description = (this.offer.Description || "").toLowerCase();
        const title = (this.offer.Title || "").toLowerCase();
        
        if (description.includes("teletrabajo") || description.includes("remoto") || 
            title.includes("teletrabajo") || title.includes("remoto")) {
            return "Remoto";
        } else if (description.includes("híbrido") || title.includes("híbrido")) {
            return "Híbrido";
        }
        
        return "Presencial";
    }

    getWorkingHours() {
        if (!this.offer.WorkingHours) return null;
        
        // Si viene en formato específico, lo usamos
        if (this.offer.WorkingHours.startTime && this.offer.WorkingHours.endTime) {
            return `${this.offer.WorkingHours.startTime} - ${this.offer.WorkingHours.endTime}`;
        }
        
        // Si viene como string, lo devolvemos tal cual
        return this.offer.WorkingHours;
    }

    getExperienceRequired() {
        if (!this.offer.ExperienceRequired) return null;
        
        // Si viene como número, lo formateamos
        if (typeof this.offer.ExperienceRequired === 'number') {
            return this.offer.ExperienceRequired === 0 
                ? "Sin experiencia" 
                : `${this.offer.ExperienceRequired} años`;
        }
        
        // Si viene como string, lo devolvemos tal cual
        return this.offer.ExperienceRequired;
    }

    getLanguageRequirements() {
        if (!this.offer.Languages || !Array.isArray(this.offer.Languages)) {
            return [];
        }

        return this.offer.Languages.map(lang => ({
            language: lang.name || lang.language,
            level: lang.level || null
        }));
    }

    getSkills() {
        if (!this.offer.Skills || !Array.isArray(this.offer.Skills)) {
            return [];
        }

        return this.offer.Skills.map(skill => 
            typeof skill === 'string' ? skill : skill.name || skill.skill
        );
    }

    getBenefits() {
        if (!this.offer.Benefits || !Array.isArray(this.offer.Benefits)) {
            return [];
        }

        return this.offer.Benefits.map(benefit => 
            typeof benefit === 'string' ? benefit : benefit.name || benefit.description
        );
    }

    getApplicationMethod() {
        if (this.offer.ApplicationUrl) {
            return "Redirect";
        } else if (this.offer.ApplicationEmail) {
            return "Email";
        }
        return "Direct";
    }

    getCategories() {
        if (!this.offer.Categories || !Array.isArray(this.offer.Categories)) {
            return [];
        }

        return this.offer.Categories.map(category => 
            typeof category === 'string' ? category : category.name || category.category
        );
    }

    validate() {
        const requiredFields = [
            'externalId',
            'title',
            'description',
            'companyName',
            'location.city',
            'location.country',
            'externalUrl',
            'publicationDate',
            'budget',
            'applicationsGoal',
            'clientId',
            'source'
        ];

        const errors = [];
        for (const field of requiredFields) {
            const value = field.includes('.')
                ? field.split('.').reduce((obj, key) => obj?.[key], this.toStandard())
                : this.toStandard()[field];

            if (!value && value !== 0) {
                errors.push(`Campo requerido faltante: ${field}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = JobStandardizer;