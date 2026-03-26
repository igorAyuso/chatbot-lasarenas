/**
 * Funciones de acceso a datos para el Dashboard
 *
 * Todas las consultas van directo a Supabase desde el frontend.
 * Esto es más rápido que pasar por el backend y reduce la carga del servidor.
 *
 * Funciones disponibles:
 *   - getConversaciones()       → Lista todas las conversaciones
 *   - getConversacion(phone)    → Detalle de una conversación
 *   - getEstadisticas()         → Métricas generales del bot
 */

import { supabase } from './supabase'

/**
 * Obtiene todas las conversaciones, ordenadas por última actualización.
 *
 * @param {Object} opciones
 * @param {string} opciones.busqueda — Filtrar por nombre o teléfono
 * @param {number} opciones.limite — Máximo de resultados (default: 50)
 * @param {number} opciones.pagina — Página actual (default: 0)
 * @returns {Promise<{data: Array, total: number}>}
 *
 * Ejemplo de uso:
 *   const { data, total } = await getConversaciones({ busqueda: 'Juan', limite: 20 })
 */
export async function getConversaciones({ busqueda = '', limite = 50, pagina = 0 } = {}) {
  let query = supabase
    .from('conversaciones')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(pagina * limite, (pagina + 1) * limite - 1)

  if (busqueda) {
    query = query.or(`phone.ilike.%${busqueda}%,name.ilike.%${busqueda}%`)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error al obtener conversaciones:', error)
    return { data: [], total: 0 }
  }

  return { data: data || [], total: count || 0 }
}

/**
 * Obtiene el detalle completo de una conversación por teléfono.
 *
 * @param {string} phone — Número de teléfono del cliente
 * @returns {Promise<Object|null>} — La conversación o null si no existe
 *
 * La conversación incluye:
 *   - phone: Teléfono
 *   - name: Nombre del cliente
 *   - messages: Array de mensajes [{role, content, timestamp}]
 *   - foto_enviada: Si se enviaron fotos
 *   - pausado: Si el admin tomó control
 *   - updated_at: Última actualización
 */
export async function getConversacion(phone) {
  const { data, error } = await supabase
    .from('conversaciones')
    .select('*')
    .eq('phone', phone)
    .single()

  if (error) {
    console.error('Error al obtener conversación:', error)
    return null
  }

  return data
}

/**
 * Calcula estadísticas generales del bot.
 *
 * Métricas calculadas:
 *   - totalConversaciones: Total de conversaciones registradas
 *   - conversacionesActivas: Conversaciones no pausadas
 *   - conversacionesPausadas: Conversaciones donde el admin intervino
 *   - fotoEnviada: Conversaciones que llegaron a ver fotos (interés alto)
 *   - esperandoTitular: Conversaciones en proceso de pago
 *   - mensajesTotales: Suma de todos los mensajes
 *   - promedioMensajes: Promedio de mensajes por conversación
 *   - conversacionesHoy: Conversaciones actualizadas hoy
 *   - conversacionesSemana: Conversaciones de los últimos 7 días
 *
 * @returns {Promise<Object>} — Objeto con todas las métricas
 */
export async function getEstadisticas() {
  const { data, error } = await supabase
    .from('conversaciones')
    .select('*')

  if (error) {
    console.error('Error al obtener estadísticas:', error)
    return null
  }

  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)
  const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)

  const conversaciones = data || []

  // Contadores básicos
  const totalConversaciones = conversaciones.length
  const conversacionesActivas = conversaciones.filter(c => !c.pausado).length
  const conversacionesPausadas = conversaciones.filter(c => c.pausado).length
  const fotoEnviada = conversaciones.filter(c => c.foto_enviada).length
  const esperandoTitular = conversaciones.filter(c => c.esperando_titular).length

  // Mensajes
  let mensajesTotales = 0
  let mensajesEnviados = 0
  let mensajesRecibidos = 0

  conversaciones.forEach(c => {
    const msgs = Array.isArray(c.messages) ? c.messages : []
    mensajesTotales += msgs.length
    mensajesEnviados += msgs.filter(m => m.role === 'assistant').length
    mensajesRecibidos += msgs.filter(m => m.role === 'user').length
  })

  const promedioMensajes = totalConversaciones > 0
    ? Math.round(mensajesTotales / totalConversaciones)
    : 0

  // Temporales
  const conversacionesHoy = conversaciones.filter(c =>
    new Date(c.updated_at) >= hoy
  ).length

  const conversacionesSemana = conversaciones.filter(c =>
    new Date(c.updated_at) >= hace7Dias
  ).length

  const conversacionesMes = conversaciones.filter(c =>
    new Date(c.updated_at) >= hace30Dias
  ).length

  // Funnel de conversión
  // Contacto → Fotos enviadas → Esperando pago (titular)
  const tasaFotos = totalConversaciones > 0
    ? Math.round((fotoEnviada / totalConversaciones) * 100)
    : 0

  const tasaPago = fotoEnviada > 0
    ? Math.round((esperandoTitular / fotoEnviada) * 100)
    : 0

  // Datos para gráfico de actividad por día (últimos 30 días)
  const actividadDiaria = []
  for (let i = 29; i >= 0; i--) {
    const dia = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000)
    const diaStr = dia.toISOString().split('T')[0]
    const diaFin = new Date(dia.getTime() + 24 * 60 * 60 * 1000)

    const nuevas = conversaciones.filter(c => {
      const updated = new Date(c.updated_at)
      return updated >= dia && updated < diaFin
    }).length

    actividadDiaria.push({
      fecha: diaStr,
      label: `${dia.getDate()}/${dia.getMonth() + 1}`,
      conversaciones: nuevas
    })
  }

  return {
    totalConversaciones,
    conversacionesActivas,
    conversacionesPausadas,
    fotoEnviada,
    esperandoTitular,
    mensajesTotales,
    mensajesEnviados,
    mensajesRecibidos,
    promedioMensajes,
    conversacionesHoy,
    conversacionesSemana,
    conversacionesMes,
    tasaFotos,
    tasaPago,
    actividadDiaria
  }
}
