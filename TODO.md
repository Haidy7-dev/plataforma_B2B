# TODO - Reglas de negocio Logística (iteración actual)

- [x] Analizar archivos relevantes (`LogisticaLayout.jsx`, `LogisticaStyles.css`, `back/src/routes/logistics.js`, `back/src/routes/reservations.js`)
- [x] Definir plan de edición y confirmar con usuario
- [ ] Inventario solo lectura:
  - [ ] Eliminar UI/acciones de importar CSV y edición en `InventarioView`
  - [ ] Mantener únicamente visualización + actualizar
- [ ] Datos reales (sin hardcode):
  - [ ] Reemplazar datos simulados en seguimiento/eventos/reservas por consulta API real
  - [ ] Mantener búsqueda sobre resultados reales
- [ ] Estado vacío reservas:
  - [ ] Si no hay datos, ocultar tabla completamente
  - [ ] Mostrar mensaje: "No hay reservas programadas en este momento"
- [ ] Ajustes mínimos de estilo para estado vacío (si aplica)
- [ ] Marcar avances en este TODO
- [ ] Testing (pendiente confirmar al cierre)
