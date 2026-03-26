# Mejoras Priorizadas — CoffeeControl

Documento de trabajo para ordenar las mejoras propuestas sobre panel admin, backend y firmware ESP32-C3.

Objetivo:
- Tener una hoja de ruta clara.
- Implementar cambios de a una, sin mezclar prioridades.
- Reducir riesgo operativo en instalaciones reales.

## Criterio de priorización

Se usó este orden:
- Impacto operativo inmediato.
- Riesgo de seguridad o soporte.
- Dependencias técnicas.
- Velocidad de implementación.

## Prioridad 1 — Soporte operativo y UX inmediata

### 1. Mostrar/ocultar contraseña en el login del panel
Origen: pedido usuario
Estado: realizado

Problema:
- Hoy el login del panel oculta la contraseña sin opción de verla.
- En pruebas e instalaciones genera errores por tipeo.

Resultado esperado:
- Checkbox o botón tipo "ver".
- Sin cambiar la lógica de autenticación.

Impacto:
- Alto valor, bajo riesgo.

### 2. Mostrar/ocultar contraseña en el portal del ESP32
Origen: pedido usuario
Estado: realizado

Problema:
- Al configurar WiFi en campo, una clave larga o compleja se escribe fácil con error.

Resultado esperado:
- Opción para ver/ocultar la clave WiFi.
- UI clara en celular.

Impacto:
- Alto valor para instalación.

### 3. Cambiar el wording de acciones técnicas para que reflejen lo real
Estado: realizado en el panel admin

Incluye:
- Botones que desactivan y no borran.
- Mensajes que distingan "desactivar", "reiniciar", "reconfigurar", "factory reset".

Resultado esperado:
- Menos confusión operativa.

## Prioridad 2 — Portal ESP32 y recovery de red

### 4. Rediseñar el portal del ESP32
Origen: pedido usuario
Estado: realizado (iteración 1)

Problema:
- El portal actual es funcional pero básico.
- Falta claridad de flujo y feedback de estados.

Resultado esperado:
- Mejor layout móvil.
- Información visible: MAC, firmware, modo.
- Mejor feedback: guardando, conectando, error, éxito.

### 5. Escanear redes WiFi desde el portal
Origen: pedido usuario
Estado: realizado

Problema:
- Hoy hay que escribir el SSID a mano.
- Eso genera errores en campo.

Resultado esperado:
- Botón "Escanear redes".
- Lista de SSIDs visibles.
- Nivel de señal si es posible.
- Autocompletar el SSID al seleccionar.
- Mantener opción manual para redes ocultas.

Dependencias:
- Ajustar el modo WiFi del ESP para convivir con AP + scan sin romper el portal.

### 6. No borrar toda la configuración con el botón BOOT
Origen: pedido usuario
Estado: realizado

Problema:
- Hoy el reset borra todo el namespace de preferencias.
- Eso obliga a reingresar datos que podrían conservarse.

Resultado esperado:
- Borrar solo credenciales WiFi.
- Mantener URL del backend.
- Mantener otros settings futuros.

Impacto:
- Muy útil para soporte en sitio.

### 7. Reset escalonado
Origen: sugerido
Estado: realizado

Problema:
- Un único tipo de reset es poco flexible.

Resultado esperado:
- 5 segundos: borrar solo WiFi.
- 10-12 segundos: factory reset completo.

Ventaja:
- Más control para técnicos y menos riesgo de borrar de más.

### 8. Probar conexión antes de guardar en el portal
Origen: sugerido
Estado: realizado

Problema:
- Hoy se guarda y reinicia sin verificar si la red o la URL realmente funcionan.

Resultado esperado:
- Verificación opcional de WiFi.
- Si aplica, test a `/health` del backend.
- Mostrar error útil antes del reinicio.

### 9. Mejorar mensajes de error del portal
Origen: sugerido
Estado: parcialmente resuelto

Resultado esperado:
- Diferenciar:
  - SSID vacío
  - contraseña incorrecta
  - sin DHCP
  - backend inaccesible
  - URL inválida

## Prioridad 3 — Gestión remota desde el dashboard

### 10. Reiniciar el ESP32 desde el dashboard de máquinas
Origen: pedido usuario
Estado: realizado

Problema:
- Hoy un reinicio requiere acceso físico o energía.

Resultado esperado:
- Acción "Reiniciar" por máquina desde el panel.
- Confirmación explícita antes de ejecutar.
- Feedback de comando enviado / recibido / ejecutado.

Dependencias:
- Canal seguro de comandos remotos hacia la máquina.
- Mecanismo de confirmación de ejecución.

Notas técnicas:
- Puede implementarse con polling de comandos pendientes, WebSocket autenticado para máquinas o un endpoint de control con heartbeat.

