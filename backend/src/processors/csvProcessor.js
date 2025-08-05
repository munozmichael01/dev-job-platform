const { pool, sql } = require("../db/db")
const csv = require('csv-parser')
const fs = require('fs')
const path = require('path')

class CSVProcessor {
  constructor(connection, filePath = null) {
    this.connection = connection
    this.filePath = filePath
    console.log("🔧 CSVProcessor initialized for connection:", connection.id)
  }

  // ✅ MÉTODO PARA DETECTAR CAMPOS DEL CSV
  async detectFields(filePath = null) {
    try {
      console.log("🔍 Detecting fields from CSV...")
      
      const csvFilePath = filePath || this.filePath
      if (!csvFilePath || !fs.existsSync(csvFilePath)) {
        throw new Error("CSV file path not provided or file doesn't exist")
      }

      return new Promise((resolve, reject) => {
        const fields = []
        let isFirstRow = true
        let sampleData = null

        fs.createReadStream(csvFilePath)
          .pipe(csv())
          .on('data', (row) => {
            if (isFirstRow) {
              // Obtener muestra de datos de la primera fila
              sampleData = row
              
              // Generar descripción de campos
              Object.keys(row).forEach(fieldName => {
                const value = row[fieldName] || ""
                const stringValue = String(value).trim()

                fields.push({
                  name: fieldName,
                  type: this.detectFieldType(fieldName, stringValue),
                  sample: stringValue.length > 100 ? stringValue.substring(0, 100) + "..." : stringValue,
                  required: false,
                  description: this.generateFieldDescription(fieldName, stringValue),
                })
              })
              
              isFirstRow = false
            }
          })
          .on('end', () => {
            console.log(`✅ Detected ${fields.length} fields from CSV`)
            resolve(fields)
          })
          .on('error', reject)
      })
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
      empresa: "Nombre de la empresa",
      puesto: "Puesto de trabajo",
      localidad: "Localidad",
      provincia: "Provincia",
      fecha: "Fecha",
      salario: "Salario",
      tipo: "Tipo de contrato"
    }

    return descriptions[name] || `Campo: ${fieldName}`
  }

