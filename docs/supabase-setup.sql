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
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (drop + create para evitar errores de duplicados)
DROP POLICY IF EXISTS "Permitir lectura desde dashboard" ON conversaciones;
CREATE POLICY "Permitir lectura desde dashboard"
  ON conversaciones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura desde backend" ON conversaciones;
CREATE POLICY "Permitir escritura desde backend"
  ON conversaciones FOR ALL USING (true) WITH CHECK (true);


-- =============================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_conversaciones_updated_at
  ON conversaciones (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversaciones_name
  ON conversaciones (name);

CREATE INDEX IF NOT EXISTS idx_conversaciones_pausado
  ON conversaciones (pausado);


-- =============================================
-- 3. TABLA DE EVENTOS (para estadísticas futuras)
-- =============================================
CREATE TABLE IF NOT EXISTS eventos (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  evento TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_phone ON eventos (phone);
CREATE INDEX IF NOT EXISTS idx_eventos_evento ON eventos (evento);
CREATE INDEX IF NOT EXISTS idx_eventos_created_at ON eventos (created_at DESC);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura eventos" ON eventos;
CREATE POLICY "Permitir lectura eventos"
  ON eventos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura eventos" ON eventos;
CREATE POLICY "Permitir escritura eventos"
  ON eventos FOR ALL USING (true) WITH CHECK (true);


-- =============================================
-- 4. VISTA DE ESTADÍSTICAS
-- =============================================
CREATE OR REPLACE VIEW vista_estadisticas AS
SELECT
  COUNT(*) AS total_conversaciones,
  COUNT(*) FILTER (WHERE NOT pausado) AS conversaciones_activas,
  COUNT(*) FILTER (WHERE pausado) AS conversaciones_pausadas,
  COUNT(*) FILTER (WHERE foto_enviada) AS con_fotos_enviadas,
  COUNT(*) FILTER (WHERE esperando_titular) AS esperando_pago,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE) AS hoy,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days') AS ultima_semana,
  COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '30 days') AS ultimo_mes
FROM conversaciones;
