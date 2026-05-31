# TODO - Rediseño Módulo Logística (solo reservas)

## Paso 1 — Backend (endpoint checklist)
- [ ] Editar `back/src/routes/logistics.js`
  - [ ] Ajustar `GET /logistica/reservas-checklist` para:
    - [ ] Aceptar query `fecha` (default = hoy)
    - [ ] Filtrar SOLO reservas para esa fecha
    - [ ] Eliminar hardcode de cliente (`AND c.nombre = 'Dra Chulito'`) duplicado
  - [ ] Incluir en el SELECT `rec.tipo` (si existe) y/o preparar agrupación futura
  - [ ] Asegurar cálculo de progreso por reserva

## Paso 2 — Backend (cambio automático)
- [ ] Editar `PATCH /logistica/reservas-checklist/:idDetalle/estado`
  - [ ] Tras actualizar `detalle_reserva.estado_logistica`, verificar si TODOS los detalles de esa reserva cumplen “listo”
  - [ ] Si corresponde, actualizar `reserva.estado_evento = 'Lista para Evento'` (según columna existente)

## Paso 3 — Backend (seguridad y alcance)
- [ ] Confirmar que no se exponen endpoints no requeridos en el frontend
- [ ] (Opcional si aplica) Mantener solo lo necesario para rol logística (validación en router)

## Paso 4 — Frontend UI operativa
- [ ] Reemplazar `front/src/role-pages/logistica/LogisticaLayout.jsx`
  - [ ] Eliminar módulos: rutas, seguimiento, inventario, incidencias, historial
  - [ ] Crear vista única con:
    - [ ] Selector de fecha + botón Actualizar
    - [ ] Lista/cards de reservas para esa fecha
    - [ ] Info básica: cliente, evento(estado_evento), espacio, fecha y horario
    - [ ] Checklist por reserva con checkbox por recurso
    - [ ] Estados como checkbox (preparado/cargado/entregado/verificado según mapeo)
    - [ ] Progreso (%) por reserva
  - [ ] Checkbox ejecuta `PATCH` y actualiza progreso en tiempo real (re-fetch rápido)

## Paso 5 — Frontend estilos
- [ ] Limpieza y ajuste de `front/src/role-pages/logistica/LogisticaStyles.css`
  - [ ] Responsive cards y checklist
  - [ ] Eliminar estilos de módulos eliminados

## Paso 6 — Validación
- [ ] Ejecutar `npm` scripts/arranque si corresponde
- [ ] Probar en navegador: carga de reservas por fecha + marcado de checkboxes + cambio a “Lista para Evento”
