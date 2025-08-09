const { pool, sql } = require("../db/db")
const xml2js = require("xml2js")
const fs = require('fs')

class XMLFileProcessor {
  constructor(connection, filePath = null) {
    this.connection = connection
    this.filePath = filePath
    console.log("🔧 XMLFileProcessor initialized for connection:", connection.id)
  }

  // ✅ MÉTODO PARA DETECTAR CAMPOS DEL XML
  async detectFields(filePath = null) {
    try {
      console.log("🔍 Detecting fields from XML file...")
      
      const xmlFilePath = filePath || this.filePath
      if (!xmlFilePath || !fs.existsSync(xmlFilePath)) {
        throw new Error("XML file path not provided or file doesn't exist")
      }

      // Leer archivo XML
      const xmlData = fs.readFileSync(xmlFilePath, 'utf8')
      const parsed = await this.parseXML(xmlData)

      // Extraer primera oferta para análisis
      let sampleOffer = null
      if (parsed.jobs && parsed.jobs.job) {
        const jobs = Array.isArray(parsed.jobs.job) ? parsed.jobs.job : [parsed.jobs.job]
        sampleOffer = jobs[0]
      } else if (parsed.offers && parsed.offers.offer) {
        const offers = Array.isArray(parsed.offers.offer) ? parsed.offers.offer : [parsed.offers.offer]
        sampleOffer = offers[0]
      }

      if (!sampleOffer) {
        throw new Error("No job offers found in XML structure")
      }

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

      console.log(`✅ Detected ${fields.length} fields from XML file`)
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
    if (name.includes("date") || name.includes("publication") || name.includes("created") || name.includes("fecha")) {
      return "date"
    }

    // Números
    if (name.includes("id") || name.includes("count") || name.includes("number") || name.includes("salary") || name.includes("precio") || name.includes("salario")) {
      return "number"
    }

    // Por defecto string
    return "string"
  }

  // ✅ OBTENER VALOR DE MUESTRA
  getSampleValue(value) {
    if (!value) return ""
    
    // Manejar arrays CDATA
    if (Array.isArray(value) && value.length > 0) {
      value = value[0]
    }
    
    // Manejar objetos con _
    if (typeof value === 'object' && value._) {
      value = value._
    }
    
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
      company: "Nombre de la empresa",
      content: "Descripción completa",
      description: "Descripción del puesto",
      category: "Categoría o sector",
      city: "Ciudad",
      location: "Ubicación",
      url: "URL externa",
      url_apply: "URL de aplicación",
      publication: "Fecha de publicación",
      salary: "Salario",
      jobtype: "Tipo de trabajo",
      region: "Región",
      postcode: "Código postal",
      address: "Dirección",
      budget: "Presupuesto",
      goal: "Objetivo de aplicaciones",
      vacancies: "Número de vacantes",
      pais: "País",
      country: "País",
      subcategory: "Subcategoría",
      companyid: "ID de empresa",
      idpais: "ID del país",
      idregion: "ID de región",
      idcity: "ID de ciudad",
      num_vacancies: "Número de vacantes",
      company_logo_url: "Logo de la empresa"
    }

    return descriptions[name] || `Campo: ${fieldName}`
  }

