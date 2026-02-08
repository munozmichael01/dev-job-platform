#!/usr/bin/env node
/**
 * Script para generar reporte de métricas por canales
 * Analiza el CSV de datos enriquecidos y genera TOP 25 completos por categorías
 * ACTUALIZADO: Usa JobTitleDenomination (título estructurado) en lugar de JobTitle
 */

const fs = require('fs');
const path = require('path');

// Simple CSV parser
function parseCSV(filePath) {
  console.log(`📁 Cargando datos desde: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }

  console.log(`✅ Cargados ${data.length.toLocaleString()} registros`);
  return data;
}

// Agrupar y agregar métricas
function aggregateByChannel(data, groupCols, name) {
  console.log(`\n🔄 Procesando: ${name}`);

  const groups = {};

  data.forEach(row => {
    // Filtrar registros sin Source
    if (!row.Source || row.Source === '') return;

    // Verificar que las columnas de agrupación existan
    const missingCols = groupCols.filter(col => !row[col] || row[col] === '');
    if (missingCols.length > 0) return;

    // Crear clave de grupo
    const groupKey = groupCols.map(col => row[col]).join('||') + '||' + row.Source;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        ...Object.fromEntries(groupCols.map(col => [col, row[col]])),
        Source: row.Source,
        ListImpressions: 0,
        DetailViews: 0,
        PageVisits: 0,
        Applications: 0,
        TotalEngagements: 0,
        TotalTouchpoints: 0,
        UniqueOffers: new Set()
      };
    }

    const group = groups[groupKey];
    group.ListImpressions += parseInt(row.ListImpressions) || 0;
    group.DetailViews += parseInt(row.DetailViews) || 0;
    group.PageVisits += parseInt(row.PageVisits) || 0;
    group.Applications += parseInt(row.Applications) || 0;
    group.TotalEngagements += parseInt(row.TotalEngagements) || 0;
    group.TotalTouchpoints += parseInt(row.TotalTouchpoints) || 0;
    group.UniqueOffers.add(row.OfferId);
  });

  // Convertir a array y calcular métricas
  const result = Object.values(groups).map(g => ({
    ...g,
    UniqueOffers: g.UniqueOffers.size,
    ConversionRate: g.TotalTouchpoints > 0
      ? ((g.Applications / g.TotalTouchpoints) * 100).toFixed(2)
      : '0.00',
    EngagementRate: g.TotalTouchpoints > 0
      ? ((g.TotalEngagements / g.TotalTouchpoints) * 100).toFixed(2)
      : '0.00'
  }));

  // Ordenar por aplicaciones descendente
  result.sort((a, b) => b.Applications - a.Applications);

  return result.slice(0, 25); // Top 25
}

// Formatear tabla para consola
function printTable(data, title) {
  console.log('\n' + '='.repeat(150));
  console.log(`📊 ${title}`);
  console.log('='.repeat(150));

  if (data.length === 0) {
    console.log('   (Sin datos)');
    return;
  }

  // Imprimir encabezados
  const keys = Object.keys(data[0]).filter(k => k !== 'UniqueOffers');
  console.log(keys.join('\t| '));
  console.log('-'.repeat(150));

  // Imprimir TODAS las filas (Top 25)
  data.forEach((row, idx) => {
    const values = keys.map(k => {
      const val = row[k];
      if (typeof val === 'number') return val.toLocaleString();
      return val;
    });
    console.log(`${idx + 1}. ${values.join('\t| ')}`);
  });

  console.log(`\n✅ Total registros: ${data.length}`);
}

// Guardar reportes en CSV
function saveReportsToCSV(reports, basePath) {
  const outputDir = path.join(path.dirname(basePath), 'channel-reports');

  // Eliminar directorio anterior si existe
  if (fs.existsSync(outputDir)) {
    console.log('\n🗑️  Eliminando reportes anteriores...');
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  // Crear directorio limpio
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('✅ Directorio limpio creado');

  Object.entries(reports).forEach(([name, data]) => {
    if (data.length === 0) return;

    const csvPath = path.join(outputDir, `${name}_top25.csv`);
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(v =>
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(',')
    );

    fs.writeFileSync(csvPath, [headers, ...rows].join('\n'));
    console.log(`   ✅ ${name}_top25.csv (${data.length} registros)`);
  });
}

// Main
function generateReport() {
  const csvPath = 'C:\\Dev\\job-platform\\Queries\\METRICAS POR OFERTA Y CANALES ULTIMOS 30 DIAS - DATOS ENRIQUECIDOS.csv';

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: No se encontró el archivo: ${csvPath}`);
    process.exit(1);
  }

  const data = parseCSV(csvPath);
  const reports = {};

  // 1. TOP 25 REGIONES
  reports.regiones = aggregateByChannel(data, ['Region'], 'TOP 25 REGIONES POR CANAL');
  printTable(reports.regiones, 'TOP 25 REGIONES POR CANAL');

  // 2. TOP 25 CIUDADES
  reports.ciudades = aggregateByChannel(data, ['City', 'Region'], 'TOP 25 CIUDADES POR CANAL');
  printTable(reports.ciudades, 'TOP 25 CIUDADES POR CANAL');

  // 3. TOP 25 JOB TITLE DENOMINATIONS (ESTRUCTURADO) ✅ ACTUALIZADO
  reports.job_title_denominations = aggregateByChannel(
    data.filter(r => r.JobTitleDenomination && r.JobTitleDenomination !== ''),
    ['JobTitleDenomination'],
    'TOP 25 JOB TITLE DENOMINATIONS (ESTRUCTURADO) POR CANAL'
  );
  printTable(reports.job_title_denominations, 'TOP 25 JOB TITLE DENOMINATIONS (ESTRUCTURADO) POR CANAL');

  // 4. TOP 25 AREAS
  reports.areas = aggregateByChannel(data, ['Area'], 'TOP 25 AREAS POR CANAL');
  printTable(reports.areas, 'TOP 25 AREAS POR CANAL');

  // 5. TOP 25 SECTORES
  reports.sectores = aggregateByChannel(data, ['Sector'], 'TOP 25 SECTORES POR CANAL');
  printTable(reports.sectores, 'TOP 25 SECTORES POR CANAL');

  // 6. TOP 25 JOB TITLE DENOMINATION / REGIONES ✅ ACTUALIZADO
  reports.jobtitle_denomination_region = aggregateByChannel(
    data.filter(r => r.JobTitleDenomination && r.JobTitleDenomination !== '' && r.Region && r.Region !== ''),
    ['JobTitleDenomination', 'Region'],
    'TOP 25 JOB TITLE DENOMINATION / REGIONES'
  );
  printTable(reports.jobtitle_denomination_region, 'TOP 25 JOB TITLE DENOMINATION / REGIONES');

  // 7. TOP 25 JOB TITLE DENOMINATION / CIUDADES ✅ ACTUALIZADO
  reports.jobtitle_denomination_city = aggregateByChannel(
    data.filter(r => r.JobTitleDenomination && r.JobTitleDenomination !== '' && r.City && r.City !== ''),
    ['JobTitleDenomination', 'City', 'Region'],
    'TOP 25 JOB TITLE DENOMINATION / CIUDADES'
  );
  printTable(reports.jobtitle_denomination_city, 'TOP 25 JOB TITLE DENOMINATION / CIUDADES');

  // 8. TOP 25 AREA / REGIONES
  reports.area_region = aggregateByChannel(
    data.filter(r => r.Area && r.Area !== '' && r.Region && r.Region !== ''),
    ['Area', 'Region'],
    'TOP 25 AREA / REGIONES'
  );
  printTable(reports.area_region, 'TOP 25 AREA / REGIONES');

  // 9. TOP 25 AREA / CIUDADES
  reports.area_city = aggregateByChannel(
    data.filter(r => r.Area && r.Area !== '' && r.City && r.City !== ''),
    ['Area', 'City', 'Region'],
    'TOP 25 AREA / CIUDADES'
  );
  printTable(reports.area_city, 'TOP 25 AREA / CIUDADES');

  // 10. TOP 25 SECTOR / REGIONES
  reports.sector_region = aggregateByChannel(
    data.filter(r => r.Sector && r.Sector !== '' && r.Region && r.Region !== ''),
    ['Sector', 'Region'],
    'TOP 25 SECTOR / REGIONES'
  );
  printTable(reports.sector_region, 'TOP 25 SECTOR / REGIONES');

  // 11. TOP 25 SECTOR / CIUDADES
  reports.sector_city = aggregateByChannel(
    data.filter(r => r.Sector && r.Sector !== '' && r.City && r.City !== ''),
    ['Sector', 'City', 'Region'],
    'TOP 25 SECTOR / CIUDADES'
  );
  printTable(reports.sector_city, 'TOP 25 SECTOR / CIUDADES');

  // Guardar reportes
  console.log('\n' + '='.repeat(150));
  console.log('💾 Guardando reportes en CSVs...');
  saveReportsToCSV(reports, csvPath);

  // Resumen
  const uniqueOffers = new Set(data.map(r => r.OfferId)).size;
  const uniqueSources = new Set(data.map(r => r.Source).filter(s => s)).size;
  const uniqueRegions = new Set(data.map(r => r.Region).filter(r => r)).size;
  const uniqueCities = new Set(data.map(r => r.City).filter(c => c)).size;
  const uniqueJobTitleDenominations = new Set(data.map(r => r.JobTitleDenomination).filter(j => j)).size;
  const uniqueAreas = new Set(data.map(r => r.Area).filter(a => a)).size;
  const uniqueSectors = new Set(data.map(r => r.Sector).filter(s => s)).size;

  console.log('\n' + '='.repeat(150));
  console.log('📊 RESUMEN GENERAL:');
  console.log('='.repeat(150));
  console.log(`   - Total registros analizados: ${data.length.toLocaleString()}`);
  console.log(`   - Canales únicos (Source): ${uniqueSources}`);
  console.log(`   - Ofertas únicas: ${uniqueOffers.toLocaleString()}`);
  console.log(`   - Regiones únicas: ${uniqueRegions}`);
  console.log(`   - Ciudades únicas: ${uniqueCities.toLocaleString()}`);
  console.log(`   - Job Title Denominations únicos: ${uniqueJobTitleDenominations.toLocaleString()}`);
  console.log(`   - Areas únicas: ${uniqueAreas}`);
  console.log(`   - Sectores únicos: ${uniqueSectors}`);
  console.log('\n✅ Reporte generado exitosamente!');
  console.log(`📁 Archivos guardados en: C:\\Dev\\job-platform\\Queries\\channel-reports\\`);
}

generateReport();
