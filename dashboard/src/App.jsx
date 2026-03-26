/**
 * App.jsx — Componente raíz del Dashboard
 *
 * Configura el enrutamiento de la aplicación:
 *
 * Rutas públicas:
 *   /login — Página de inicio de sesión
 *
 * Rutas protegidas (requieren autenticación):
 *   /conversaciones — Lista y detalle de conversaciones del bot
 *   /estadisticas   — Métricas y gráficos de rendimiento
 *
 * Estructura:
 *   BrowserRouter
 *   └── Routes
 *       ├── /login → Login
 *       └── ProtectedRoute
 *           └── Layout (sidebar + contenido)
 *               ├── /conversaciones → Conversaciones
 *               └── /estadisticas → Estadisticas
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Conversaciones from './pages/Conversaciones'
import Estadisticas from './pages/Estadisticas'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/conversaciones" element={<Conversaciones />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
          </Route>
        </Route>

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/conversaciones" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
