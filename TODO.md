# TODO - Flujo de reservas Gestor (Recursos + persistencia detalle_reserva)

- [x] 1. Completar `front/src/role-pages/gestor-reservas/GestorReservasLayout.jsx`
  - [x] Definir flujo de 6 pasos: Cliente → Espacio → Fecha → Horario → Recursos → Confirmar.
  - [x] Integrar carga real de espacios (`GET /reservations/spaces`).
  - [x] Integrar carga real de recursos (`GET /reservations/resources`).
  - [x] Implementar selección múltiple de recursos con cantidad editable.
  - [x] Validar cantidades ( > 0 si seleccionado, <= stock ) y permitir reserva sin recursos.
  - [x] Enviar payload de recursos como `{ id_recurso, cantidad }` en `POST /reservations/reservations`.
  - [x] Reemplazar alertas por mensajes visuales (éxito/error) en UI.

- [ ] 2. Ajuste mínimo de compatibilidad en `front/src/role-pages/admin/pages/ReservationsFlow.jsx`
  - [ ] Mantener funcionamiento actual sin romper.
  - [ ] Asegurar formato compatible de recursos si el flujo se reutiliza.

- [ ] 3. Verificación de integración con logística (sin nuevos endpoints/tablas)
  - [ ] Confirmar que los datos persisten en `detalle_reserva` a través del backend existente.
  - [ ] Confirmar que logística muestra automáticamente reserva, cliente, espacio, fecha, hora, recursos y cantidades usando su consulta actual.