  // ✅ MÉTODO PARA PROBAR LA CONEXIÓN (para archivos XML subidos)
  async test(filePath = null) {
    try {
      console.log("🧪 Testing XML file...")
      
      const xmlFilePath = filePath || this.filePath
      if (!xmlFilePath || !fs.existsSync(xmlFilePath)) {
        throw new Error("XML file path not provided or file doesn't exist")
      }

      // Leer y parsear archivo XML
      const xmlData = fs.readFileSync(xmlFilePath, 'utf8')
      const parsed = await this.parseXML(xmlData)

      // Contar ofertas
      let offersCount = 0
      if (parsed.jobs && parsed.jobs.job) {
        offersCount = Array.isArray(parsed.jobs.job) ? parsed.jobs.job.length : 1
      } else if (parsed.offers && parsed.offers.offer) {
        offersCount = Array.isArray(parsed.offers.offer) ? parsed.offers.offer.length : 1
      }

      console.log("✅ XML file test successful")
      return {
        success: true,
        message: "Archivo XML válido",
        sampleData: parsed,
        totalOffers: offersCount
      }
    } catch (error) {
      console.error("❌ XML file test failed:", error)
      return {
        success: false,
        message: error.message,
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

  async parseXML(xmlData) {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
        explicitCharkey: false,
        charkey: '_',
      })

      const result = await parser.parseStringPromise(xmlData)
      console.log(`✅ XML parsed successfully`)
      return result
    } catch (error) {
      console.error("❌ Error parsing XML:", error)
      throw new Error(`Error parsing XML: ${error.message}`)
    }
  }

