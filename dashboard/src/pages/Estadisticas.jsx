/**
 * Página de Estadísticas
 *
 * Muestra métricas generales del bot y gráficos de actividad.
 *
 * Secciones:
 *   1. Tarjetas de métricas principales (KPIs)
 *   2. Funnel de conversión (Contacto → Fotos → Pago)
 *   3. Gráfico de actividad diaria (últimos 30 días)
 *   4. Distribución de mensajes (enviados vs recibidos)
 *
 * Los datos se calculan en tiempo real a partir de la tabla
 * de conversaciones en Supabase (ver lib/api.js > getEstadisticas).
 */

import { useState, useEffect } from 'react'
import { getEstadisticas } from '../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  MessageSquare, Users, Camera, CreditCard, TrendingUp,
  Calendar, ArrowRight, Mail, Send
} from 'lucide-react'

// Colores para los gráficos
const COLORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Estadisticas() {
  const [stats, setStats] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  async function cargarEstadisticas() {
    setCargando(true)
    const data = await getEstadisticas()
    setStats(data)
    setCargando(false)
  }

  if (cargando) {
    return <div className="cargando-pagina">Calculando estadísticas...</div>
  }

  if (!stats) {
    return <div className="error-pagina">Error al cargar estadísticas</div>
  }

  // Datos para gráfico de distribución de mensajes
  const distribucionMensajes = [
    { name: 'Recibidos (clientes)', value: stats.mensajesRecibidos },
    { name: 'Enviados (bot)', value: stats.mensajesEnviados }
  ]

  // Datos para funnel
  const funnel = [
    { etapa: 'Contactos', valor: stats.totalConversaciones, icono: Users },
    { etapa: 'Vieron fotos', valor: stats.fotoEnviada, icono: Camera },
    { etapa: 'En proceso pago', valor: stats.esperandoTitular, icono: CreditCard }
  ]

  return (
    <div className="estadisticas-page">
      <div className="stats-header">
        <h2><TrendingUp size={20} /> Estadísticas</h2>
        <button onClick={cargarEstadisticas} className="btn-secondary">
          Actualizar
        </button>
      </div>

      {/* KPIs principales */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon"><Users size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.totalConversaciones}</span>
            <span className="kpi-label">Conversaciones totales</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><MessageSquare size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.mensajesTotales}</span>
            <span className="kpi-label">Mensajes totales</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Calendar size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.conversacionesHoy}</span>
            <span className="kpi-label">Hoy</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><TrendingUp size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.conversacionesSemana}</span>
            <span className="kpi-label">Esta semana</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Mail size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.mensajesRecibidos}</span>
            <span className="kpi-label">Mensajes recibidos</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Send size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.mensajesEnviados}</span>
            <span className="kpi-label">Mensajes enviados</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><MessageSquare size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.promedioMensajes}</span>
            <span className="kpi-label">Promedio msgs/conv</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Calendar size={24} /></div>
          <div className="kpi-data">
            <span className="kpi-valor">{stats.conversacionesMes}</span>
            <span className="kpi-label">Este mes</span>
          </div>
        </div>
      </div>

      {/* Funnel de conversión */}
      <div className="seccion">
        <h3>Funnel de conversión</h3>
        <div className="funnel">
          {funnel.map((paso, idx) => (
            <div key={paso.etapa} className="funnel-paso">
              <div className="funnel-icono">
                <paso.icono size={20} />
              </div>
              <div className="funnel-datos">
                <span className="funnel-valor">{paso.valor}</span>
                <span className="funnel-etapa">{paso.etapa}</span>
              </div>
              {idx < funnel.length - 1 && (
                <div className="funnel-flecha">
                  <ArrowRight size={20} />
                  <span className="funnel-tasa">
                    {paso.valor > 0
                      ? Math.round((funnel[idx + 1].valor / paso.valor) * 100)
                      : 0}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos */}
      <div className="graficos-grid">
        {/* Actividad diaria */}
        <div className="grafico-card">
          <h3>Actividad diaria (últimos 30 días)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.actividadDiaria}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                stroke="#9ca3af"
                fontSize={11}
                interval={2}
              />
              <YAxis stroke="#9ca3af" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
                formatter={(value) => [`${value} conversaciones`, 'Actividad']}
                labelFormatter={(label) => `Día ${label}`}
              />
              <Bar dataKey="conversaciones" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de mensajes */}
        <div className="grafico-card">
          <h3>Distribución de mensajes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distribucionMensajes}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {distribucionMensajes.map((_, idx) => (
                  <Cell key={idx} fill={COLORES[idx]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
