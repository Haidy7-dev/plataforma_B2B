import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M10 17l5-5-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 3h6a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function LogoutButton({
  confirm = true,
  compact = false
}) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function clearClientStorage() {
    // JWT / auth-related keys used in this project or requested by spec
    const keys = [
      'token',
      'accessToken',
      'userData',
      'authStorage'
    ]

    keys.forEach((k) => {
      try {
        localStorage.removeItem(k)
      } catch {
        // ignore
      }
      try {
        sessionStorage.removeItem(k)
      } catch {
        // ignore
      }
    })

    // Clear any generic sessionStorage/localStorage data
    // (keep it safe by not doing wholesale clear)
  }

  async function doLogout() {
    if (busy) return
    setBusy(true)

    try {
      clearClientStorage()

      // Context logout should also clean auth state.
      // (AuthContext currently removes localStorage token + axios header)
      logout?.()

      // Ensure navigation after context becomes null
      navigate('/login', { replace: true })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#DC2626',
    color: 'white',
    border: '1px solid rgba(220,38,38,0.35)',
    padding: compact ? '8px 10px' : '10px 14px',
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'transform 140ms ease, background 140ms ease, box-shadow 140ms ease',
    boxShadow: '0 10px 25px rgba(220,38,38,0.18)'
  }

  const btnHoverStyle = {
    background: '#B91C1C',
    transform: 'translateY(-1px)',
    boxShadow: '0 14px 30px rgba(185,28,28,0.22)'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!confirm) return doLogout()
          setOpen(true)
        }}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = btnHoverStyle.background
          e.currentTarget.style.transform = btnHoverStyle.transform
          e.currentTarget.style.boxShadow = btnHoverStyle.boxShadow
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = btnStyle.background
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = btnStyle.boxShadow
        }}
        disabled={busy}
        aria-label="Cerrar sesión"
      >
        <LogoutIcon />
        {!compact ? 'Cerrar sesión' : null}
      </button>

      {confirm && open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'white',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 50px rgba(2,6,23,0.25)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ fontWeight: 900, color: '#0f172a' }}>
                ¿Deseas cerrar sesión?
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 16, color: '#334155', fontWeight: 650 }}>
              Se limpiarán los datos de sesión y se te redirigirá al login.
            </div>

            <div
              style={{
                padding: 16,
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  color: '#0f172a',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={doLogout}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(220,38,38,0.35)',
                  background: '#DC2626',
                  color: 'white',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'background 140ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#B91C1C')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#DC2626')}
                disabled={busy}
              >
                {busy ? 'Cerrando...' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

