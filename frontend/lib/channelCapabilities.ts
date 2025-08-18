/**
 * Configuración centralizada de capacidades y límites por canal
 * Define qué puede hacer cada canal y sus restricciones específicas
 */

export interface ChannelLimit {
  max: number | null;
  type: number;
  operator: string;
  label: string;
  description?: string;
}

export interface ChannelCapabilities {
  name: string;
  description: string;
  costModel: 'CPC' | 'CPA' | 'Organic';
  avgCPA: number;
  limits: {
    titles: ChannelLimit;
    companies: ChannelLimit;
    locations: ChannelLimit;
  };
  notes: string[];
  features: string[];
}

export const CHANNEL_CAPS: Record<string, ChannelCapabilities> = {
  jooble: {
    name: "Jooble",
    description: "Motor de búsqueda global con modelo CPC y optimización automática",
    costModel: "CPC",
    avgCPA: 15,
    limits: {
      titles: { 
        max: 5, 
        type: 1, 
        operator: "contains", 
        label: "Job titles",
        description: "Búsqueda por contenido en título (máx. 5)"
      },
      companies: { 
        max: 3, 
        type: 2, 
        operator: "equals", 
        label: "Companies",
        description: "Coincidencia exacta con nombre empresa (máx. 3)"
      },
      locations: { 
        max: null, 
        type: 4, 
        operator: "in", 
        label: "Locations",
        description: "Lista de ubicaciones separadas por comas (deduplicadas)"
      }
    },
    notes: [
      "Máx. 5 job titles con búsqueda por contenido (contains)",
      "Máx. 3 companies con coincidencia exacta (equals)", 
      "Locations ilimitadas pero deduplicadas automáticamente",
      "Segmentación automática desde ofertas pre-filtradas"
    ],
    features: [
      "Campaign management",
      "Bidding automático", 
      "Performance analytics",
      "Global reach"
    ]
  },
  
  talent: {
    name: "Talent.com",
    description: "Plataforma de reclutamiento con modelo CPA",
    costModel: "CPA",
    avgCPA: 18,
    limits: {
      titles: { max: null, type: 0, operator: "none", label: "No limits" },
      companies: { max: null, type: 0, operator: "none", label: "No limits" },
      locations: { max: null, type: 0, operator: "none", label: "No limits" }
    },
    notes: [
      "Sin límites de segmentación específicos",
      "Feed XML con todas las ofertas",
      "Targeting basado en contenido del feed"
    ],
    features: [
      "XML publishing",
      "Application tracking",
      "Screening questions"
    ]
  },

  jobrapido: {
    name: "JobRapido",
    description: "Agregador orgánico con entrega de CVs en Base64",
    costModel: "Organic",
    avgCPA: 12,
    limits: {
      titles: { max: null, type: 0, operator: "none", label: "No limits" },
      companies: { max: null, type: 0, operator: "none", label: "No limits" },
      locations: { max: null, type: 0, operator: "none", label: "No limits" }
    },
    notes: [
      "Distribución orgánica sin costos directos",
      "Feed XML/JSON con categorización automática", 
      "CV delivery completo en Base64"
    ],
    features: [
      "XML/JSON feeds",
      "CV Base64 delivery",
      "Custom screening questions"
    ]
  },

  whatjobs: {
    name: "WhatJobs",
    description: "Motor global con S2S tracking y optimización automática",
    costModel: "CPC",
    avgCPA: 14,
    limits: {
      titles: { max: null, type: 0, operator: "none", label: "No limits" },
      companies: { max: null, type: 0, operator: "none", label: "No limits" },
      locations: { max: null, type: 0, operator: "none", label: "No limits" }
    },
    notes: [
      "Optimización automática basada en S2S tracking",
      "Feed XML con CPC por oferta",
      "Conversión tracking en tiempo real"
    ],
    features: [
      "S2S tracking",
      "Auto optimization", 
      "Global reach",
      "Real-time conversion tracking"
    ]
  }
};

