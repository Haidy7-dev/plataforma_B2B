# TODO - Mejoras flujo Gestor (Horario libre, recursos independientes, UTF-8)

- [ ] 1. Paso 4 (Horario libre)
  - [ ] Editar `front/src/role-pages/gestor-reservas/GestorReservasLayout.jsx`
  - [ ] Reemplazar select de horarios predefinidos por `horaInicio` y `horaFin` (`input type="time"`).
  - [ ] Validar en frontend que ambos campos estén completos y que `horaFin > horaInicio`.
  - [ ] Enviar `hora_inicio` y `hora_fin` en payload de creación de reserva.
  - [ ] Mostrar horas en resumen de confirmación.

- [ ] 2. Paso 5 (Recursos independientes por tarjeta)
  - [ ] Refactorizar render de recursos en `GestorReservasLayout.jsx` para evitar dependencias cruzadas entre columnas.
  - [ ] Mantener estado por recurso (`selected`, `cantidad`) completamente independiente por `id_recurso`.
  - [ ] Asegurar keys estables (nunca index).
  - [ ] Eliminar patrones de interacción problemáticos (`all: unset` en botón contenedor).
  - [ ] Mantener selección/cantidad al cambiar de paso o hacer scroll.
  - [ ] Mejorar UI de cards: nombre, tipo, stock, precio, cantidad y estado visual activo.

- [ ] 3. Backend reservas (validación y disponibilidad)
  - [ ] Editar `back/src/routes/reservations.js`.
  - [ ] Mantener/fortalecer validación de `hora_inicio`/`hora_fin`.
  - [ ] Agregar endpoint opcional de disponibilidad para el paso 4 (antes de confirmar creación).
  - [ ] Mejorar mensajes de error para cruces de horario y rango inválido.

- [ ] 4. Corrección UTF-8 integral
  - [ ] Revisar y ajustar `back/src/services/mysql.js` para conexión `utf8mb4`.
  - [ ] Crear script SQL de normalización de charset/collation para tablas relevantes.
  - [ ] Limpiar caracteres dañados visibles en frontend/backend.
  - [ ] Garantizar respuesta JSON y lectura/escritura en UTF-8 consistente.

- [ ] 5. Validaciones finales y entrega
  - [ ] Verificar consistencia de datos de hora en módulos relacionados.
  - [ ] Verificar que recursos de ambas columnas se seleccionen simultáneamente sin interferencia.
  - [ ] Preparar diagnóstico final con causa raíz, cambios aplicados y checklist de pruebas funcionales.