### 11. Cambiar credenciales WiFi desde el dashboard
Origen: pedido usuario
Estado: realizado

Problema:
- Si cambia el WiFi de la empresa, hoy la reconfiguración depende de entrar al portal localmente.

Resultado esperado:
- Desde la vista de máquinas, abrir modal de reconfiguración WiFi.
- Cambiar SSID y contraseña.
- Posibilidad de conservar o editar backend URL.

Dependencias:
- Infraestructura de comandos remotos.
- Estrategia segura para aplicar credenciales y reconectar.

Riesgo:
- Si se envían credenciales erróneas, la máquina puede quedar inaccesible hasta usar portal local.

### 12. Escanear redes desde el dashboard al reconfigurar WiFi
Origen: pedido usuario
Estado: realizado

Resultado esperado:
- El panel pide al ESP un scan real del entorno de esa máquina.
- El técnico/admin selecciona una red detectada.

Dependencias:
- Punto 10/11.
- Endpoint o comando remoto para scan.

### 13. Estado detallado de red por máquina
Origen: sugerido
Estado: realizado

Resultado esperado:
- Ver SSID actual.
- RSSI aproximado.
- IP actual.
- Último error de conexión.
- Backend alcanzable sí/no.

## Prioridad 4 — Alertas, stock y reglas comerciales

### 14. Notificaciones automáticas por eventos críticos
Origen: pedido usuario
Estado: realizado en primera versión

Problema:
- Hoy el sistema detecta eventos relevantes, pero no avisa por fuera del panel.
- Si nadie está mirando el dashboard, un bloqueo, una falla o una caída de stock puede pasar desapercibida.

Resultado esperado:
- Envío por email y/o WhatsApp según el tipo de evento.
- Casos iniciales:
  - empleado bloqueado
  - máquina con falla o caída de heartbeat
  - stock bajo
- Configuración por destinatarios, severidad y canal.

Estado actual:
- Email operativo para:
  - advertencia preventiva de límite diario al empleado y supervisores activos de su área
  - empleado bloqueado por límite diario
  - máquina offline
  - stock bajo / sin stock por selección configurada
- Configuración desde `Panel admin > Notificaciones`:
  - destinatarios
  - activación general
  - selección de eventos útiles
  - umbral configurable de advertencia preventiva
  - prueba manual de envío
- Plantillas de email movidas a configuración interna del backend para no exponer placeholders al usuario final.
- SMTP y secretos siguen en `backend/.env`
- Política diaria configurable por empleado:
  - `Bloquear al alcanzar el límite`
  - `Solo advertir y registrar`
  - `Sin límite diario`
- Cada empleado puede activar o desactivar su advertencia de límite por email

Dependencias:
- Centralizar eventos desde backend o WebSocket en un dispatcher.
- Integrar proveedor de envío.
- Cola/reintento para no perder alertas.

Nota técnica:
- El WebSocket ya da una buena base para detectar eventos del panel; falta formalizar el canal de entrega externo.

Avance implementado:
- Email automático preventivo al empleado y supervisores activos de su área cuando queda cerca del límite.
- Email automático para empleado bloqueado por límite diario.
- Email automático para máquina offline por falta de heartbeat.
- `backend sin respuesta` se conserva como diagnóstico en la vista de máquinas, no como alerta por email.
- Estado persistente en base para no repetir la misma alerta mientras siga abierta.

Pendiente de esta mejora:
- WhatsApp.

### 15. Control de stock por máquina
Origen: pedido usuario

Problema:
- Hoy el sistema controla consumo y vending, pero no el inventario físico de cada selección.
- Eso limita soporte, reposición y alertas preventivas.

Resultado esperado:
- Saber cuántos productos quedan en cada máquina.
- Ver stock por selección/producto en dashboard y reportes.
- Disparar alertas por stock bajo.

Dependencias:
- Confirmar soporte real DEX/UCS por modelo de expendedora.
- Parser/ingesta de telemetría de stock.
- Conciliar stock reportado con ventas confirmadas.

Nota técnica:
- Es una mejora de alto valor, pero de complejidad media/alta porque depende de protocolo y compatibilidad real por máquina.

Avance implementado:
- V1 manual/estimada activa en `Máquinas > Stock`.
- Modelo por `machine + item_id`, con producto, slot opcional, capacidad, stock actual, mínimo y estado.
- Acciones disponibles: alta de selección, edición, reposición, ajuste, baja/reactivación.
- Historial de movimientos (`sale`, `restock`, `adjustment`, `unconfigured_sale`).
- Descuento automático de stock cuando `POST /api/tap/result` confirma una venta.
- Si la selección no está configurada, la venta no se rompe; se deja trazabilidad como `unconfigured_sale`.
- `Panel admin > Reportes` ya incluye reportes específicos de stock para `gerente/admin`, con estado actual por máquina, movimientos del rango y exportación Excel/PDF.

