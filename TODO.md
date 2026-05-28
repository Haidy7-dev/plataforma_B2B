# TODO - Corrección error "Error en la solicitud" y estabilización del flujo Gestor

- [x] 1. Diagnóstico de enrutamiento Front/Back
  - [x] Revisar `back/src/server.js` y confirmar prefijos reales de API.
  - [x] Revisar `back/src/routes/index.js` para validar base de rutas (`/gestor`, etc.).
  - [x] Revisar `front/src/role-pages/gestor-reservas/GestorReservasLayout.jsx` para identificar construcción de URLs.

- [x] 2. Corregir conectividad en desarrollo (Vite)
  - [x] Editar `front/vite.config.js` para agregar proxy de `/api` hacia `http://localhost:4000`.

- [x] 3. Mejorar manejo de errores HTTP/red en Gestor
  - [x] Editar `request()` en `front/src/role-pages/gestor-reservas/GestorReservasLayout.jsx`.
  - [x] Manejar explícitamente errores de red (backend caído / CORS / proxy ausente).
  - [x] Propagar mensaje del backend cuando exista (`message` / `error`) y no solo mensaje genérico.

- [x] 4. Ajustar flujo de confirmación de reserva
  - [x] Corregir acciones del paso final para que la creación ocurra en la etapa de confirmación y no quede bloqueada por el stepper.
  - [x] Mantener UX consistente para "Nueva reserva".

- [ ] 5. Verificación final
  - [ ] Validar que cargas de espacios/recursos funcionen sin "Error en la solicitud".
  - [ ] Validar creación de cliente y creación de reserva en flujo completo.
