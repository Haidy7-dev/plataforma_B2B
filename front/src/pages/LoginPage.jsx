import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext.jsx'
import styles from './LoginPage.module.css'

const API_BASE = 'http://localhost:4000'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, rolePath } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password })
      // backend devuelve: { token, user }
      login({ user: res.data.user, token: res.data.token })
      navigate(rolePath(res.data.user.role))
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error de login'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <section className={styles.left}>
          <div className={styles.leftInner}>
            <div className={styles.brand}>
              <div className={styles.logo}>7T</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.6, opacity: 0.95 }}>
                  Plataforma
                </div>
                <div style={{ fontWeight: 900, fontSize: 16, opacity: 0.95 }}>Sevent</div>
              </div>
            </div>

            <h1 className={styles.title}>Accede a tu cuenta</h1>
            <p className={styles.subtitle}>
              Inicia sesión para continuar de forma segura.
            </p>
          </div>
        </section>

        <section className={styles.right}>
          <h2 className={styles.formTitle}>Iniciar Sesión</h2>
          <p className={styles.formHint}>Ingresa con tu correo y contraseña para continuar.</p>

          <form className={styles.row} onSubmit={onSubmit}>
            <div>
              <label className={styles.label}>Correo</label>
              <input
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Ejemplo: usuario@correo.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className={styles.label}>Contraseña</label>
              <input
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Ingresa tu contraseña"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button className={styles.button} disabled={loading} type="submit">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className={styles.footer}>© {new Date().getFullYear()} Plataforma Sevent</div>
        </section>
      </div>
    </div>
  )
}