Pendiente de esta mejora:
- Integración DEX/UCS como V2.
- Refinar más adelante permisos finos si el rol técnico crece a instalación o mantenimiento avanzado.

### 16. Acceso premium por jerarquía
Origen: pedido usuario

Problema:
- Hoy el acceso es bastante uniforme por empleado.
- Falta una capa de negocio para distinguir beneficios por jerarquía o categoría.

Resultado esperado:
- Definir niveles o jerarquías de acceso.
- Poder habilitar límites, productos, saldo o gratuidades distintas según nivel.
- Mantener trazabilidad de quién accede a beneficios premium.

Dependencias:
- Modelo de datos para jerarquía/nivel.
- Reglas de autorización aplicadas en `tap`.
- UI para administrar niveles y excepciones.

## Prioridad 5 — Seguridad y robustez

### 17. Proteger WebSocket con JWT
Origen: sugerido
Estado: realizado

Problema:
- Hoy `/ws` no exige autenticación.

Resultado esperado:
- Solo usuarios autenticados del panel reciben eventos.

Impacto:
- Alto.

### 18. Unificar timezone entre backend y firmware
Origen: sugerido
Estado: realizado

Problema:
- Los límites diarios y el modo offline pueden cortarse distinto cerca de medianoche.

Resultado esperado:
- Criterio único de día local.
- Backend y firmware usando la misma zona horaria.

Implementado:
- `business_timezone` global configurable desde `Panel admin > Sistema`
- backend usando esa zona para dashboard, reportes, alertas y cortes diarios/mensuales
- firmware descargando `date` + `next_reset_at` desde `/api/tap/cards` para reset offline consistente

### 19. Flujo de TAG perdido/robado
Origen: sugerido
Estado: realizado

Problema:
- Si otro encuentra un TAG activo, puede consumir como el empleado original.

Resultado esperado:
- Marcar TAG como perdido.
- Reemplazarlo por otro.
- Mantener historial.
- Mostrar estado especial si hace falta.

Implementado:
- estados explícitos para TAGs NFC: `active`, `lost`, `inactive`
- acciones de panel: `Marcar perdido`, `Dar de baja`, `Reactivar`, `Reasignar`
- si un TAG reaparece, puede reactivarse o reasignarse sin perder historial
- si alguien intenta usar un TAG perdido o dado de baja, el backend responde `card_lost` o `card_inactive`

### 20. Auditoría de acciones administrativas
Origen: sugerido

Resultado esperado:
- Registrar quién hizo qué y cuándo.
- Ejemplos:
  - bloquear máquina
  - cambiar límite
  - reasignar TAG
  - resetear WiFi
  - reiniciar máquina

Implementado:
- tabla `audit_logs` con actor, IP, user-agent, acción, entidad, resumen y `details`
- saneo automático de campos sensibles (`password`, `pass`, `token`, `smtp_pass`, `secret`, etc.)
- auditoría en altas/ediciones/bajas de empleados, TAGs NFC, usuarios del panel, máquinas y configuraciones sensibles
- auditoría de comandos remotos encolados para máquinas
- pantalla `Auditoría` en el panel con filtros por entidad, acción, búsqueda libre y detalle técnico desplegable

## Prioridad 6 — Roles, calidad y mantenimiento

### 21. Alcance por área para supervisor
Origen: sugerido

Estado:
- Resuelto.

Resultado esperado:
- Un supervisor ve solo sus áreas asignadas cuando corresponda.

Implementado:
- tabla `admin_user_departments` para asignar una o varias áreas por supervisor
- dashboard, feed, reportes, WebSocket y lecturas de empleados respetan ese alcance
- el panel de usuarios ya permite cargar múltiples áreas por supervisor

### 22. Revisar o retirar `coffeecontrol.html`
Origen: sugerido

Problema:
- Quedó desalineado con la seguridad actual del backend.

Resultado esperado:
- O se adapta con auth real.
- O se retira para evitar confusión.

### 23. Scripts claros de base de datos y soporte
Origen: sugerido

Estado:
- Resuelto.

Resultado esperado:
- Script para migraciones completas.
- Script para reset de password admin.
- Script para crear/actualizar usuarios del panel.
- Script de diagnóstico rápido.

Implementado:
- `backend/scripts/db-init.js`
- `backend/scripts/db-migrate-all.js`
- `backend/scripts/support-doctor.js`
- `backend/scripts/support-user.js`

### 24. Tests de integración mínimos
Origen: sugerido

Estado:
- Resuelto.

