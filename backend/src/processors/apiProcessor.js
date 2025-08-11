const axios = require("axios")
const { pool, sql } = require("../db/db")
const { updateOfferStatusByGoals } = require("../utils/statusUpdater")

class APIProcessor {
  constructor(connection) {
    this.connection = connection
    console.log("🔧 APIProcessor initialized for connection:", connection.id)
  }

  // ✅ MÉTODO PARA DETECTAR CAMPOS DE LA API
  async detectFields() {
    try {
      console.log("🔍 Detecting fields from API...")

      // Fetch API data
      const url = this.connection.url || this.connection.Url || this.connection.Endpoint
      if (!url) {
        throw new Error("URL not found in connection")
      }

      const headers = {}
      if (this.connection.Headers) {
        try {
          Object.assign(headers, JSON.parse(this.connection.Headers))
        } catch (error) {
          console.warn("⚠️ Invalid headers format, using default")
        }
      }

      const response = await axios({
        method: this.connection.Method || "GET",
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ...headers,
        },
        data: this.connection.Body ? JSON.parse(this.connection.Body) : undefined,
        timeout: 30000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })

      let data = response.data

      // Handle different response structures
      if (data.data && Array.isArray(data.data)) {
        data = data.data
      } else if (data.results && Array.isArray(data.results)) {
        data = data.results
      } else if (data.jobs && Array.isArray(data.jobs)) {
        data = data.jobs
      } else if (data.offers && Array.isArray(data.offers)) {
        data = data.offers
      } else if (Array.isArray(data)) {
        // data is already an array
      } else {
        throw new Error("No array data found in API response")
      }

      if (data.length === 0) {
        console.warn("⚠️ No offers found in API response")
        return []
      }

      // Analyze first offer to detect fields
      const sampleOffer = data[0]
      const fields = []

      for (const [key, value] of Object.entries(sampleOffer)) {
        const field = {
          name: key,
          type: this.detectFieldType(key, value),
          sample: this.getSampleValue(value),
          required: false,
          description: this.generateFieldDescription(key, value),
        }

        fields.push(field)
      }

      console.log(`✅ Detected ${fields.length} fields from API`)
      return fields
    } catch (error) {
      console.error("❌ Error detecting fields:", error)
      throw error
    }
  }

  // ✅ DETECTAR TIPO DE CAMPO
  detectFieldType(fieldName, value) {
    const name = fieldName.toLowerCase()

    // URLs
    if (name.includes("url") || name.includes("link") || (value && String(value).startsWith("http"))) {
      return "url"
    }

    // Fechas
    if (name.includes("date") || name.includes("created") || name.includes("updated")) {
      return "date"
    }

    // Números
    if (name.includes("id") || name.includes("count") || name.includes("salary") || typeof value === "number") {
      return "number"
    }

    // Booleanos
    if (typeof value === "boolean") {
      return "boolean"
    }

    // Arrays
    if (Array.isArray(value)) {
      return "array"
    }

    // Por defecto string
    return "string"
  }

  // ✅ OBTENER VALOR DE MUESTRA
  getSampleValue(value) {
    if (!value) return ""
    const strValue = String(value).trim()
    return strValue.length > 100 ? strValue.substring(0, 100) + "..." : strValue
  }

  // ✅ GENERAR DESCRIPCIÓN DEL CAMPO
  generateFieldDescription(fieldName, value) {
    const name = fieldName.toLowerCase()

    const descriptions = {
      id: "ID único de la oferta",
      title: "Título de la oferta",
      jobtitle: "Título del puesto de trabajo",
      job_title: "Título del puesto de trabajo",
      company: "Nombre de la empresa",
      company_name: "Nombre de la empresa",
      content: "Descripción completa",
      description: "Descripción del puesto",
      category: "Categoría o sector",
      city: "Ciudad",
      location: "Ubicación",
      url: "URL externa",
      external_url: "URL externa",
      url_apply: "URL de aplicación",
      application_url: "URL de aplicación",
      publication: "Fecha de publicación",
      publication_date: "Fecha de publicación",
      created_at: "Fecha de creación",
      updated_at: "Fecha de actualización",
      salary: "Salario",
      salary_min: "Salario mínimo",
      salary_max: "Salario máximo",
      jobtype: "Tipo de trabajo",
      job_type: "Tipo de trabajo",
      region: "Región",
      postcode: "Código postal",
      postal_code: "Código postal",
      address: "Dirección",
      budget: "Presupuesto",
      vacancies: "Número de vacantes",
      goal: "Objetivo de aplicaciones",
      country: "País",
      pais: "País",
      subcategory: "Subcategoría",
      companyid: "ID de empresa",
      company_id: "ID de empresa",
      num_vacancies: "Número de vacantes",
      company_logo_url: "Logo de la empresa",
      latitude: "Latitud",
      longitude: "Longitud",
      lat: "Latitud",
      lng: "Longitud",
      status: "Estado",
      active: "Activo",
      featured: "Destacado",
    }

    return descriptions[name] || `Campo: ${fieldName}`
  }

  // ✅ MÉTODO PARA PROBAR LA CONEXIÓN
  async test() {
    try {
      console.log("🧪 Testing API connection...")

      const url = this.connection.url || this.connection.Url || this.connection.Endpoint
      if (!url) {
        throw new Error("URL not found in connection")
      }

      const headers = {}
      if (this.connection.Headers) {
        try {
          Object.assign(headers, JSON.parse(this.connection.Headers))
        } catch (error) {
          console.warn("⚠️ Invalid headers format, using default")
        }
      }

      const response = await axios({
        method: this.connection.Method || "GET",
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ...headers,
        },
        data: this.connection.Body ? JSON.parse(this.connection.Body) : undefined,
        timeout: 30000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })

      if (response.status === 200 && response.data) {
        console.log("✅ API connection test successful")
        return {
          success: true,
          message: "Conexión API exitosa",
          sampleData: response.data,
        }
      } else {
        throw new Error("Invalid response")
      }
    } catch (error) {
      console.error("❌ API connection test failed:", error)
      return {
        success: false,
        message: `Error de conexión: ${error.message}`,
      }
    }
  }

  // ✅ CARGAR MAPPINGS
  async loadMappings() {
    try {
      console.log(`📋 Loading mappings for connection ${this.connection.id}...`)
      const result = await pool
        .request()
        .input("ConnectionId", sql.Int, this.connection.id)
        .query("SELECT * FROM ClientFieldMappings WHERE ConnectionId = @ConnectionId")

      console.log(`📋 Loaded ${result.recordset.length} mappings`)
      return result.recordset
    } catch (error) {
      console.error("❌ Error loading mappings:", error)
      return []
    }
  }

  async fetch() {
    try {
      const url = this.connection.url || this.connection.Url || this.connection.Endpoint

      if (!url) {
        throw new Error("URL not found in connection")
      }

      console.log(`🔗 Fetching API from: ${url}`)

      const headers = {}
      if (this.connection.Headers) {
        try {
          Object.assign(headers, JSON.parse(this.connection.Headers))
        } catch (error) {
          console.warn("⚠️ Invalid headers format, using default")
        }
      }

      const response = await axios({
        method: this.connection.Method || "GET",
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ...headers,
        },
        data: this.connection.Body ? JSON.parse(this.connection.Body) : undefined,
        timeout: 60000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })

      console.log(`✅ API fetched successfully, status: ${response.status}`)
      return response.data
    } catch (error) {
      console.error("❌ Error fetching API:", error.message)
      throw new Error(`Error fetching API: ${error.message}`)
    }
  }

  async process(batchSize = 100) {
    try {
      console.log("🔄 Starting API processing...")

      // 1. Cargar mappings
      const mappings = await this.loadMappings()

      if (mappings.length === 0) {
        console.log("⚠️ No mappings found, using default mapping")
      }

      // 2. Obtener datos de API
      const apiData = await this.fetch()

      // 3. Extraer ofertas de diferentes estructuras posibles
      let offers = []
      if (apiData.data && Array.isArray(apiData.data)) {
        offers = apiData.data
      } else if (apiData.results && Array.isArray(apiData.results)) {
        offers = apiData.results
      } else if (apiData.jobs && Array.isArray(apiData.jobs)) {
        offers = apiData.jobs
      } else if (apiData.offers && Array.isArray(apiData.offers)) {
        offers = apiData.offers
      } else if (Array.isArray(apiData)) {
        offers = apiData
      } else {
        console.log("⚠️ No array data found in API response structure:", Object.keys(apiData))
        return { imported: 0, errors: 0, failedOffers: [] }
      }

      console.log(`📊 Found ${offers.length} offers in API`)

      if (offers.length === 0) {
        return { imported: 0, errors: 0, failedOffers: [] }
      }

      // 4. Transformar según mappings
      const transformedOffers = offers.map((offer) => this.mapToStandardFormat(offer, mappings))

      // 5. Procesar por lotes
      const batches = this.splitIntoBatches(transformedOffers, batchSize)
      let totalProcessed = 0
      let totalFailed = 0
      const failedOffers = []

      for (let i = 0; i < batches.length; i++) {
        console.log(`🔄 Processing batch ${i + 1}/${batches.length}...`)
        const batchResult = await this.processBatch(batches[i])
        totalProcessed += batchResult.processed
        totalFailed += batchResult.failed.length
        failedOffers.push(...batchResult.failed)
      }

      // 6. Archivar ofertas antiguas (CORREGIDO)
      await this.archiveOldOffers(transformedOffers.map((o) => o.ExternalId))

      console.log(`✅ Processing completed: ${totalProcessed} processed, ${totalFailed} failed`)

      // 6. Actualizar estados automáticos por presupuesto/objetivos
      if (totalProcessed > 0) {
        console.log("🎯 Updating automatic status based on budget/goals...")
        await updateOfferStatusByGoals(this.connection.id)
      }

      // 7. Generar mapeo automático SIEMPRE que se procesen ofertas exitosamente
      if (totalProcessed > 0) {
        console.log("🔄 Generating/updating automatic mapping...")
        await this.generateAutomaticMapping(offers[0])
      }

      return {
        imported: totalProcessed,
        errors: totalFailed,
        failedOffers,
      }
    } catch (error) {
      console.error("❌ Error in API processing:", error)
      throw new Error(`Error processing API: ${error.message}`)
    }
  }

  splitIntoBatches(array, batchSize) {
    const batches = []
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize))
    }
    return batches
  }

  async processBatch(offers) {
    const results = {
      processed: 0,
      failed: [],
    }

    for (const offer of offers) {
      try {
        await this.saveOffer(offer)
        results.processed++
      } catch (error) {
        results.failed.push({
          id: offer.ExternalId,
          reason: error.message,
        })
      }
    }

    return results
  }

  mapToStandardFormat(offer, mappings) {
    const standardOffer = {}

    if (mappings.length > 0) {
      // Usar mappings configurados
      for (const mapping of mappings) {
        try {
          const value = this.getValueFromPath(offer, mapping.SourceField)

          standardOffer[mapping.TargetField] = this.transformValue(
            value,
            mapping.TransformationType || "STRING",
            mapping.TransformationRule,
          )
        } catch (error) {
          standardOffer[mapping.TargetField] = null
        }
      }
    } else {
      // Mapeo automático por defecto
      standardOffer.ExternalId = String(offer.id || offer.ID || offer.Id || Math.random().toString(36).substr(2, 9))
      standardOffer.Title = String(offer.title || offer.job_title || offer.jobtitle || "")
      standardOffer.JobTitle = String(offer.job_title || offer.jobtitle || offer.title || "")
      standardOffer.Description = String(offer.description || offer.content || offer.job_description || "")
      standardOffer.CompanyName = String(offer.company || offer.company_name || "")
      standardOffer.Sector = String(offer.category || offer.sector || "")
      standardOffer.Address = String(offer.address || offer.location || "")
      standardOffer.Country = String(offer.country || offer.pais || "")
      standardOffer.Region = String(offer.region || "")
      standardOffer.City = String(offer.city || offer.location_city || "")
      standardOffer.Postcode = String(offer.postcode || offer.postal_code || "")
      standardOffer.Vacancies = Number(offer.vacancies || offer.num_vacancies || 1)
      standardOffer.JobType = String(offer.job_type || offer.jobtype || "")
      standardOffer.ExternalUrl = String(offer.url || offer.external_url || "")
      standardOffer.ApplicationUrl = String(offer.application_url || offer.url_apply || offer.apply_url || "")
      standardOffer.PublicationDate = this.parseDate(
        offer.publication_date || offer.created_at || offer.publication || offer.date,
      )
      standardOffer.SalaryMin = Number(offer.salary_min || offer.salaryMin || 0) || null
      standardOffer.SalaryMax = Number(offer.salary_max || offer.salaryMax || 0) || null
      standardOffer.CountryId = Number(offer.country_id || offer.countryId || null) || null
      standardOffer.RegionId = Number(offer.region_id || offer.regionId || null) || null
      standardOffer.CityId = Number(offer.city_id || offer.cityId || null) || null
      standardOffer.Latitude = Number(offer.latitude || offer.lat || null) || null
      standardOffer.Longitude = Number(offer.longitude || offer.lng || null) || null
    }

    // Campos obligatorios
    standardOffer.ConnectionId = this.connection.id
    standardOffer.Source = "API"
    standardOffer.CreatedAt = new Date()
    standardOffer.StatusId = 1
    standardOffer.BudgetSpent = 0
    standardOffer.ApplicationsReceived = 0

    // Valores por defecto
    if (!standardOffer.Budget) standardOffer.Budget = 10
    if (!standardOffer.ApplicationsGoal) standardOffer.ApplicationsGoal = 50
    if (!standardOffer.Vacancies) standardOffer.Vacancies = 1

    // Asegurar que ExternalId sea string
    if (standardOffer.ExternalId) {
      standardOffer.ExternalId = String(standardOffer.ExternalId)
    }

    return standardOffer
  }

  getValueFromPath(obj, path) {
    return path.split(".").reduce((current, part) => current?.[part], obj)
  }

  transformValue(value, type, rule) {
    if (value === undefined || value === null) return null

    switch (type) {
      case "DATE":
        return this.parseDate(value)
      case "NUMBER":
        return Number(value) || null
      case "BOOLEAN":
        return Boolean(value)
      case "ARRAY":
        if (Array.isArray(value)) {
          return value[0] || null
        }
        return value || null
      case "STRING":
      default:
        return String(value || "")
    }
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date()

    try {
      // Handle ISO dates
      if (typeof dateStr === "string" && dateStr.includes("T")) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date
        }
      }

      // Handle DD/MM/YYYY format
      const [datePart, timePart] = String(dateStr).split(" ")
      if (datePart && datePart.includes("/")) {
        const [day, month, year] = datePart.split("/")
        const time = timePart || "00:00:00"
        const formattedTime = time.split(":").length === 2 ? `${time}:00` : time

        const date = new Date(
          Number.parseInt(year),
          Number.parseInt(month) - 1,
          Number.parseInt(day),
          ...formattedTime.split(":").map(Number),
        )

        if (!isNaN(date.getTime())) {
          return date
        }
      }

      // Fallback to direct parsing
      const directParse = new Date(dateStr)
      if (!isNaN(directParse.getTime())) {
        return directParse
      }

      return new Date()
    } catch (error) {
      return new Date()
    }
  }

  async saveOffer(offer) {
    try {
      await pool
        .request()
        .input("ExternalId", sql.NVarChar(255), String(offer.ExternalId))
        .input("Title", sql.NVarChar(255), offer.Title || "")
        .input("JobTitle", sql.NVarChar(255), offer.JobTitle || offer.Title || "")
        .input("Description", sql.NVarChar(sql.MAX), offer.Description)
        .input("CompanyName", sql.NVarChar(255), offer.CompanyName || "")
        .input("Sector", sql.NVarChar(255), offer.Sector || "")
        .input("Address", sql.NVarChar(255), offer.Address || "")
        .input("Country", sql.NVarChar(100), offer.Country || "")
        .input("CountryId", sql.Int, offer.CountryId || null)
        .input("Region", sql.NVarChar(100), offer.Region || "")
        .input("RegionId", sql.Int, offer.RegionId || null)
        .input("City", sql.NVarChar(100), offer.City || "")
        .input("CityId", sql.Int, offer.CityId || null)
        .input("Postcode", sql.NVarChar(20), offer.Postcode || "")
        .input("Latitude", sql.Decimal(9, 6), offer.Latitude || null)
        .input("Longitude", sql.Decimal(9, 6), offer.Longitude || null)
        .input("Vacancies", sql.Int, offer.Vacancies || 1)
        .input("SalaryMin", sql.Decimal(10, 2), offer.SalaryMin || 0)
        .input("SalaryMax", sql.Decimal(10, 2), offer.SalaryMax || 0)
        .input("JobType", sql.NVarChar(100), offer.JobType || "")
        .input("ExternalUrl", sql.NVarChar(500), offer.ExternalUrl || "")
        .input("ApplicationUrl", sql.NVarChar(500), offer.ApplicationUrl || "")
        .input("Budget", sql.Decimal(10, 2), offer.Budget || 10)
        .input("BudgetSpent", sql.Decimal(10, 2), offer.BudgetSpent || 0)
        .input("ApplicationsGoal", sql.Int, offer.ApplicationsGoal || 50)
        .input("ApplicationsReceived", sql.Int, offer.ApplicationsReceived || 0)
        .input("StatusId", sql.Int, offer.StatusId || 1)
        .input("ConnectionId", sql.Int, offer.ConnectionId)
        .input("Source", sql.NVarChar(10), offer.Source || "API")
        .input("PublicationDate", sql.DateTime, offer.PublicationDate || new Date())
        .input("CreatedAt", sql.DateTime, offer.CreatedAt || new Date())
        .query(`
          MERGE INTO JobOffers WITH (HOLDLOCK) AS Target
          USING (SELECT @ExternalId AS ExternalId, @ConnectionId AS ConnectionId) AS Source
          ON Target.ExternalId = Source.ExternalId AND Target.ConnectionId = Source.ConnectionId
          WHEN MATCHED THEN
            UPDATE SET 
              Title = @Title,
              JobTitle = @JobTitle,
              Description = @Description,
              CompanyName = @CompanyName,
              Sector = @Sector,
              Address = @Address,
              Country = @Country,
              CountryId = @CountryId,
              Region = @Region,
              RegionId = @RegionId,
              City = @City,
              CityId = @CityId,
              Postcode = @Postcode,
              Latitude = @Latitude,
              Longitude = @Longitude,
              Vacancies = @Vacancies,
              SalaryMin = @SalaryMin,
              SalaryMax = @SalaryMax,
              JobType = @JobType,
              ExternalUrl = @ExternalUrl,
              ApplicationUrl = @ApplicationUrl,
              Budget = @Budget,
              BudgetSpent = @BudgetSpent,
              ApplicationsGoal = @ApplicationsGoal,
              ApplicationsReceived = @ApplicationsReceived,
              StatusId = CASE 
                WHEN Target.StatusId = 2 THEN 2  -- Mantener pausadas manuales
                WHEN Target.StatusId = 5 THEN 5  -- Mantener archivadas manuales
                WHEN Target.StatusId = 3 THEN 3  -- Mantener objetivos completados
                WHEN Target.StatusId = 4 THEN 4  -- Mantener presupuestos completados
                ELSE @StatusId  -- Actualizar las demás (recibidas en API)
              END,
              Source = @Source,
              PublicationDate = @PublicationDate,
              UpdatedAt = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (
              ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
              Country, CountryId, Region, RegionId, City, CityId, Postcode,
              Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
              ExternalUrl, ApplicationUrl, Budget, BudgetSpent, ApplicationsGoal,
              ApplicationsReceived, StatusId, ConnectionId, Source, PublicationDate, CreatedAt
            )
            VALUES (
              @ExternalId, @Title, @JobTitle, @Description, @CompanyName, @Sector, @Address,
              @Country, @CountryId, @Region, @RegionId, @City, @CityId, @Postcode,
              @Latitude, @Longitude, @Vacancies, @SalaryMin, @SalaryMax, @JobType,
              @ExternalUrl, @ApplicationUrl, @Budget, @BudgetSpent, @ApplicationsGoal,
              @ApplicationsReceived, @StatusId, @ConnectionId, @Source, @PublicationDate, @CreatedAt
            );
        `)
    } catch (error) {
      throw new Error(`Error saving offer: ${error.message}`)
    }
  }

  // ✅ CORREGIDO: Manejo de lotes para evitar límite de 2100 parámetros
  async archiveOldOffers(activeExternalIds) {
    if (activeExternalIds.length === 0) return

    try {
      console.log(`🗄️ Archiving old offers, keeping ${activeExternalIds.length} active...`)

      // Dividir en lotes de máximo 2000 IDs para evitar el límite de SQL Server
      const batchSize = 2000
      const batches = []

      for (let i = 0; i < activeExternalIds.length; i += batchSize) {
        batches.push(activeExternalIds.slice(i, i + batchSize))
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        console.log(`🗄️ Processing archive batch ${i + 1}/${batches.length} (${batch.length} IDs)...`)

        // Crear lista de parámetros seguros
        const placeholders = batch.map((_, index) => `@id${index}`).join(",")
        const request = pool.request().input("ConnectionId", sql.Int, this.connection.id)

        // Agregar cada ID como parámetro
        batch.forEach((id, index) => {
          request.input(`id${index}`, sql.NVarChar(255), String(id))
        })

        await request.query(`
          UPDATE JobOffers
          SET StatusId = 5  -- ARCHIVADA (no pausada)
          WHERE ConnectionId = @ConnectionId
          AND Source = 'API'
          AND StatusId NOT IN (2, 3, 4)  -- NO tocar pausadas, objetivos o presupuestos completados
          AND ExternalId NOT IN (${placeholders})
        `)
      }

      console.log("✅ Old offers archived successfully")
    } catch (error) {
      console.error("❌ Error archiving old offers:", error.message)
      // No lanzar error para no interrumpir el proceso principal
    }
  }

  // ✅ GENERAR MAPEO AUTOMÁTICO
  async generateAutomaticMapping(sampleOffer) {
    try {
      console.log("🔄 Generating automatic field mappings...")

      const mappings = []
      const offerFields = Object.keys(sampleOffer)

      // ✅ MAPEO ESTÁNDAR CORREGIDO - Usar nombres que coincidan con el frontend
      const standardMappings = {
        'id': 'apply_url',
        'uuid': 'apply_url',
        'offer_id': 'apply_url',
        'job_id': 'apply_url',
        'title': 'title',
        'job_title': 'title',
        'jobtitle': 'title',
        'position': 'title',
        'content': 'description',
        'description': 'description',
        'job_description': 'description',
        'summary': 'description',
        'company': 'company',
        'company_name': 'company',
        'employer': 'company',
        'organization': 'company',
        'category': 'sector',
        'sector': 'sector',
        'industry': 'sector',
        'department': 'sector',
        'address': 'location',
        'location': 'location',
        'full_address': 'location',
        'street_address': 'location',
        'city': 'location',
        'location_city': 'location',
        'town': 'location',
        'municipality': 'location',
        'region': 'location',
        'state': 'location',
        'province': 'location',
        'area': 'location',
        'country': 'location',
        'nation': 'location',
        'postcode': 'location',
        'postal_code': 'location',
        'zip_code': 'location',
        'zip': 'location',
        'url': 'apply_url',
        'job_url': 'apply_url',
        'external_url': 'apply_url',
        'link': 'apply_url',
        'permalink': 'apply_url',
        'application_url': 'apply_url',
        'apply_url': 'apply_url',
        'url_apply': 'apply_url',
        'apply_link': 'apply_url',
        'publication_date': 'published_at',
        'published_at': 'published_at',
        'created_at': 'published_at',
        'date_created': 'published_at',
        'post_date': 'published_at',
        'date': 'published_at',
        'salary': 'salary_min',
        'pay': 'salary_min',
        'wage': 'salary_min',
        'compensation': 'salary_min',
        'salary_min': 'salary_min',
        'min_salary': 'salary_min',
        'salary_from': 'salary_min',
        'salary_max': 'salary_max',
        'max_salary': 'salary_max',
        'salary_to': 'salary_max',
        'salary_range_max': 'salary_max',
        'job_type': 'contract_type',
        'jobtype': 'contract_type',
        'employment_type': 'contract_type',
        'contract_type': 'contract_type',
        'type': 'contract_type',
        'vacancies': 'contract_type',
        'positions': 'Vacancies',
        'openings': 'Vacancies',
        'num_vacancies': 'Vacancies',
        'positions_available': 'Vacancies',
        'latitude': 'Latitude',
        'lat': 'Latitude',
        'longitude': 'Longitude',
        'lng': 'Longitude',
        'long': 'Longitude'
      }

      // Crear mapeos automáticos
      for (const sourceField of offerFields) {
        const lowerField = sourceField.toLowerCase()
        const targetField = standardMappings[lowerField]

        if (targetField) {
          mappings.push({
            ConnectionId: this.connection.id,
            ClientId: this.connection.clientId,
            SourceField: sourceField,
            TargetField: targetField,
            TransformationType: this.detectMappingType(sourceField, sampleOffer[sourceField]),
            TransformationRule: null
          })
        }
      }

      // Guardar mapeos en la base de datos
      for (const mapping of mappings) {
        await pool
          .request()
          .input("ConnectionId", sql.Int, mapping.ConnectionId)
          .input("ClientId", sql.Int, mapping.ClientId)
          .input("SourceField", sql.NVarChar(255), mapping.SourceField)
          .input("TargetField", sql.NVarChar(255), mapping.TargetField)
          .input("TransformationType", sql.NVarChar(50), mapping.TransformationType)
          .input("TransformationRule", sql.NVarChar(sql.MAX), mapping.TransformationRule)
          .query(`
            MERGE INTO ClientFieldMappings WITH (HOLDLOCK) AS Target
            USING (SELECT @ConnectionId AS ConnectionId, @ClientId AS ClientId, @SourceField AS SourceField, @TargetField AS TargetField) AS Source
            ON Target.ConnectionId = Source.ConnectionId 
            AND Target.SourceField = Source.SourceField
            AND Target.TargetField = Source.TargetField
            WHEN MATCHED THEN
                UPDATE SET 
                    TransformationType = @TransformationType,
                    TransformationRule = @TransformationRule
            WHEN NOT MATCHED THEN
                INSERT (ConnectionId, ClientId, SourceField, TargetField, TransformationType, TransformationRule)
                VALUES (@ConnectionId, @ClientId, @SourceField, @TargetField, @TransformationType, @TransformationRule);
          `)
      }

      console.log(`✅ Generated ${mappings.length} automatic mappings`)
      return mappings

    } catch (error) {
      console.error("❌ Error generating automatic mapping:", error)
      // No interrumpir el proceso principal
      return []
    }
  }

  // ✅ DETECTAR TIPO DE MAPEO
  detectMappingType(fieldName, value) {
    const name = fieldName.toLowerCase()
    const stringValue = String(value || "")

    // URLs
    if (name.includes("url") || name.includes("link") || name.includes("permalink") || stringValue.startsWith("http")) {
      return "STRING"
    }

    // Fechas
    if (name.includes("date") || name.includes("created") || name.includes("published") || name.includes("updated")) {
      return "DATE"
    }

    // Números
    if (name.includes("id") || name.includes("count") || name.includes("number") || name.includes("salary") || name.includes("pay") || name.includes("wage") || name.includes("vacancies") || name.includes("positions") || name.includes("latitude") || name.includes("longitude") || typeof value === "number") {
      return "NUMBER"
    }

    // Booleanos
    if (typeof value === "boolean" || name.includes("active") || name.includes("featured") || name.includes("visible")) {
      return "STRING" // Convertir booleanos a string para compatibilidad
    }

    // Arrays
    if (Array.isArray(value)) {
      return "ARRAY"
    }

    // Por defecto string
    return "STRING"
  }
}

module.exports = APIProcessor



