# ADMIN módulo — ejecución actual

## Paso 1: Backend dashboard real (`back/src/routes/admin.js`)
- [x] Ajustar `/admin/dashboard/stats` a estructura final real
  - [x] `activeUsers`
  - [x] `confirmedEvents`
  - [x] `pendingPayments`
  - [x] `finalizedEvents`
  - [x] `upcomingEvents` (máx 5, `fecha_evento ASC`)
  - [x] `pendingPaymentsList` (`PENDIENTE|PARCIAL|DEUDA`)
  - [x] `recentReservations` (últimas creadas)

## Paso 2: Menú/rutas admin (`front/src/role-pages/admin/AdminLayout.jsx`)
- [x] Eliminar Tasks y Operativa (rutas + links + imports)
- [x] Dejar menú final:
  - [x] Dashboard
  - [x] Gestión usuarios
  - [x] Reservas
  - [x] Inventario CSV
  - [x] Reportes
  - [x] Actividades recientes
- [x] Agregar ruta Reservas reutilizando `ReservationsFlow.jsx`

## Paso 3: Dashboard admin (`front/src/role-pages/admin/pages/AdminDashboard.jsx`)
- [x] Eliminar bloques/textos mock
- [x] Mostrar cards reales requeridas
- [x] Mostrar sección Próximos eventos (max 5)
- [x] Mostrar sección Pagos pendientes
- [x] Mostrar sección Actividad reciente
- [x] Aplicar colores:
  - [x] rojo deuda
  - [x] naranja parcial
  - [x] verde pagado/finalizado

## Paso 4: Actividades admin (`front/src/role-pages/admin/pages/AdminActivity.jsx`)
- [x] Eliminar mock
- [x] Consumir `/admin/dashboard/stats`
- [x] Mostrar `recentReservations` minimalista

## Paso 5: Validación rápida
- [x] Revisar imports huérfanos
- [x] Verificar consistencia de rutas del módulo ADMIN
