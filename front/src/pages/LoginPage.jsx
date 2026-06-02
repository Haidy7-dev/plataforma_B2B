import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext.jsx'
import styles from './LoginPage.module.css'

import loginIllustration from '../assets/WhatsApp Image 2026-05-31 at 8.01.14 PM.jpeg'

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
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password
      })

      login({
        user: res.data.user,
        token: res.data.token
      })

      const role =
        res.data?.user?.rol ||
        res.data?.user?.role

      navigate(rolePath(role))
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Error de login'

      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <section className={styles.left}>
          <img
            src={loginIllustration}
            alt="Ilustración empresarial"
            className={styles.illustration}
          />
        </section>

        <section className={styles.right}>

          <div className={styles.brand}>
            <div className={styles.logo}>
              7T
            </div>

            <div className={styles.brandText}>
              <span>PLATAFORMA</span>
              <h1>SEVENT</h1>
            </div>
          </div>

          <h2 className={styles.formTitle}>
            Iniciar Sesión
          </h2>

          <form
            className={styles.row}
            onSubmit={onSubmit}
          >
            <div>
              <label className={styles.label}>
                Correo Electrónico
              </label>

              <input
                className={styles.input}
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                type="email"
                placeholder="usuario@correo.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className={styles.label}>
                Contraseña
              </label>

              <input
                className={styles.input}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                type="password"
                placeholder="Ingresa tu contraseña"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <button
              className={styles.button}
              disabled={loading}
              type="submit"
            >
              {loading
                ? 'Entrando...'
                : 'Iniciar Sesión'}
            </button>
          </form>

          <div className={styles.footer}>
            © {new Date().getFullYear()} Plataforma Sevent
          </div>

        </section>
      </div>
    </div>
  )
}
