/**
 * Módulo de autenticación simple para el Dashboard
 *
 * Implementa un sistema de login básico con contraseña única.
 * La contraseña se define en VITE_DASHBOARD_PASSWORD.
 *
 * Flujo:
 *   1. Usuario ingresa contraseña en /login
 *   2. Se compara con VITE_DASHBOARD_PASSWORD
 *   3. Si es correcta, se guarda flag en sessionStorage
 *   4. El flag expira al cerrar el navegador
 *
 * NOTA: Este sistema es suficiente para un solo usuario admin.
 * Para múltiples usuarios, migrar a Supabase Auth.
 */

const PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD || 'admin'
const AUTH_KEY = 'lasarenas_auth'

/**
 * Verifica si la contraseña es correcta
 * @param {string} password — Contraseña ingresada por el usuario
 * @returns {boolean} — true si es correcta
 */
export function login(password) {
  if (password === PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true')
    return true
  }
  return false
}

/**
 * Cierra la sesión eliminando el flag de autenticación
 */
export function logout() {
  sessionStorage.removeItem(AUTH_KEY)
}

/**
 * Verifica si el usuario está autenticado
 * @returns {boolean} — true si está logueado
 */
export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}
