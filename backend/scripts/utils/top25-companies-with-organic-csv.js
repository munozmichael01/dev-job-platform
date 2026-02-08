const fs = require('fs');
const path = require('path');

// Ruta al CSV exportado
const csvPath = 'C:\\Dev\\job-platform\\Queries\\METRICAS POR OFERTA Y CANALES ULTIMOS 30 DIAS - DATOS ENRIQUECIDOS.csv';

function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let char of lines[i]) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim().replace(/"/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/"/g, ''));

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

function analyzeCompanies() {
  console.log('📊 TOP 25 EMPRESAS CON MÁS OFERTAS (INCLUYENDO ORGÁNICO)');
  console.log('='.repeat(100));
  console.log('Nota: Source vacío/null = Tráfico Orgánico\n');

  // Leer CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const offers = parseCSV(csvContent);

  console.log(`Total ofertas en CSV: ${offers.length}\n`);

  // Agrupar por empresa
  const companiesMap = new Map();

  offers.forEach(offer => {
    const company = offer.CompanyName || 'Sin empresa';
    const source = (offer.Source || '').toLowerCase().trim();

    if (!companiesMap.has(company)) {
      companiesMap.set(company, {
        total: 0,
        organic: 0,
        jooble: 0,
        talent: 0,
        jobrapido: 0,
        whatjobs: 0,
        infojobs: 0,
        linkedin: 0,
        indeed: 0,
        other: 0
      });
    }

    const stats = companiesMap.get(company);
    stats.total++;

    // Clasificar por fuente (INCLUYENDO ORGÁNICO como vacío/null)
    if (!source || source === '') {
      stats.organic++;
    } else if (source === 'jooble') {
      stats.jooble++;
    } else if (source === 'talent') {
      stats.talent++;
    } else if (source === 'jobrapido') {
      stats.jobrapido++;
    } else if (source === 'whatjobs') {
      stats.whatjobs++;
    } else if (source === 'infojobs') {
      stats.infojobs++;
    } else if (source === 'linkedin') {
      stats.linkedin++;
    } else if (source === 'indeed') {
      stats.indeed++;
    } else {
      stats.other++;
    }
  });

  // Convertir a array y ordenar por total
  const companiesArray = Array.from(companiesMap.entries())
    .map(([name, stats]) => ({
      name,
      ...stats,
      organicPercent: ((stats.organic / stats.total) * 100).toFixed(1)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  // Mostrar tabla
  console.log('Ranking | Empresa                                    | Total  | Organic | % Org  | Jooble | Talent | JRapid | WJobs | IJ | LI | Indeed | Other');
  console.log('-'.repeat(170));

  companiesArray.forEach((company, index) => {
    const rank = (index + 1).toString().padStart(3);
    const name = company.name.substring(0, 42).padEnd(42);
    const total = company.total.toString().padStart(6);
    const organic = company.organic.toString().padStart(7);
    const organicPct = company.organicPercent.toString().padStart(6);
    const jooble = company.jooble.toString().padStart(6);
    const talent = company.talent.toString().padStart(6);
    const jobrapido = company.jobrapido.toString().padStart(6);
    const whatjobs = company.whatjobs.toString().padStart(5);
    const infojobs = company.infojobs.toString().padStart(2);
    const linkedin = company.linkedin.toString().padStart(2);
    const indeed = company.indeed.toString().padStart(6);
    const other = company.other.toString().padStart(5);

    console.log(`${rank}     | ${name} | ${total} | ${organic} | ${organicPct}% | ${jooble} | ${talent} | ${jobrapido} | ${whatjobs} | ${infojobs} | ${linkedin} | ${indeed} | ${other}`);
  });

  // Totales generales
  const totals = {
    total: offers.length,
    organic: 0,
    jooble: 0,
    talent: 0,
    jobrapido: 0,
    whatjobs: 0,
    infojobs: 0,
    linkedin: 0,
    indeed: 0,
    other: 0
  };

  offers.forEach(offer => {
    const source = (offer.Source || '').toLowerCase().trim();

    if (!source || source === '') {
      totals.organic++;
    } else if (source === 'jooble') {
      totals.jooble++;
    } else if (source === 'talent') {
      totals.talent++;
    } else if (source === 'jobrapido') {
      totals.jobrapido++;
    } else if (source === 'whatjobs') {
      totals.whatjobs++;
    } else if (source === 'infojobs') {
      totals.infojobs++;
    } else if (source === 'linkedin') {
      totals.linkedin++;
    } else if (source === 'indeed') {
      totals.indeed++;
    } else {
      totals.other++;
    }
  });

  console.log('\n' + '='.repeat(170));
  console.log('📊 TOTALES GENERALES (CSV Turijobs):');
  console.log('-'.repeat(170));
  console.log(`Total ofertas:     ${totals.total.toString().padStart(6)}`);
  console.log(`Orgánico:          ${totals.organic.toString().padStart(6)} (${((totals.organic * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`Jooble:            ${totals.jooble.toString().padStart(6)} (${((totals.jooble * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`Talent.com:        ${totals.talent.toString().padStart(6)} (${((totals.talent * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`JobRapido:         ${totals.jobrapido.toString().padStart(6)} (${((totals.jobrapido * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`WhatJobs:          ${totals.whatjobs.toString().padStart(6)} (${((totals.whatjobs * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`InfoJobs:          ${totals.infojobs.toString().padStart(6)} (${((totals.infojobs * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`LinkedIn:          ${totals.linkedin.toString().padStart(6)} (${((totals.linkedin * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`Indeed:            ${totals.indeed.toString().padStart(6)} (${((totals.indeed * 100.0) / totals.total).toFixed(1)}%)`);
  console.log(`Otros sources:     ${totals.other.toString().padStart(6)} (${((totals.other * 100.0) / totals.total).toFixed(1)}%)`);
}

try {
  analyzeCompanies();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
