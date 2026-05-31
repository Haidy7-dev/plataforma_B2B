- [ ] Backend: `back/src/routes/superAdminCompanies.js`
  - [ ] Validar teléfono empresa: exactamente 10 dígitos en `POST /super-admin/companies`
  - [ ] Ajustar validación de teléfono en `POST /super-admin/companies/:companyId/users` para que no falle si no se envía (se pide solo password 6 dígitos)
  - [ ] Validar password admin: exactamente 6 dígitos numéricos en `POST /super-admin/companies/:companyId/users`

- [ ] Frontend: `front/src/role-pages/super-admin/pages/SuperAdminEmpresas.jsx`
  - [ ] En “Crear empresa”: agregar campo/validación teléfono exactamente 10 dígitos (required + pattern + min/max) y enviarlo al backend
  - [ ] En “Crear administrador”: validar password exactamente 6 dígitos (required + pattern + min/max)
  - [ ] Agregar eliminación de empresas con confirmación
  - [ ] Tras eliminar: refrescar listado y limpiar selección/modales

- [ ] Frontend: verificar que el inicio ya queda en “Usuarios/Empresa”
  - [ ] Confirmar que `/super-admin` carga correctamente `EmpresasUsuarios` (ya modificado en `SuperAdminLayout.jsx`)

- [ ] Pruebas manuales (critical-path)
  - [ ] Crear empresa con teléfono distinto a 10 → debe fallar
  - [ ] Crear empresa con teléfono de 10 dígitos → debe crear
  - [ ] Crear admin con password distinto a 6 → debe fallar
  - [ ] Crear admin con password 6 dígitos → debe crear
  - [ ] Eliminar empresa → debe mostrar confirmación y eliminar correctamente
