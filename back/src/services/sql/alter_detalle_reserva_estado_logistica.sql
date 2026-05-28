-- Migración: estado logístico por recurso en detalle_reserva
-- Ejecutar una vez por entorno.
-- Reutiliza la base existente, no recrea tablas.

ALTER TABLE detalle_reserva
ADD COLUMN estado_logistica ENUM('PENDIENTE','PREPARADO','ENTREGADO')
DEFAULT 'PENDIENTE';