  async process(filePath = null, batchSize = 100) {
    try {
      console.log("🔄 Starting XML file processing...")

      const xmlFilePath = filePath || this.filePath
      if (!xmlFilePath || !fs.existsSync(xmlFilePath)) {
        throw new Error("XML file path not provided or file doesn't exist")
      }

      // 1. Cargar mappings
      const mappings = await this.loadMappings()

      if (mappings.length === 0) {
        console.log("⚠️ No mappings found, using default mapping")
      }

      // 2. Leer y parsear XML
      const xmlData = fs.readFileSync(xmlFilePath, 'utf8')
      const parsed = await this.parseXML(xmlData)

      // 3. Extraer ofertas
      let offers = []
      if (parsed.jobs && parsed.jobs.job) {
        offers = Array.isArray(parsed.jobs.job) ? parsed.jobs.job : [parsed.jobs.job]
      } else if (parsed.offers && parsed.offers.offer) {
        offers = Array.isArray(parsed.offers.offer) ? parsed.offers.offer : [parsed.offers.offer]
      } else if (parsed.job) {
        offers = Array.isArray(parsed.job) ? parsed.job : [parsed.job]
      } else if (parsed.offer) {
        offers = Array.isArray(parsed.offer) ? parsed.offer : [parsed.offer]
      } else {
        // Buscar primer nivel que sea array
        const firstKey = Object.keys(parsed)[0]
        if (parsed[firstKey] && Array.isArray(parsed[firstKey])) {
          offers = parsed[firstKey]
        } else if (parsed[firstKey] && typeof parsed[firstKey] === "object") {
          const secondKey = Object.keys(parsed[firstKey])[0]
          if (parsed[firstKey][secondKey]) {
            offers = Array.isArray(parsed[firstKey][secondKey])
              ? parsed[firstKey][secondKey]
              : [parsed[firstKey][secondKey]]
          }
        }
      }

      console.log(`📊 Found ${offers.length} offers in XML file`)

      if (offers.length === 0) {
        console.log("⚠️ No offers found in XML file structure:", Object.keys(parsed))
        return { imported: 0, errors: 0, failedOffers: [] }
      }

      // 4. Transformar según mappings
      const transformedOffers = offers.map((offer) => this.mapToStandardFormat(offer, mappings))

      // 5. Procesar por lotes
      const batches = this.splitIntoBatches(transformedOffers, batchSize)
      let totalProcessed = 0
      let totalFailed = 0
      const failedOffers = []

      console.log(`🔄 Starting batch processing: ${batches.length} batches of up to ${batchSize} offers each`)

      for (let i = 0; i < batches.length; i++) {
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batches[i].length} offers)...`)
        const batchResult = await this.processBatch(batches[i])
        totalProcessed += batchResult.processed
        totalFailed += batchResult.failed.length
        failedOffers.push(...batchResult.failed)
        
        // Progress feedback para grandes volúmenes
        if ((i + 1) % 10 === 0 || i === batches.length - 1) {
          console.log(`📈 Progress: ${totalProcessed} processed so far (${Math.round(((i + 1) / batches.length) * 100)}% complete)`)
        }
      }

      // 6. Archivar ofertas antiguas
      console.log("🗄️ Starting archival process...")
      await this.archiveOldOffers(transformedOffers.map((o) => o.ExternalId))

      console.log(`✅ Processing completed: ${totalProcessed} processed, ${totalFailed} failed`)

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
      console.error("❌ Error in XML file processing:", error)
      throw new Error(`Error processing XML file: ${error.message}`)
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
          let value = this.getValueFromPath(offer, mapping.SourceField)
          
          // Manejar CDATA y objetos especiales
          if (Array.isArray(value) && value.length > 0) {
            value = value[0]
          }
          if (typeof value === 'object' && value._) {
            value = value._
          }

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
      standardOffer.ExternalId = String(this.extractValue(offer.id) || this.extractValue(offer.ID) || this.extractValue(offer.Id) || Math.random().toString(36).substr(2, 9))
      standardOffer.Title = String(this.extractValue(offer.title) || this.extractValue(offer.jobtitle) || "")
      standardOffer.JobTitle = String(this.extractValue(offer.jobtitle) || this.extractValue(offer.title) || "")
      standardOffer.Description = String(this.extractValue(offer.content) || this.extractValue(offer.description) || "")
      standardOffer.CompanyName = String(this.extractValue(offer.company) || "")
      standardOffer.Sector = String(this.extractValue(offer.category) || "")
      standardOffer.Address = String(this.extractValue(offer.address) || this.extractValue(offer.location) || "")
      standardOffer.Country = String(this.extractValue(offer.country) || this.extractValue(offer.pais) || "")
      standardOffer.Region = String(this.extractValue(offer.region) || "")
      standardOffer.City = String(this.extractValue(offer.city) || "")
      standardOffer.Postcode = String(this.extractValue(offer.postcode) || "")
      standardOffer.Vacancies = Number(this.extractValue(offer.vacancies) || this.extractValue(offer.num_vacancies) || 1)
      standardOffer.JobType = String(this.extractValue(offer.jobtype) || "")
      standardOffer.ExternalUrl = String(this.extractValue(offer.url) || "")
      standardOffer.ApplicationUrl = String(this.extractValue(offer.url_apply) || "")
      standardOffer.PublicationDate = this.parseDate(this.extractValue(offer.publication) || this.extractValue(offer.date))
      standardOffer.SalaryMin = Number(this.extractValue(offer.salary_min) || this.extractValue(offer.salaryMin) || 0) || null
      standardOffer.SalaryMax = Number(this.extractValue(offer.salary_max) || this.extractValue(offer.salaryMax) || 0) || null
      standardOffer.CountryId = Number(this.extractValue(offer.idpais) || this.extractValue(offer.countryId) || null) || null
      standardOffer.RegionId = Number(this.extractValue(offer.idregion) || this.extractValue(offer.regionId) || null) || null
      standardOffer.CityId = Number(this.extractValue(offer.idcity) || this.extractValue(offer.cityId) || null) || null
      standardOffer.Latitude = Number(this.extractValue(offer.latitude) || this.extractValue(offer.lat) || null) || null
      standardOffer.Longitude = Number(this.extractValue(offer.longitude) || this.extractValue(offer.lng) || null) || null
    }

    // Campos obligatorios
    standardOffer.ConnectionId = this.connection.id
    standardOffer.Source = "XML_FILE"
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

  // Extraer valor manejando CDATA y objetos especiales
  extractValue(value) {
    if (!value) return null
    
    // Manejar arrays CDATA
    if (Array.isArray(value) && value.length > 0) {
      return value[0]
    }
    
    // Manejar objetos con _
    if (typeof value === 'object' && value._) {
      return value._
    }
    
    return value
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
      // Manejar diferentes formatos de fecha comunes en XML
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

      if (datePart && datePart.includes("-")) {
        const [year, month, day] = datePart.split("-")
        const time = timePart || "00:00:00"
        
        const date = new Date(
          Number.parseInt(year),
          Number.parseInt(month) - 1,
          Number.parseInt(day),
          ...time.split(":").map(Number),
        )

        if (!isNaN(date.getTime())) {
          return date
        }
      }

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
        .input("Source", sql.NVarChar(10), offer.Source || "XML_FILE")
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
              StatusId = @StatusId,
              Source = @Source,
              PublicationDate = @PublicationDate
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
          SET StatusId = 2
          WHERE ConnectionId = @ConnectionId
          AND Source = 'XML_FILE'
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

      // ✅ MAPEO ESTÁNDAR SINCRONIZADO con PRIORIDADES INTELIGENTES (igual que XML Feed)
      const standardMappings = {
        'id': 'apply_url',           // ID -> campo temporal 
        'title': 'title',            // Título
        'jobtitle': 'title',         
        'content': 'description',    // Descripción
        'description': 'description',
        'company': 'company',        // Empresa
        'category': 'sector',        // Sector
        'url': 'apply_url',          // URL de aplicación
        'url_apply': 'apply_url',
        'application_url': 'apply_url',
        'apply_url': 'apply_url',
        'publication': 'published_at', // Fecha de publicación
        'publication_date': 'published_at',
        'date': 'published_at',
        'salary': 'salary_min',      // Salario
        'salary_min': 'salary_min',
        'salary_max': 'salary_max',
        'jobtype': 'contract_type',  // Tipo de contrato
        'job_type': 'contract_type',
        'tipo': 'contract_type',
        'vacancies': 'contract_type', // temporal
        'num_vacancies': 'contract_type'
      }

      // ✅ SISTEMA DE PRIORIDADES PARA UBICACIÓN: city > region > country > location > address > postcode
      const locationPriorities = [
        'city',      // Prioridad 1 (más específica)
        'region',    // Prioridad 2
        'country',   // Prioridad 3
        'location',  // Prioridad 4
        'address',   // Prioridad 5
        'postcode'   // Prioridad 6 (menos específica)
      ]

      // Crear mapeos automáticos con manejo inteligente de ubicación
      let locationMappingCreated = false

      // Primero, buscar el campo de ubicación con mayor prioridad
      for (const priorityField of locationPriorities) {
        const foundField = offerFields.find(field => field.toLowerCase() === priorityField)
        if (foundField && !locationMappingCreated) {
          mappings.push({
            ConnectionId: this.connection.id,
            ClientId: this.connection.clientId,
            SourceField: foundField,
            TargetField: 'location',
            TransformationType: this.detectMappingType(foundField, sampleOffer[foundField]),
            TransformationRule: null
          })
          locationMappingCreated = true
          console.log(`🎯 XML MANUAL PRIORITY MAPPING: ${foundField} → location (priority: ${locationPriorities.indexOf(priorityField) + 1})`)
          break
        }
      }

      // Luego, crear mapeos para todos los otros campos (excepto ubicación)
      for (const sourceField of offerFields) {
        const lowerField = sourceField.toLowerCase()
        
        // Skip si es un campo de ubicación (ya procesado arriba)
        if (locationPriorities.includes(lowerField)) {
          continue
        }

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
    if (name.includes("url") || name.includes("link") || stringValue.startsWith("http")) {
      return "STRING"
    }

    // Fechas
    if (name.includes("date") || name.includes("publication") || name.includes("created")) {
      return "DATE"
    }

    // Números
    if (name.includes("id") || name.includes("count") || name.includes("number") || name.includes("salary") || name.includes("vacancies")) {
      return "NUMBER"
    }

    // Por defecto string
    return "STRING"
  }
}

module.exports = XMLFileProcessor