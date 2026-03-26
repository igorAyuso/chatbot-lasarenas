/**
 * Página de Login
 *
 * Pantalla de inicio de sesión con contraseña simple.
 * El usuario ingresa la contraseña definida en VITE_DASHBOARD_PASSWORD.
 * Al autenticarse, redirige al dashboard de conversaciones.
 *
 * Componente controlado con estado local.
 * No usa formularios complejos — es un solo campo de contraseña.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/auth'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    if (login(password)) {
      navigate('/conversaciones')
    } else {
      setError('Contraseña incorrecta')
      setPassword('')
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Las Arenas</h1>
          <p>Panel de Administración</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Ingresá tu contraseña"
              autoFocus
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-primary">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}
