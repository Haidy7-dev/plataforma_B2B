import React from 'react'
import PremiumRoleLayout from '../../components/layout/PremiumRoleLayout.jsx'

export default function SuperAdminPremiumLayout({ title, roleLabel, links, children }) {
  return (
    <PremiumRoleLayout title={title} roleLabel={roleLabel} links={links}>
      {children}
    </PremiumRoleLayout>
  )
}