/**
 * Obtiene las capacidades de un canal específico
 */
export function getChannelCapabilities(channelId: string): ChannelCapabilities | null {
  return CHANNEL_CAPS[channelId] || null;
}

/**
 * Obtiene todos los canales disponibles
 */
export function getAllChannels(): Array<{ id: string; capabilities: ChannelCapabilities }> {
  return Object.entries(CHANNEL_CAPS).map(([id, capabilities]) => ({
    id,
    capabilities
  }));
}

/**
 * Verifica si un canal tiene límites específicos
 */
export function hasLimits(channelId: string): boolean {
  const caps = getChannelCapabilities(channelId);
  if (!caps) return false;
  
  return Object.values(caps.limits).some(limit => limit.max !== null);
}

/**
 * Valida que los valores cumplan con los límites del canal
 */
export function validateChannelLimits(
  channelId: string, 
  values: {
    titles?: string[];
    companies?: string[];
    locations?: string[];
  }
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const caps = getChannelCapabilities(channelId);
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!caps) {
    errors.push(`Canal ${channelId} no encontrado`);
    return { valid: false, errors, warnings };
  }
  
  // Validar títulos
  if (values.titles && caps.limits.titles.max !== null) {
    const uniqueTitles = [...new Set(values.titles.filter(Boolean))];
    if (uniqueTitles.length > caps.limits.titles.max) {
      errors.push(`Máximo ${caps.limits.titles.max} títulos permitidos (tienes ${uniqueTitles.length})`);
    }
  }
  
  // Validar empresas
  if (values.companies && caps.limits.companies.max !== null) {
    const uniqueCompanies = [...new Set(values.companies.filter(Boolean))];
    if (uniqueCompanies.length > caps.limits.companies.max) {
      errors.push(`Máximo ${caps.limits.companies.max} empresas permitidas (tienes ${uniqueCompanies.length})`);
    }
  }
  
  // Validar ubicaciones (solo warning si son muchas)
  if (values.locations) {
    const uniqueLocations = [...new Set(values.locations.filter(Boolean))];
    if (uniqueLocations.length > 10) {
      warnings.push(`Muchas ubicaciones (${uniqueLocations.length}). Se mantendrán las primeras 10 por performance.`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Aplica truncado y deduplicación según límites del canal
 */
export function applyChannelLimits(
  channelId: string,
  values: {
    titles?: string[];
    companies?: string[];
    locations?: string[];
  }
): {
  titles: string[];
  companies: string[];
  locations: string[];
  applied: {
    titlesTruncated: boolean;
    companiesTruncated: boolean;
    locationsTruncated: boolean;
  };
} {
  const caps = getChannelCapabilities(channelId);
  const result = {
    titles: [...new Set((values.titles || []).filter(Boolean))],
    companies: [...new Set((values.companies || []).filter(Boolean))],
    locations: [...new Set((values.locations || []).filter(Boolean))],
    applied: {
      titlesTruncated: false,
      companiesTruncated: false,
      locationsTruncated: false
    }
  };
  
  if (!caps) return result;
  
  // Aplicar límite de títulos
  if (caps.limits.titles.max !== null && result.titles.length > caps.limits.titles.max) {
    result.titles = result.titles.slice(0, caps.limits.titles.max);
    result.applied.titlesTruncated = true;
  }
  
  // Aplicar límite de empresas
  if (caps.limits.companies.max !== null && result.companies.length > caps.limits.companies.max) {
    result.companies = result.companies.slice(0, caps.limits.companies.max);
    result.applied.companiesTruncated = true;
  }
  
  // Aplicar límite razonable de ubicaciones (10 por performance)
  if (result.locations.length > 10) {
    result.locations = result.locations.slice(0, 10);
    result.applied.locationsTruncated = true;
  }
  
  return result;
}