  // ✅ MÉTODO PARA PROBAR LA CONEXIÓN (para archivos CSV subidos)
  async test(filePath = null) {
    try {
      console.log("🧪 Testing CSV file...")
      
      const csvFilePath = filePath || this.filePath
      if (!csvFilePath || !fs.existsSync(csvFilePath)) {
        throw new Error("CSV file path not provided or file doesn't exist")
      }

      // Leer las primeras 5 filas para validación
      return new Promise((resolve, reject) => {
        const sampleData = []
        let rowCount = 0

        fs.createReadStream(csvFilePath)
          .pipe(csv())
          .on('data', (row) => {
            if (rowCount < 5) {
              sampleData.push(row)
              rowCount++
            }
          })
          .on('end', () => {
            console.log("✅ CSV file test successful")
            resolve({
              success: true,
              message: "Archivo CSV válido",
              sampleData: sampleData,
              totalRows: rowCount
            })
          })
          .on('error', (error) => {
            reject({
              success: false,
              message: error.message,
            })
          })
      })
    } catch (error) {
      console.error("❌ CSV file test failed:", error)
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

  async process(filePath = null, batchSize = 100) {
    try {
      console.log("🔄 Starting CSV processing...")
      console.log(`🔍 CSV FILE PATH: ${filePath || this.filePath}`)

      const csvFilePath = filePath || this.filePath
      if (!csvFilePath || !fs.existsSync(csvFilePath)) {
        throw new Error("CSV file path not provided or file doesn't exist")
      }

      console.log(`🔍 File exists: ${fs.existsSync(csvFilePath)}`)
      console.log(`🔍 File size: ${fs.statSync(csvFilePath).size} bytes`)

      // 1. Cargar mappings
      const mappings = await this.loadMappings()
      console.log(`🔍 MAPPINGS LOADED: ${mappings.length} mappings found`)
      if (mappings.length > 0) {
        console.log(`🔍 MAPPINGS SAMPLE:`, mappings.slice(0, 3))
      }

      if (mappings.length === 0) {
        console.log("⚠️ No mappings found, using default mapping")
      }

      // 2. Procesar CSV
      console.log("🔄 Starting CSV parsing...")
      const offers = await this.parseCSV(csvFilePath)
      console.log(`📊 Found ${offers.length} offers in CSV`)
      
      // Log first offer structure for debugging
      if (offers.length > 0) {
        console.log(`🔍 RAW CSV FIRST OFFER:`, JSON.stringify(offers[0], null, 2))
        console.log(`🔍 First offer structure:`, Object.keys(offers[0]))
        console.log(`🔍 First offer field count:`, Object.keys(offers[0]).length)
      } else {
        console.log("❌ NO OFFERS PARSED FROM CSV!")
        return { imported: 0, errors: 1, failedOffers: [{ reason: "No data found in CSV file" }] }
      }

      // 3. Transformar según mappings
      console.log("🔄 Starting transformation to standard format...")
      const transformedOffers = offers.map((offer, index) => {
        console.log(`🔄 Transforming offer ${index + 1}/${offers.length}...`)
        const transformed = this.mapToStandardFormat(offer, mappings)
        if (index === 0) {
          console.log(`🔍 TRANSFORMED FIRST OFFER:`, JSON.stringify(transformed, null, 2))
        }
        return transformed
      })

      console.log(`🔍 TRANSFORMED ${transformedOffers.length} offers`)

      // 4. Procesar por lotes
      const batches = this.splitIntoBatches(transformedOffers, batchSize)
      console.log(`🔄 Created ${batches.length} batches of max ${batchSize} offers each`)
      
      let totalProcessed = 0
      let totalFailed = 0
      const failedOffers = []

      for (let i = 0; i < batches.length; i++) {
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batches[i].length} offers)...`)
        const batchResult = await this.processBatch(batches[i])
        console.log(`📊 Batch ${i + 1} results: ${batchResult.processed} processed, ${batchResult.failed.length} failed`)
        totalProcessed += batchResult.processed
        totalFailed += batchResult.failed.length
        failedOffers.push(...batchResult.failed)
        
        // Log first few failed offers for debugging
        if (batchResult.failed.length > 0) {
          console.log(`❌ First failed offer in batch ${i + 1}:`, batchResult.failed[0])
        }
      }

      // 5. Archivar ofertas antiguas
      console.log("🔄 Archiving old offers...")
      await this.archiveOldOffers(transformedOffers.map((o) => o.ExternalId))

      console.log(`✅ Processing completed: ${totalProcessed} processed, ${totalFailed} failed`)

      // 6. Generar mapeo automático SIEMPRE que se procesen ofertas exitosamente
      if (totalProcessed > 0) {
        console.log("🔄 Generating/updating automatic mapping...")
        console.log("🔍 MAPPING DEBUG: Sample offer fields:", Object.keys(offers[0]))
        console.log("🔍 MAPPING DEBUG: First 3 field samples:", Object.entries(offers[0]).slice(0, 3))
        await this.generateAutomaticMapping(offers[0])
      } else {
        console.log("⚠️ No offers processed successfully - skipping automatic mapping generation")
        console.log("🔍 FAILED OFFERS SUMMARY:", failedOffers.slice(0, 5))
      }

      return {
        imported: totalProcessed,
        errors: totalFailed,
        failedOffers,
      }
    } catch (error) {
      console.error("❌ Error in CSV processing:", error)
      console.error("❌ Error stack:", error.stack)
      throw new Error(`Error processing CSV: ${error.message}`)
    }
  }

  async parseCSV(filePath) {
    console.log("🚀 CLAUDE DEBUG: parseCSV FUNCTION CALLED WITH NEW CODE!")
    console.log(`🚀 CLAUDE DEBUG: FilePath: ${filePath}`)
    return new Promise(async (resolve, reject) => {
      try {
        // ✅ DETECTAR AUTOMÁTICAMENTE SI HAY HEADERS
        console.log("🚀 CLAUDE DEBUG: About to detect headers...")
        const hasHeaders = await this.detectHeaders(filePath)
        console.log(`🚀 CLAUDE DEBUG: Headers detected: ${hasHeaders}`)
        
        const offers = []
        let isFirstRow = true
        let headerRow = null
        
        // ✅ CONFIGURAR CSV PARSER FLEXIBLE
        const csvOptions = {
          headers: false, // Manejar headers manualmente
          skipEmptyLines: true,
          quote: '"',
          escape: '"',
          raw: false,
          strictColumnHandling: false,
          maxRowBytes: 100000,
          skipLinesWithError: false
        }
        
        fs.createReadStream(filePath)
          .pipe(csv(csvOptions))
          .on('data', (row) => {
            try {
              if (isFirstRow && hasHeaders) {
                // Guardar headers y saltar esta fila
                headerRow = row
                isFirstRow = false
                console.log(`📋 Headers found:`, headerRow.slice(0, 10))
                return
              }
              
              isFirstRow = false
              
              // ✅ CONVERTIR ARRAY A OBJETO
              const offerObject = {}
              
              if (hasHeaders && headerRow) {
                // ✅ USAR HEADERS COMO NOMBRES DE CAMPO
                for (let i = 0; i < row.length; i++) {
                  let value = row[i] || ""
                  
                  // ✅ LIMPIAR HTML EMBEBIDO Y CARACTERES ESPECIALES
                  if (typeof value === 'string') {
                    value = value
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/&nbsp;/g, ' ')
                      .trim()
                  }
                  
                  const fieldName = headerRow[i] || `col_${i}`
                  offerObject[fieldName] = value
                  offerObject[`col_${i}`] = value // También mantener posición
                }
              } else {
                // ✅ SIN HEADERS - USAR POSICIONES
                for (let i = 0; i < row.length; i++) {
                  let value = row[i] || ""
                  
                  if (typeof value === 'string') {
                    value = value
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/&nbsp;/g, ' ')
                      .trim()
                  }
                  
                  offerObject[`col_${i}`] = value
                }
                
                // Mapeo específico para CSV sin headers
                offerObject.id = offerObject.col_0
                offerObject.title = offerObject.col_24
                offerObject.location = offerObject.col_26
              }
              
              offers.push(offerObject)
            } catch (rowError) {
              console.warn(`⚠️ Error processing CSV row: ${rowError.message}`)
            }
          })
          .on('end', () => {
            console.log(`✅ CSV parsed successfully, ${offers.length} rows`)
            if (offers.length > 0) {
              console.log(`✅ First offer structure:`, Object.keys(offers[0]).slice(0, 10))
              console.log(`✅ Sample values:`, {
                firstKey: Object.keys(offers[0])[0],
                firstValue: offers[0][Object.keys(offers[0])[0]],
                hasId: !!offers[0].id,
                hasTitle: !!offers[0].title
              })
            }
            resolve(offers)
          })
          .on('error', reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  // ✅ DETECTAR SI LA PRIMERA FILA CONTIENE HEADERS
  async detectHeaders(filePath) {
    return new Promise((resolve) => {
      let firstRow = null
      
      fs.createReadStream(filePath)
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
          if (!firstRow) {
            firstRow = row
            
            // ✅ HEURÍSTICAS PARA DETECTAR HEADERS
            let headerScore = 0
            let totalFields = Math.min(row.length, 10) // Analizar primeros 10 campos
            
            for (let i = 0; i < totalFields; i++) {
              const value = String(row[i] || "").trim()
              
              if (value) {
                // Headers típicos: contienen texto, no solo números
                if (isNaN(Number(value))) headerScore++
                
                // Headers comunes
                if (/^(id|title|name|company|city|location|url|date|publication|salary|description|content)$/i.test(value)) {
                  headerScore += 2
                }
                
                // Headers en español
                if (/^(titulo|empresa|ciudad|ubicacion|fecha|salario|descripcion|contenido|puesto)$/i.test(value)) {
                  headerScore += 2
                }
              }
            }
            
            // Si más del 50% parecen headers, asumir que tiene headers
            const hasHeaders = headerScore > (totalFields * 0.5)
            console.log(`🔍 Header detection - Score: ${headerScore}/${totalFields}, Has headers: ${hasHeaders}`)
            resolve(hasHeaders)
          }
        })
        .on('error', () => resolve(false))
    })
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

    console.log(`🔄 Starting processBatch with ${offers.length} offers`)
    
    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i]
      console.log(`🔄 Processing offer ${i + 1}/${offers.length}: ${offer.ExternalId}`)
      
      try {
        console.log(`🔍 About to save offer with data:`, {
          ExternalId: offer.ExternalId,
          Title: offer.Title,
          CompanyName: offer.CompanyName,
          ConnectionId: offer.ConnectionId
        })
        
        await this.saveOffer(offer)
        console.log(`✅ Successfully saved offer ${offer.ExternalId}`)
        results.processed++
      } catch (error) {
        console.error(`❌ Failed to save offer ${offer.ExternalId}:`, error.message)
        console.error(`❌ Full error:`, error)
        console.error(`❌ Offer data that failed:`, JSON.stringify(offer, null, 2))
        results.failed.push({
          id: offer.ExternalId,
          reason: error.message,
          fullError: error.toString()
        })
      }
    }

    console.log(`📊 processBatch completed: ${results.processed} processed, ${results.failed.length} failed`)
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
      // Mapeo automático por defecto - adaptado para CSV en español
      standardOffer.ExternalId = String(offer.id || offer.ID || offer.Id || offer.codigo || offer.identifier || offer.externalId || Math.random().toString(36).substr(2, 9))
      standardOffer.Title = String(offer.title || offer.titulo || offer.puesto || offer.jobtitle || offer.job_title || "")
      standardOffer.JobTitle = String(offer.jobtitle || offer.puesto || offer.job_title || offer.title || offer.titulo || "")
      standardOffer.Description = String(offer.content || offer.description || offer.descripcion || offer.job_description || "")
      standardOffer.CompanyName = String(offer.company || offer.empresa || offer.company_name || "")
      standardOffer.Sector = String(offer.category || offer.categoria || offer.sector || "")
      standardOffer.Address = String(offer.address || offer.direccion || offer.location || offer.ubicacion || "")
      standardOffer.Country = String(offer.pais || offer.country || offer.país || "España")
      standardOffer.Region = String(offer.region || offer.provincia || offer.comunidad || "")
      standardOffer.City = String(offer.city || offer.ciudad || offer.localidad || offer.municipio || "")
      standardOffer.Postcode = String(offer.postcode || offer.codigo_postal || offer.cp || offer.postal_code || "")
      standardOffer.Vacancies = Number(offer.vacancies || offer.vacantes || offer.num_vacancies || offer.numero_vacantes || 1)
      standardOffer.JobType = String(offer.jobtype || offer.tipo_contrato || offer.job_type || offer.tipo || "")
      standardOffer.ExternalUrl = String(offer.url || offer.enlace || offer.external_url || "")
      standardOffer.ApplicationUrl = String(offer.url_apply || offer.url_aplicacion || offer.application_url || offer.apply_url || "")
      standardOffer.PublicationDate = this.parseDate(offer.publication || offer.fecha || offer.publication_date || offer.date || offer.fecha_publicacion)
      standardOffer.SalaryMin = Number(offer.salary_min || offer.salario_min || offer.salaryMin || 0) || null
      standardOffer.SalaryMax = Number(offer.salary_max || offer.salario_max || offer.salaryMax || 0) || null
      standardOffer.CountryId = Number(offer.idpais || offer.countryId || offer.id_pais || null) || null
      standardOffer.RegionId = Number(offer.idregion || offer.regionId || offer.id_region || null) || null
      standardOffer.CityId = Number(offer.idcity || offer.cityId || offer.id_ciudad || null) || null
      standardOffer.Latitude = Number(offer.latitude || offer.lat || offer.latitud || null) || null
      standardOffer.Longitude = Number(offer.longitude || offer.lng || offer.longitud || null) || null
    }

    // Campos obligatorios
    standardOffer.ConnectionId = this.connection.id
    standardOffer.Source = "CSV"
    standardOffer.CreatedAt = new Date()
    standardOffer.StatusId = 1
    standardOffer.BudgetSpent = 0
    standardOffer.ApplicationsReceived = 0

    // ✅ VALIDACIÓN MEJORADA - Asegurar campos requeridos no vacíos
    if (!standardOffer.ExternalId || standardOffer.ExternalId.trim() === '') {
      standardOffer.ExternalId = `csv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    }
    if (!standardOffer.Title || standardOffer.Title.trim() === '') {
      standardOffer.Title = 'Oferta de trabajo'
    }
    if (!standardOffer.CompanyName || standardOffer.CompanyName.trim() === '') {
      standardOffer.CompanyName = 'Empresa'
    }
    if (!standardOffer.PublicationDate || isNaN(new Date(standardOffer.PublicationDate))) {
      standardOffer.PublicationDate = new Date()
    }

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
      // Manejar diferentes formatos de fecha comunes en CSV
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
      console.log(`💾 Starting saveOffer for ${offer.ExternalId}`)
      console.log(`💾 Preparing SQL parameters for offer:`, {
        ExternalId: offer.ExternalId,
        Title: offer.Title,
        CompanyName: offer.CompanyName,
        ConnectionId: offer.ConnectionId,
        PublicationDate: offer.PublicationDate
      })

      const result = await pool
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
        .input("Source", sql.NVarChar(10), offer.Source || "CSV")
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
      
      console.log(`💾 SQL query executed successfully for ${offer.ExternalId}`)
      console.log(`💾 Query result:`, { rowsAffected: result.rowsAffected })
      
    } catch (error) {
      console.error(`💾 SQL Error for offer ${offer.ExternalId}:`, error.message)
      console.error(`💾 SQL Error details:`, error)
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
          AND Source = 'CSV'
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
      console.log("🚀 CLAUDE DEBUG: generateAutomaticMapping CSV CALLED WITH NEW CODE!")
      console.log("🚀 CLAUDE DEBUG: Sample offer keys:", Object.keys(sampleOffer))
      console.log("🔄 Generating automatic field mappings...")
      console.log("🔍 MAPPING DEBUG: generateAutomaticMapping called with fields:", Object.keys(sampleOffer))

      const mappings = []
      const offerFields = Object.keys(sampleOffer)

      // ✅ MAPEO ESTÁNDAR CORREGIDO - Incluir mapeos por posición de columna Y por nombre
      const standardMappings = {
        // Mapeos por posición de columna (para CSV sin headers)
        'col_0': 'apply_url',    // ID de la oferta -> campo temporal
        'col_24': 'title',       // Título de la oferta
        'col_26': 'location',    // Ciudad/ubicación
        'id': 'apply_url',       // ID mapeado
        'title': 'title',        // Título mapeado
        'location': 'location',  // Ubicación mapeada
        
        // Mapeos tradicionales por nombre (para compatibilidad)
        'codigo': 'apply_url',
        'titulo': 'title',
        'puesto': 'title',
        'jobtitle': 'title',
        'job_title': 'title',
        'content': 'description',
        'description': 'description',
        'descripcion': 'description',
        'company': 'company',
        'empresa': 'company',
        'company_name': 'company',
        'category': 'sector',
        'categoria': 'sector',
        'sector': 'sector',
        'address': 'location',
        'direccion': 'location',
        'ubicacion': 'location',
        'city': 'location',
        'ciudad': 'location',
        'localidad': 'location',
        'municipio': 'location',
        'region': 'location',
        'provincia': 'location',
        'comunidad': 'location',
        'country': 'location',
        'pais': 'location',
        'país': 'location',
        'postcode': 'location',
        'codigo_postal': 'location',
        'cp': 'location',
        'postal_code': 'location',
        'url': 'apply_url',
        'enlace': 'apply_url',
        'external_url': 'apply_url',
        'url_apply': 'apply_url',
        'url_aplicacion': 'apply_url',
        'application_url': 'apply_url',
        'apply_url': 'apply_url',
        'publication': 'published_at',
        'fecha': 'published_at',
        'publication_date': 'published_at',
        'date': 'published_at',
        'fecha_publicacion': 'published_at',
        'salary': 'salary_min',
        'salario': 'salary_min',
        'salary_min': 'salary_min',
        'salario_min': 'salary_min',
        'salary_max': 'salary_max',
        'salario_max': 'salary_max',
        'jobtype': 'contract_type',
        'tipo_contrato': 'contract_type',
        'job_type': 'contract_type',
        'tipo': 'contract_type',
        'vacancies': 'contract_type',  // temporal
        'vacantes': 'contract_type',
        'num_vacancies': 'contract_type',
        'numero_vacantes': 'contract_type'
      }

      // Crear mapeos automáticos
      for (const sourceField of offerFields) {
        const lowerField = sourceField.toLowerCase()
        const targetField = standardMappings[lowerField]

        if (targetField) {
          mappings.push({
            ConnectionId: this.connection.id,
            SourceField: sourceField,
            TargetField: targetField,
            TransformationType: this.detectMappingType(sourceField, sampleOffer[sourceField]),
            TransformationRule: null
          })
        }
      }

      // Guardar mapeos en la base de datos
      console.log(`🔄 Insertando ${mappings.length} mapeos en ClientFieldMappings...`)
      for (const mapping of mappings) {
        console.log(`📋 Insertando mapeo: ${mapping.SourceField} → ${mapping.TargetField}`)
        
        try {
          await pool
            .request()
            .input("ConnectionId", sql.Int, mapping.ConnectionId)
            .input("SourceField", sql.NVarChar(255), mapping.SourceField)
            .input("TargetField", sql.NVarChar(255), mapping.TargetField)
            .input("TransformationType", sql.NVarChar(50), mapping.TransformationType)
            .input("TransformationRule", sql.NVarChar(sql.MAX), mapping.TransformationRule)
            .query(`
              MERGE INTO ClientFieldMappings WITH (HOLDLOCK) AS Target
              USING (SELECT @ConnectionId AS ConnectionId, @SourceField AS SourceField, @TargetField AS TargetField) AS Source
              ON Target.ConnectionId = Source.ConnectionId 
              AND Target.SourceField = Source.SourceField
              AND Target.TargetField = Source.TargetField
              WHEN MATCHED THEN
                  UPDATE SET 
                      TransformationType = @TransformationType,
                      TransformationRule = @TransformationRule
              WHEN NOT MATCHED THEN
                  INSERT (ConnectionId, SourceField, TargetField, TransformationType, TransformationRule)
                  VALUES (@ConnectionId, @SourceField, @TargetField, @TransformationType, @TransformationRule);
            `)
          console.log(`✅ Mapeo insertado exitosamente: ${mapping.SourceField} → ${mapping.TargetField}`)
        } catch (insertError) {
          console.error(`❌ Error insertando mapeo ${mapping.SourceField} → ${mapping.TargetField}:`, insertError.message)
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
    if (name.includes("url") || name.includes("link") || name.includes("enlace") || stringValue.startsWith("http")) {
      return "STRING"
    }

    // Fechas
    if (name.includes("date") || name.includes("fecha") || name.includes("publication") || name.includes("created")) {
      return "DATE"
    }

    // Números
    if (name.includes("id") || name.includes("codigo") || name.includes("count") || name.includes("number") || name.includes("salary") || name.includes("salario") || name.includes("vacancies") || name.includes("vacantes")) {
      return "NUMBER"
    }

    // Por defecto string
    return "STRING"
  }
}

module.exports = CSVProcessor