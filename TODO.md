# TODO - Perfil conectado a BD + módulo informativo (sin tocar módulos existentes)

## Paso 1 (completo)
- Analizar el repo: identificar qué endpoints/perfiles usan mocks (`dataStore`) y cuáles ya usan MySQL.

## Paso 2 (en progreso)
- Confirmar el alcance: agregar **solo** un módulo informativo/documental complementario, SIN modificar dashboards/módulos existentes ni rutas ya implementadas.

## Paso 3
- Localizar dónde se navega/rota el front (layout de roles y rutas existentes).

## Paso 4
- Implementar una nueva vista informativa “Documentación de flujo por rol”:
  - Cards por rol
  - Tabla/permiso (qué rol consulta/crea/edita)
  - Diagramas relacionales y timeline de flujo
  - Indicadores visuales
  - Tooltips

## Paso 5
- Conectar esa vista con el backend **solo si aplica** (si el backend no tiene endpoints nuevos, se documenta con datos locales estáticos basados en BD actual).

## Paso 6
- Asegurar estilos SaaS modernos y compatibilidad con diseño actual.

## Paso 7 (hecho)
- Se agregó vista informativa “Documentación de flujo (BD)” con filtrado por rol en:
  - Admin: `/admin/documentacion-flujo`
  - Logística: `/logistica/documentacion-flujo`
  - (vista reutilizable por rol)
- Se validó build del front con `vite build`.


