-- =============================================
-- SETUP DE SUPABASE — LAS ARENAS PINAMAR
-- =============================================
-- Ejecutar este script en el SQL Editor de Supabase
-- (Dashboard > SQL Editor > New query)
--
-- Este script configura:
--   1. Políticas RLS para lectura desde el dashboard
--   2. Índices para mejorar performance de consultas
--   3. Vista de estadísticas precalculadas
-- =============================================

-- =============================================
-- 1. HABILITAR ROW LEVEL SECURITY (RLS)
-- =============================================
-- RLS protege los datos para que solo se acceda
-- con las claves correctas de Supabase.

-- Habilitar RLS en la tabla conversaciones (si no está habilitado)
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura completa con la clave anon
-- (necesaria para que el dashboard pueda leer conversaciones)
CREATE POLICY IF NOT EXISTS "Permitir lectura desde dashboard"
  ON conversaciones
  FOR SELECT
  USING (true);

-- Política: Permitir insert/update desde el backend
-- (el bot necesita crear y actualizar conversaciones)
CREATE POLICY IF NOT EXISTS "Permitir escritura desde backend"
  ON conversaciones
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- =============================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =============================================
-- Estos índices aceleran las consultas más comunes
-- del dashboard (ordenar por fecha, buscar por nombre).

-- Índice para ordenar por última actualización (query principal del dashboard)
CREATE INDEX IF NOT EXISTS idx_conversaciones_updated_at
  ON conversaciones (updated_at DESC);

-- Índice para búsqueda por nombre (buscador del dashboard)
CREATE INDEX IF NOT EXISTS idx_conversaciones_name
  ON conversaciones (name);

-- Índice para filtrar por estado pausado
CREATE INDEX IF NOT EXISTS idx_conversaciones_pausado
  ON conversaciones (pausado);


-- =============================================
-- 3. TABLA DE EVENTOS (para estadísticas futuras)
-- =============================================
-- Esta tabla registra eventos importantes del bot
-- para calcular métricas más avanzadas en el futuro.
--
-- Eventos posibles:
--   - 'primer_mensaje'     → Cliente envió su primer mensaje
--   - 'fotos_enviadas'     → Bot envió fotos de las unidades
--   - 'presupuesto_enviado' → Bot envió presupuesto
--   - 'pago_recibido'      → Cliente envió comprobante
--   - 'reserva_confirmada' → Admin confirmó la reserva
--   - 'admin_intervencion' → Admin tomó control de la conversación

CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,                          -- Teléfono del cliente
  evento TEXT NOT NULL,                         -- Tipo de evento
  metadata JSONB DEFAULT '{}',                  -- Datos adicionales del evento
  created_at TIMESTAMPTZ DEFAULT NOW()          -- Momento del evento
);

-- Índices para consultas de estadísticas
CREATE INDEX IF NOT EXISTS idx_eventos_phone ON eventos (phone);
CREATE INDEX IF NOT EXISTS idx_eventos_evento ON eventos (evento);
CREATE INDEX IF NOT EXISTS idx_eventos_created_at ON eventos (created_at DESC);

-- RLS para eventos
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Permitir lectura eventos"
  ON eventos FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Permitir escritura eventos"
  ON eventos FOR ALL USING (true) WITH CHECK (true);


-- =============================================
-- 4. VISTA DE ESTADÍSTICAS
-- =============================================
-- Vista materializada que precalcula estadísticas
-- útiles para el dashboard. Se puede refrescar
-- periódicamente para mantener datos actualizados.

CREATE OR REPLACE VIEW vista_estadisticas AS
SELECT
  -- Totales
  COUNT(*) AS total_conversaciones,
  COUNT(*) FILTER (WHERE NOT pausado) AS conversaciones_activas,
  COUNT(*) FILTER (WHERE pausado) AS conversaciones_pausadas,
  COUNT(*) FILTER (WHERE foto_enviada) AS con_fotos_enviadas,
  COUNT(*) FILTER (WHERE esperando_titular) AS esperando_pago,

  -- Temporales
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE) AS hoy,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days') AS ultima_semana,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '30 days') AS ultimo_mes

FROM conversaciones;


-- =============================================
-- VERIFICACIÓN
-- =============================================
-- Ejecutar para verificar que todo se creó correctamente:

-- SELECT * FROM vista_estadisticas;
-- SELECT COUNT(*) FROM conversaciones;
-- SELECT COUNT(*) FROM eventos;
