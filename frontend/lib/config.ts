/**
 * Configuración global de la aplicación
 * Centraliza URLs y constantes para evitar hardcoding
 */

// API Base URL - usar variable de entorno o fallback a localhost
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002').replace(/\/+$/, '');

// Frontend URL
export const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3006';

// Landing URL
export const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';

// Supabase
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Configuración
export const CONFIG = {
  apiUrl: API_URL,
  frontendUrl: FRONTEND_URL,
  landingUrl: LANDING_URL,
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },
} as const;

export default CONFIG;
