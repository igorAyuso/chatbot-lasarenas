/**
 * Cliente de Supabase para el Dashboard
 *
 * Conecta directamente a Supabase desde el frontend para leer
 * conversaciones y estadísticas. Usa la clave pública (anon key)
 * que es segura para el navegador — solo permite lectura según
 * las políticas RLS configuradas en Supabase.
 *
 * Variables de entorno requeridas (en .env del dashboard):
 *   VITE_SUPABASE_URL  — URL del proyecto Supabase
 *   VITE_SUPABASE_KEY  — Clave pública (anon key) de Supabase
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '⚠️ Faltan variables de entorno de Supabase.\n' +
    'Creá un archivo dashboard/.env con:\n' +
    '  VITE_SUPABASE_URL=tu_url\n' +
    '  VITE_SUPABASE_KEY=tu_anon_key'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
