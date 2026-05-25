# TODO - Corrección flujo reservas Gestor

- [x] Ajustar `GET /api/gestor/spaces` en `back/src/routes/reservations.js` para filtrar espacios creados por admins de la misma empresa del gestor.
- [x] Mantener búsqueda por `search` y forma de respuesta actual.
- [x] Incluir fallback seguro si no existe relación `espacio.id_usuario`.
- [x] Verificar consistencia del endpoint para no afectar el frontend actual.
