/**
 * Componente de ruta protegida
 *
 * Verifica si el usuario está autenticado antes de renderizar
 * el contenido. Si no está autenticado, redirige a /login.
 *
 * Uso:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 */

import { Navigate, Outlet } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'

export default function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
