const axios = require("axios")
const xml2js = require("xml2js")
const { pool, sql } = require("../db/db")
const { updateOfferStatusByGoals } = require("../utils/statusUpdater")

class XMLProcessor {
  constructor(connection) {
    this.connection = connection
    console.log("🔧 XMLProcessor initialized for connection:", connection.id)
  }

  // ✅ MÉTODO PARA DETECTAR CAMPOS DEL XML
  async detectFields() {
    try {
      console.log("🔍 Detecting fields from XML...")

      // Fetch XML data
      const url = this.connection.url || this.connection.Url || this.connection.Endpoint
      if (!url) {
        throw new Error("URL not found in connection")
      }

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })

      const xmlData = response.data

      // Parse XML
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true,
      })
      const result = await parser.parseStringPromise(xmlData)

      // Find the first offer to analyze structure
      let firstOffer = null

      // Try different possible XML structures
      if (result.offers && result.offers.offer) {
        firstOffer = Array.isArray(result.offers.offer) ? result.offers.offer[0] : result.offers.offer
      } else if (result.jobs && result.jobs.job) {
        firstOffer = Array.isArray(result.jobs.job) ? result.jobs.job[0] : result.jobs.job
      } else if (result.feed && result.feed.job) {
        firstOffer = Array.isArray(result.feed.job) ? result.feed.job[0] : result.feed.job
      } else if (result.job) {
        firstOffer = Array.isArray(result.job) ? result.job[0] : result.job
      } else {
        // Si no encuentra estructura conocida, usar el primer nivel que sea array
        const firstKey = Object.keys(result)[0]
        if (result[firstKey] && Array.isArray(result[firstKey])) {
          firstOffer = result[firstKey][0]
        } else if (result[firstKey] && typeof result[firstKey] === "object") {
          const secondKey = Object.keys(result[firstKey])[0]
          if (result[firstKey][secondKey]) {
            firstOffer = Array.isArray(result[firstKey][secondKey])
              ? result[firstKey][secondKey][0]
              : result[firstKey][secondKey]
          }
        }
      }

      if (!firstOffer) {
        console.warn("⚠️ No offers found in XML for field detection")
        return []
      }

      console.log("📋 Sample offer for field detection:", Object.keys(firstOffer))

      // Generate field descriptions
      const fields = Object.keys(firstOffer).map((fieldName) => {
        const value = firstOffer[fieldName]
        const stringValue = String(value || "").trim()

        return {
          name: fieldName,
          type: this.detectFieldType(fieldName, stringValue),
          sample: stringValue.length > 100 ? stringValue.substring(0, 100) + "..." : stringValue,
          required: false,
          description: this.generateFieldDescription(fieldName, stringValue),
        }
      })

      console.log(`✅ Detected ${fields.length} fields from XML`)
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
    if (name.includes("url") || name.includes("link") || (value && value.startsWith("http"))) {
      return "url"
    }

    // Fechas
    if (name.includes("date") || name.includes("publication") || name.includes("created")) {
      return "date"
    }

    // Números
    if (name.includes("id") || name.includes("count") || name.includes("number") || name.includes("salary")) {
      return "number"
    }

    // Por defecto string
    return "string"
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
      company_logo_url: "Logo de la empresa",
    }

    return descriptions[name] || `Campo: ${fieldName}`
  }

  // ✅ MÉTODO PARA PROBAR LA CONEXIÓN
  async test() {
    try {
      console.log("🧪 Testing XML connection...")

      const url = this.connection.url || this.connection.Url || this.connection.Endpoint
      if (!url) {
        throw new Error("URL not found in connection")
      }

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })

      const xmlData = response.data
      const parser = new xml2js.Parser({ explicitArray: false })
      const result = await parser.parseStringPromise(xmlData)

      console.log("✅ XML connection test successful")
      return {
        success: true,
        message: "Conexión XML válida",
        sampleData: result,
      }
    } catch (error) {
      console.error("❌ XML connection test failed:", error)
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

  async fetch() {
    try {
      const url = this.connection.url || this.connection.URL || this.connection.Url

      if (!url) {
        console.error("❌ No URL found in connection:", Object.keys(this.connection))
        throw new Error("URL not found in connection")
      }

      // Validar que la URL sea válida
      try {
        new URL(url)
      } catch (urlError) {
        console.error("❌ Invalid URL format:", url)
        throw new Error(`Invalid URL format: ${url}`)
      }

      console.log(`🔗 Fetching XML from: ${url}`)

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })

      console.log(`✅ XML fetched successfully, size: ${response.data.length} chars`)
      return response.data
    } catch (error) {
      console.error("❌ Error fetching XML:", error.message)
      throw new Error(`Error fetching XML: ${error.message}`)
    }
  }

  async parseXML(xml) {
    try {
      console.log("🔄 Parsing XML...")
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true,
      })
      const result = await parser.parseStringPromise(xml)
      console.log("✅ XML parsed successfully")
      return result
    } catch (error) {
      console.error("❌ Error parsing XML:", error)
      throw new Error(`Error parsing XML: ${error.message}`)
    }
  }

  async process(batchSize = 100) {
    try {
      console.log("🔄 Starting XML processing...")

      // 1. Cargar mappings
      const mappings = await this.loadMappings()

      if (mappings.length === 0) {
        console.log("⚠️ No mappings found, using default mapping")
      }

      // 2. Obtener XML
      const xml = await this.fetch()

      // 3. Parsear XML
      const parsed = await this.parseXML(xml)

      // 4. Extraer ofertas - buscar en múltiples estructuras posibles
      let offers = []
      if (parsed.jobs && parsed.jobs.job) {
        offers = Array.isArray(parsed.jobs.job) ? parsed.jobs.job : [parsed.jobs.job]
      } else if (parsed.job) {
        offers = Array.isArray(parsed.job) ? parsed.job : [parsed.job]
      } else if (parsed.offers && parsed.offers.offer) {
        offers = Array.isArray(parsed.offers.offer) ? parsed.offers.offer : [parsed.offers.offer]
      } else if (parsed.offer) {
        offers = Array.isArray(parsed.offer) ? parsed.offer : [parsed.offer]
      } else if (parsed.vacancies && parsed.vacancies.vacancy) {
        offers = Array.isArray(parsed.vacancies.vacancy) ? parsed.vacancies.vacancy : [parsed.vacancies.vacancy]
      } else {
        // Si no encuentra estructura conocida, usar el primer nivel que sea array
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

      console.log(`📊 Found ${offers.length} offers in XML`)

      if (offers.length === 0) {
        console.log("⚠️ No offers found in XML structure:", Object.keys(parsed))
        return { imported: 0, errors: 0, failedOffers: [] }
      }

      // 5. Transformar según mappings
      const transformedOffers = offers.map((offer) => this.mapToStandardFormat(offer, mappings))

      // 6. Procesar por lotes - aumentado el tamaño de lote para mejorar rendimiento
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

      // 7. Archivar ofertas antiguas (CORREGIDO)
      console.log("🗄️ Starting archival process...")
      await this.archiveOldOffers(transformedOffers.map((o) => o.ExternalId))

      console.log(`✅ Processing completed: ${totalProcessed} processed, ${totalFailed} failed`)

      // 8. Actualizar estados automáticos por presupuesto/objetivos
      if (totalProcessed > 0) {
        console.log("🎯 Updating automatic status based on budget/goals...")
        await updateOfferStatusByGoals(this.connection.id)
      }

      // 9. Generar mapeo automático SIEMPRE que se procesen ofertas exitosamente
      console.log(`🚀 CLAUDE DEBUG: totalProcessed = ${totalProcessed}, offers.length = ${offers.length}`)
      if (totalProcessed > 0) {
        console.log("🔄 Generating/updating automatic mapping...")
        await this.generateAutomaticMapping(offers[0])
      } else if (offers.length > 0) {
        console.log("🚀 CLAUDE DEBUG: totalProcessed is 0 but offers exist, generating mapping anyway...")
        await this.generateAutomaticMapping(offers[0])
      } else {
        console.log("🚀 CLAUDE DEBUG: No offers to generate mapping from")
      }

      return {
        imported: totalProcessed,
        errors: totalFailed,
        failedOffers,
      }
    } catch (error) {
      console.error("❌ Error in XML processing:", error)
      throw new Error(`Error processing XML: ${error.message}`)
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
          let value
          if (mapping.SourceField === "content") {
            value = offer.content
          } else {
            value = this.getValueFromPath(offer, mapping.SourceField)
          }

          let transformedValue = this.transformValue(
            value,
            mapping.TransformationType || "STRING",
            mapping.TransformationRule,
          )
          
          // Aplicar limpieza de HTML automáticamente para descripciones
          if (mapping.TargetField === 'description' && transformedValue && typeof transformedValue === 'string') {
            transformedValue = this.cleanHtmlContent(transformedValue)
          }
          
          standardOffer[mapping.TargetField] = transformedValue
        } catch (error) {
          standardOffer[mapping.TargetField] = null
        }
      }
    } else {
      // Mapeo automático por defecto
      standardOffer.ExternalId = String(offer.id || offer.ID || offer.Id || Math.random().toString(36).substr(2, 9))
      standardOffer.Title = String(offer.title || offer.jobtitle || offer.job_title || "")
      standardOffer.JobTitle = String(offer.jobtitle || offer.job_title || offer.title || "")
      const rawDescription = String(offer.content || offer.description || offer.job_description || "")
      standardOffer.Description = this.cleanHtmlContent(rawDescription)
      standardOffer.CompanyName = String(offer.company || offer.company_name || "")
      standardOffer.Sector = String(offer.category || offer.sector || "")
      standardOffer.Address = String(offer.address || offer.location || "")
      standardOffer.Country = String(offer.pais || offer.country || "")
      standardOffer.Region = String(offer.region || "")
      standardOffer.City = String(offer.city || offer.ciudad || "")
      standardOffer.Postcode = String(offer.postcode || offer.postal_code || "")
      standardOffer.Vacancies = Number(offer.vacancies || offer.num_vacancies || 1)
      standardOffer.JobType = String(offer.jobtype || offer.job_type || "")
      standardOffer.ExternalUrl = String(offer.url || offer.external_url || "")
      standardOffer.ApplicationUrl = String(offer.url_apply || offer.application_url || offer.apply_url || "")
      standardOffer.PublicationDate = this.parseDate(offer.publication || offer.publication_date || offer.date)
      standardOffer.SalaryMin = Number(offer.salary_min || offer.salaryMin || 0) || null
      standardOffer.SalaryMax = Number(offer.salary_max || offer.salaryMax || 0) || null
      standardOffer.CountryId = Number(offer.idpais || offer.countryId || null) || null
      standardOffer.RegionId = Number(offer.idregion || offer.regionId || null) || null
      standardOffer.CityId = Number(offer.idcity || offer.cityId || null) || null
      standardOffer.Latitude = Number(offer.latitude || offer.lat || null) || null
      standardOffer.Longitude = Number(offer.longitude || offer.lng || null) || null
    }

    // Campos obligatorios
    standardOffer.ConnectionId = this.connection.id
    standardOffer.Source = "XML"
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

  // ✅ LIMPIAR ETIQUETAS HTML Y ENTIDADES
  cleanHtmlContent(content) {
    if (!content || typeof content !== 'string') return content

    try {
      // Limpiar etiquetas HTML comunes
      let cleaned = content
        .replace(/<br\s*\/?>/gi, '\n')           // <br> -> salto de línea
        .replace(/<\/p>/gi, '\n\n')             // </p> -> doble salto
        .replace(/<p[^>]*>/gi, '')              // <p> tags
        .replace(/<div[^>]*>/gi, '\n')          // <div> -> salto
        .replace(/<\/div>/gi, '')               // </div>
        .replace(/<ul[^>]*>/gi, '\n')           // <ul>
        .replace(/<\/ul>/gi, '\n')              // </ul>
        .replace(/<li[^>]*>/gi, '• ')           // <li> -> bullet
        .replace(/<\/li>/gi, '\n')              // </li>
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')  // <strong> -> **text**
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')            // <b> -> **text**
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')            // <em> -> *text*
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')              // <i> -> *text*
        .replace(/<[^>]+>/g, '')                              // Quitar todas las demás etiquetas
        .replace(/&nbsp;/g, ' ')                              // &nbsp; -> espacio
        .replace(/&amp;/g, '&')                               // &amp; -> &
        .replace(/&lt;/g, '<')                                // &lt; -> <
        .replace(/&gt;/g, '>')                                // &gt; -> >
        .replace(/&quot;/g, '"')                              // &quot; -> "
        .replace(/&#39;/g, "'")                               // &#39; -> '
        .replace(/\n\s*\n\s*\n/g, '\n\n')                    // Múltiples saltos -> doble
        .replace(/^\s+|\s+$/g, '')                            // Trim espacios inicio/fin
        .replace(/\s{2,}/g, ' ')                              // Múltiples espacios -> uno

      return cleaned
    } catch (error) {
      console.warn('⚠️ Error limpiando HTML:', error.message)
      return content
    }
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
        const stringValue = String(value || "")
        // Si es content/description, limpiar HTML
        if (rule === 'clean_html' || (stringValue.includes('<') && stringValue.includes('>'))) {
          return this.cleanHtmlContent(stringValue)
        }
        return stringValue
    }
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date()

    try {
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
        .input("UserId", sql.BigInt, this.connection.UserId || this.connection.userId || null)
        .input("Source", sql.NVarChar(10), offer.Source || "XML")
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
                ELSE 1  -- Activar las demás (recibidas en XML)
              END,
              UserId = @UserId,
              Source = @Source,
              PublicationDate = @PublicationDate,
              UpdatedAt = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (
              ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
              Country, CountryId, Region, RegionId, City, CityId, Postcode,
              Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
              ExternalUrl, ApplicationUrl, Budget, BudgetSpent, ApplicationsGoal,
              ApplicationsReceived, StatusId, ConnectionId, UserId, Source, PublicationDate, CreatedAt
            )
            VALUES (
              @ExternalId, @Title, @JobTitle, @Description, @CompanyName, @Sector, @Address,
              @Country, @CountryId, @Region, @RegionId, @City, @CityId, @Postcode,
              @Latitude, @Longitude, @Vacancies, @SalaryMin, @SalaryMax, @JobType,
              @ExternalUrl, @ApplicationUrl, @Budget, @BudgetSpent, @ApplicationsGoal,
              @ApplicationsReceived, @StatusId, @ConnectionId, @UserId, @Source, @PublicationDate, @CreatedAt
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
          AND Source = 'XML'
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
      console.log("🚀 CLAUDE DEBUG: generateAutomaticMapping XML CALLED WITH NEW CODE!")
      console.log("🚀 CLAUDE DEBUG: Sample offer keys:", Object.keys(sampleOffer))
      console.log("🔄 Generating automatic field mappings...")

      const mappings = []
      const offerFields = Object.keys(sampleOffer)

      // ✅ MAPEO ESTÁNDAR CORREGIDO con PRIORIDADES INTELIGENTES
      const standardMappings = {
        'id': 'url',                 // ID -> URL externa
        'title': 'title',            // Título
        'jobtitle': 'title',         
        'content': 'description',    // Descripción con limpieza HTML
        'description': 'description',
        'company': 'company',        // Empresa
        'category': 'sector',        // Sector
        'url': 'url',                // URL externa
        'url_apply': 'apply_url',    // URL de aplicación
        'application_url': 'apply_url',
        'apply_url': 'apply_url',
        'publication': 'published_at', // Fecha de publicación
        'publication_date': 'published_at',
        'date': 'published_at',
        'salary': 'salary_min',      // Salario
        'salary_min': 'salary_min',
        'salary_max': 'salary_max',
        'jobtype': 'contract_type',  // Tipo de contrato/modalidad
        'job_type': 'contract_type',
        'tipo': 'contract_type',
        'modalidad': 'contract_type',
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
      const locationFieldFound = new Set()
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
          console.log(`🎯 PRIORITY MAPPING: ${foundField} → location (priority: ${locationPriorities.indexOf(priorityField) + 1})`)
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
      console.log(`🚀 CLAUDE DEBUG: Inserting ${mappings.length} mappings to ClientFieldMappings...`)
      for (const mapping of mappings) {
        console.log(`🚀 CLAUDE DEBUG: Inserting mapping: ${mapping.SourceField} → ${mapping.TargetField}`)
        console.log(`🚀 CLAUDE DEBUG: ClientId = ${mapping.ClientId}, ConnectionId = ${mapping.ConnectionId}`)
        
        try {
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
          console.log(`✅ Successfully inserted mapping: ${mapping.SourceField} → ${mapping.TargetField}`)
        } catch (insertError) {
          console.error(`❌ Error inserting mapping ${mapping.SourceField} → ${mapping.TargetField}:`, insertError.message)
        }
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

module.exports = XMLProcessor


