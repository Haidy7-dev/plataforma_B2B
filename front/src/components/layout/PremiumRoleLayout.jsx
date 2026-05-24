import React, { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import LogoutButton from '../auth/LogoutButton.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg'
  }

  switch (name) {
    case 'bell':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      )
    case 'shield':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
      )
    case 'users':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'store':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7" />
          <path d="M9 22V12h6v10" />
          <path d="M4 9h16l-1 13H5L4 9Z" />
        </svg>
      )
    case 'bolt':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" />
        </svg>
      )
    case 'activity':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9-4-18-3 9H2" />
        </svg>
      )
    case 'lock':
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    default:
      return (
        <svg
          {...common}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
  }
}

function toRoleLabel(role) {
  const raw = String(role || '').trim().toLowerCase()
  if (!raw) return 'Usuario'

  const map = {
    admin: 'Administrador',
    'super-admin': 'Super-Admin',
    gestor: 'Gestor',
    logistica: 'Logística',
    cliente: 'Cliente',
    operador: 'Operador'
  }

  return map[raw] || raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function PremiumRoleLayout({
  title,
  roleLabel,
  links,
  children
}) {
  const { user } = useAuth()
  const [notifsOpen, setNotifsOpen] = useState(false)

  const notifications = useMemo(
    () => [
      {
        id: 1,
        kind: 'critical',
        title: 'Acceso bloqueado por riesgo',
        meta: 'Últimos 5 min'
      },
      {
        id: 2,
        kind: 'info',
        title: 'Sincronización de inventario finalizada',
        meta: 'Hace 23 min'
      },
      {
        id: 3,
        kind: 'positive',
        title: 'Operación completada sin incidencias',
        meta: 'Hace 1 h'
      }
    ],
    []
  )

  const welcomeRole = toRoleLabel(user?.role || roleLabel)

  const safeLinks = Array.isArray(links) ? links : []

  return (
    <div className="sa-shell">
      <aside className="sa-sidebar">
        <div className="sa-brand">
          <div className="sa-logo">B2B</div>
          <div>
            <div className="sa-brandTop">{welcomeRole}</div>
            <div className="sa-brandBottom">Panel</div>
          </div>
        </div>

        <nav className="sa-nav">
          {safeLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                isActive ? 'sa-link sa-linkActive' : 'sa-link'
              }
            >
              <span className="sa-linkIcon" aria-hidden>
                <Icon name={l.icon || 'bolt'} />
              </span>
              <span className="sa-linkLabel">{l.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sa-sidebarFooter">
          <LogoutButton compact={false} />
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <div className="sa-topbarLeft">
            <h1 className="sa-title">Bienvenido, {welcomeRole}</h1>
          </div>

          <div className="sa-topbarRight">
            <div className="sa-notifsWrap">
              <button
                type="button"
                className="sa-iconBtn"
                onClick={() => {
                  setNotifsOpen((v) => !v)
                }}
                aria-label="Notificaciones"
              >
                <Icon name="bell" />
                <span className="sa-notifDot" />
              </button>
              {notifsOpen && (
                <div className="sa-dropdown sa-dropdownNotifs">
                  <div className="sa-dropdownHeader">Notificaciones</div>
                  <div className="sa-dropdownBody">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`sa-notif sa-notif-${n.kind}`}
                      >
                        <div className="sa-notifTitle">{n.title}</div>
                        <div className="sa-notifMeta">{n.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="sa-content">
          <div className="sa-container">{children}</div>
        </main>
      </div>
    </div>
  )
}
