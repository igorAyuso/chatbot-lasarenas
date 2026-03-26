/**
 * Página de Conversaciones
 *
 * Vista principal del dashboard. Muestra todas las conversaciones del bot
 * en formato lista + detalle (layout de dos columnas).
 *
 * Funcionalidades:
 *   - Lista de conversaciones ordenadas por última actividad
 *   - Buscador por nombre o teléfono
 *   - Vista de detalle con todos los mensajes de la conversación
 *   - Indicadores de estado (pausado, foto enviada, esperando pago)
 *   - Paginación automática
 *
 * Los datos se obtienen directamente de Supabase via lib/api.js
 */

import { useState, useEffect } from 'react'
import { getConversaciones, getConversacion } from '../lib/api'
import { MessageSquare, Search, Phone, User, Clock, Pause, Camera, CreditCard } from 'lucide-react'

export default function Conversaciones() {
  // Estado de la lista de conversaciones
  const [conversaciones, setConversaciones] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  // Estado de la conversación seleccionada
  const [seleccionada, setSeleccionada] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  // Cargar lista de conversaciones
  useEffect(() => {
    cargarConversaciones()
  }, [pagina, busqueda])

  async function cargarConversaciones() {
    setCargando(true)
    const resultado = await getConversaciones({ busqueda, pagina, limite: 30 })
    setConversaciones(resultado.data)
    setTotal(resultado.total)
    setCargando(false)
  }

  // Cargar detalle al seleccionar una conversación
  async function seleccionarConversacion(phone) {
    setSeleccionada(phone)
    setCargandoDetalle(true)
    const data = await getConversacion(phone)
    setDetalle(data)
    setCargandoDetalle(false)
  }

  // Debounce para el buscador
  function handleBusqueda(valor) {
    setBusqueda(valor)
    setPagina(0) // Resetear paginación al buscar
  }

  // Formatear fecha legible
  function formatearFecha(fecha) {
    if (!fecha) return '—'
    const d = new Date(fecha)
    const hoy = new Date()
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)

    if (d.toDateString() === hoy.toDateString()) {
      return `Hoy ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    }
    if (d.toDateString() === ayer.toDateString()) {
      return `Ayer ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    }
    return d.toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  // Contar mensajes por rol
  function contarMensajes(messages) {
    if (!Array.isArray(messages)) return { total: 0, user: 0, bot: 0 }
    return {
      total: messages.length,
      user: messages.filter(m => m.role === 'user').length,
      bot: messages.filter(m => m.role === 'assistant').length
    }
  }

  // Obtener último mensaje de la conversación
  function ultimoMensaje(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return 'Sin mensajes'
    const ultimo = messages[messages.length - 1]
    const texto = ultimo.content || ''
    return texto.length > 80 ? texto.substring(0, 80) + '...' : texto
  }

  const totalPaginas = Math.ceil(total / 30)

  return (
    <div className="conversaciones-layout">
      {/* Panel izquierdo: Lista de conversaciones */}
      <div className="conversaciones-lista">
        <div className="lista-header">
          <h2><MessageSquare size={20} /> Conversaciones</h2>
          <span className="badge">{total}</span>
        </div>

        {/* Buscador */}
        <div className="buscador">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
          />
        </div>

        {/* Lista */}
        <div className="lista-items">
          {cargando ? (
            <div className="cargando">Cargando conversaciones...</div>
          ) : conversaciones.length === 0 ? (
            <div className="sin-resultados">No se encontraron conversaciones</div>
          ) : (
            conversaciones.map(conv => (
              <div
                key={conv.phone}
                className={`conv-item ${seleccionada === conv.phone ? 'activo' : ''}`}
                onClick={() => seleccionarConversacion(conv.phone)}
              >
                <div className="conv-item-header">
                  <span className="conv-nombre">
                    <User size={14} />
                    {conv.name || 'Sin nombre'}
                  </span>
                  <span className="conv-fecha">{formatearFecha(conv.updated_at)}</span>
                </div>
                <div className="conv-telefono">
                  <Phone size={12} />
                  {conv.phone}
                </div>
                <div className="conv-preview">{ultimoMensaje(conv.messages)}</div>
                <div className="conv-badges">
                  {conv.pausado && <span className="badge badge-warning"><Pause size={10} /> Pausado</span>}
                  {conv.foto_enviada && <span className="badge badge-success"><Camera size={10} /> Fotos</span>}
                  {conv.esperando_titular && <span className="badge badge-info"><CreditCard size={10} /> Pago</span>}
                  <span className="badge badge-neutral">
                    {contarMensajes(conv.messages).total} msgs
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="paginacion">
            <button
              disabled={pagina === 0}
              onClick={() => setPagina(p => p - 1)}
            >
              Anterior
            </button>
            <span>{pagina + 1} / {totalPaginas}</span>
            <button
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina(p => p + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Panel derecho: Detalle de conversación */}
      <div className="conversacion-detalle">
        {!seleccionada ? (
          <div className="detalle-vacio">
            <MessageSquare size={48} />
            <p>Seleccioná una conversación para ver los mensajes</p>
          </div>
        ) : cargandoDetalle ? (
          <div className="cargando">Cargando mensajes...</div>
        ) : !detalle ? (
          <div className="detalle-vacio">
            <p>No se pudo cargar la conversación</p>
          </div>
        ) : (
          <>
            {/* Header del detalle */}
            <div className="detalle-header">
              <div>
                <h3>{detalle.name || 'Sin nombre'}</h3>
                <span className="detalle-phone"><Phone size={14} /> {detalle.phone}</span>
              </div>
              <div className="detalle-estado">
                {detalle.pausado && <span className="badge badge-warning">Pausado</span>}
                {detalle.foto_enviada && <span className="badge badge-success">Fotos enviadas</span>}
                {detalle.esperando_titular && <span className="badge badge-info">Esperando pago</span>}
              </div>
            </div>

            {/* Mensajes */}
            <div className="detalle-mensajes">
              {Array.isArray(detalle.messages) && detalle.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mensaje ${msg.role === 'user' ? 'mensaje-user' : 'mensaje-bot'}`}
                >
                  <div className="mensaje-header">
                    <span className="mensaje-autor">
                      {msg.role === 'user' ? detalle.name || 'Cliente' : 'Lara (Bot)'}
                    </span>
                    {msg.timestamp && (
                      <span className="mensaje-hora">
                        <Clock size={10} />
                        {formatearFecha(msg.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="mensaje-contenido">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen */}
            <div className="detalle-resumen">
              <span>
                {contarMensajes(detalle.messages).user} mensajes del cliente
              </span>
              <span>
                {contarMensajes(detalle.messages).bot} respuestas del bot
              </span>
              <span>
                <Clock size={12} /> Última actividad: {formatearFecha(detalle.updated_at)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
