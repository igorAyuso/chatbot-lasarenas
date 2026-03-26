/**
 * Layout principal del Dashboard
 *
 * Envuelve todas las páginas autenticadas con:
 *   - Barra de navegación lateral (sidebar)
 *   - Header con info del usuario
 *   - Área de contenido principal
 *
 * El sidebar contiene links a:
 *   - Conversaciones (/conversaciones)
 *   - Estadísticas (/estadisticas)
 *   - Cerrar sesión
 *
 * Usa react-router-dom para la navegación.
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { MessageSquare, BarChart3, LogOut, Home } from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <Home size={24} />
          <span>Las Arenas</span>
        </div>

        <div className="sidebar-nav">
          <NavLink to="/conversaciones" className={({ isActive }) => isActive ? 'nav-link activo' : 'nav-link'}>
            <MessageSquare size={18} />
            <span>Conversaciones</span>
          </NavLink>

          <NavLink to="/estadisticas" className={({ isActive }) => isActive ? 'nav-link activo' : 'nav-link'}>
            <BarChart3 size={18} />
            <span>Estadísticas</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="nav-link logout-btn">
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </nav>

      {/* Contenido principal */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
