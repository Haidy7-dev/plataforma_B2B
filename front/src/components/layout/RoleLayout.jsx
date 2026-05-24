import React from 'react'
import { NavLink } from 'react-router-dom'
import LogoutButton from '../auth/LogoutButton.jsx'


const linkBaseStyle = {
  display: 'block',
  padding: '10px 12px',
  borderRadius: 10,
  color: '#0f172a',
  fontWeight: 700,
  border: '1px solid transparent'
}

const activeStyle = {
  background: 'rgba(0,71,159,0.10)',
  border: '1px solid rgba(0,71,159,0.25)',
  boxShadow: '0 0 0 2px rgba(0,71,159,0.05)',
  color: 'var(--primary)'
}

export default function RoleLayout({
  title,
  roleLabel,
  links,
  children
}) {
  return (
    <div style={{ minHeight: '100vh' }}>

      <header
        style={{
          position: 'sticky',
          top: 0,
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 20px',
          zIndex: 5
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12
              }}
            >
              <div
                style={{
                  color: 'var(--primary)',
                  fontWeight: 900,
                  fontSize: 18
                }}
              >
                {title}
              </div>

              <div
                style={{
                  color: 'var(--secondary)',
                  fontWeight: 700
                }}
              >
                {roleLabel}
              </div>
            </div>

            <LogoutButton compact />
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: 20,
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 16
        }}
      >

        <aside
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 12,
            height: 'fit-content'
          }}
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              style={({ isActive }) =>
                isActive
                  ? { ...linkBaseStyle, ...activeStyle }
                  : linkBaseStyle
              }
            >
              {l.label}
            </NavLink>
          ))}
        </aside>

        <main>
          {children}
        </main>

      </div>
    </div>
  )
}