Casos base:
- login
- roles
- registro de máquinas
- tap aprobado / rechazado
- cola offline

Implementado:
- `backend/test/integration.test.js`
- `npm run test:integration`
- cubre login, supervisor multi-área, `403` fuera de alcance, estados `card_lost` / `card_inactive`, comandos remotos, permisos de `Notificaciones` / `Auditoría` y registro de auditoría

### 25. Limpieza de logs y mensajes de arranque
Origen: sugerido

Incluye:
- quitar datos viejos o confusos en startup
- reflejar versión y credenciales seed reales
- mejorar mensajes operativos

### 26. Filtros avanzados para reportes de alto volumen
Origen: pedido usuario

Problema:
- Con empresas grandes, una tabla de cientos o miles de empleados se vuelve incómoda para ubicar rápido un caso puntual.

Resultado esperado:
- Búsqueda rápida por empleado dentro de `Reportes`.
- Filtro directo por área / departamento.
- Posibilidad de abrir y exportar un recorte puntual sin recorrer rankings completos.

Estado:
- realizado (v1)

Implementado:
- filtro global por área / departamento dentro de `Reportes`
- búsqueda rápida por empleado (nombre, legajo, email o DNI)
- detalle y exportación respetando el recorte actual sin tener que recorrer rankings completos

Pendiente fino:
- más recortes específicos para escenarios muy grandes
- paginado o búsqueda incremental si el volumen crece mucho más

### 27. Perfil técnico para operación de máquinas y stock
Origen: sugerido durante la definición de stock

Estado:
- Resuelto.

Resultado esperado:
- Separar operación técnica de la gestión gerencial.
- Permitir trabajo sobre máquinas, stock y comandos remotos sin exponer consumo nominal ni configuración global.

Implementado:
- nuevo rol `tecnico` en usuarios del panel
- acceso a `Máquinas`, stock y comandos remotos
- sin acceso a `Dashboard`, `Reportes`, `Feed`, `Empleados`, `Notificaciones`, `Sistema`, `Auditoría` ni `Usuarios`
- detalle técnico de máquina sin consumo por empleado ni taps nominales
- backend endurecido para que los permisos no dependan solo de la UI
- cobertura incluida en `npm run test:integration`

## Orden recomendado de implementación

### Fase A — Rápidas y de alto valor
1. [x] Mostrar contraseña en login del panel.
2. [x] Mostrar contraseña en portal ESP32.
3. [x] Reset solo WiFi.
4. [x] Reset escalonado.

### Fase B — Portal fuerte para instalaciones
5. [x] Rediseño del portal ESP32 (iteración 1).
6. [x] Escaneo de redes en portal.
7. [x] Probar conexión antes de guardar.
8. [~] Mensajes de error detallados.

### Fase C — Control remoto
9. [x] Infraestructura de comandos remotos para máquinas.
10. [x] Reinicio remoto desde dashboard.
11. [x] Cambio remoto de WiFi.
12. [x] Escaneo remoto desde dashboard.
13. [x] Estado detallado de red por máquina.

### Fase D — Alertas, stock y negocio
14. [x] Notificaciones automáticas.
15. [x] Control de stock por máquina (V1 manual/estimada).
16. Acceso premium por jerarquía.

### Fase E — Seguridad y robustez
17. [x] WebSocket autenticado.
18. [x] Timezone unificada.
19. [x] Flujo de TAG perdido/robado.
20. [x] Auditoría administrativa.

### Fase F — Calidad y mantenimiento
21. [x] Scope por área para supervisor.
22. Resolver `coffeecontrol.html`.
23. [x] Scripts DB y soporte.
24. [x] Tests de integración.
25. Limpieza final de logs y startup.
26. [x] Filtros avanzados en reportes para alto volumen (v1).
27. [x] Perfil técnico para operar máquinas y stock.

## Recomendación práctica

Si vamos de a una, sugiero arrancar así:
1. [x] Ver contraseña en login del panel.
2. [x] Ver contraseña en portal del ESP32.
3. [x] Reset solo WiFi.
4. [x] Reset escalonado.
5. [x] Escanear redes en portal.

Ese bloque da mucho valor rápido y prepara bien el terreno para la reconfiguración remota después.

## Próximo bloque sugerido

Si retomamos desde donde quedó el proyecto, el orden que más sentido tiene sería:
1. Integración DEX/UCS como V2 de stock.
2. Resolver `coffeecontrol.html`.
3. Refinar filtros/paginado de `Reportes` si el volumen real lo pide.
4. Acceso premium por jerarquía.

Razón:
- Reportes, exportaciones y stock ya quedaron fuertes para operar y llevar a reunión.
- El siguiente salto de valor está en profundizar stock con telemetría real y seguir cerrando frentes operativos pendientes.
