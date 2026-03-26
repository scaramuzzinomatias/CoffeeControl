# Protocolo de Pruebas Online / Offline

Este protocolo está pensado para validar una instalación piloto de CoffeeControl antes de entregarla o dejarla corriendo en sitio.

## Objetivo

Validar que el sistema:

- autentica correctamente
- registra consumos online
- sigue operando offline
- sincroniza al reconectar
- respeta roles, reportes y alertas

## Preparación

Antes de empezar:

- backend corriendo
- base con backup reciente
- al menos un empleado activo con TAG válido
- máquina aprobada en panel
- acceso a panel admin
- acceso físico a la máquina o al entorno WiFi

Comandos sugeridos:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
npm run support:doctor
npm run db:backup
```

## 1. Prueba de login y roles

### Caso gerente/admin

Esperado:

- puede entrar al panel
- ve dashboard, reportes, empleados, usuarios, notificaciones, sistema, auditoría y máquinas

### Caso técnico

Esperado:

- entra al panel
- ve máquinas y stock
- no accede a dashboard ni reportes

### Caso distribuidor

Esperado:

- entra al panel
- ve máquinas y pendientes
- puede operar onboarding y comandos remotos
- no accede a analítica ni empleados

### Caso supervisor

Esperado:

- ve solo sus áreas asignadas
- no accede a configuración

## 2. Prueba online básica

### Paso 1

Verificar en `Máquinas`:

- máquina online
- SSID visible
- IP visible
- RSSI visible
- backend OK

### Paso 2

Tap con TAG válido.

Esperado:

- autorización correcta
- venta confirmada
- consumo registrado

### Paso 3

Verificar que el consumo aparezca en:

- dashboard
- feed en vivo
- reportes por empleado
- reportes por máquina

## 3. Prueba de rechazo

### TAG inactivo o perdido

Esperado:

- el backend rechaza
- el motivo coincide con el estado (`card_lost` o `card_inactive`)

### Límite diario

Si el piloto usa límite:

- probar hasta el umbral de advertencia
- probar el comportamiento final

Esperado:

- `warn_only`: registra y permite seguir
- `enforce`: bloquea cuando corresponde
- `off`: no limita

## 4. Prueba offline controlada

Esta es la prueba más importante del piloto.

### Preparación

- anotar hora de inicio
- anotar estado inicial de la cola si aplica
- asegurar que la máquina ya descargó caché de tarjetas

### Corte

Hacer uno de estos dos:

- apagar backend
- o aislar la máquina de la red

### Ejecución

Hacer entre 3 y 10 consumos con TAGs válidos.

Esperado:

- la autenticación offline sigue funcionando para tarjetas cacheadas
- la máquina no se bloquea
- los eventos quedan en cola offline

Capacidad actual esperada:

- tarjetas cacheadas: `1500`
- eventos offline: `1000`

### Reconexión

Volver a levantar backend o reconectar la red.

Esperado:

- la máquina vuelve online
- la cola offline se vacía sola
- los consumos reaparecen en backend
- reportes y dashboard quedan consistentes

## 5. Prueba de portal y recuperación

### Portal local

Con la placa encendida:

- mantener `BOOT` ~5 segundos
- verificar que aparezca `CoffeeControl-Setup`

Esperado:

- entra al portal
- se puede editar WiFi/URL sin borrar configuración automáticamente

### Portal

Probar:

- mostrar contraseña
- escanear redes
- seleccionar una red
- probar conexión
- guardar

## 6. Prueba de comandos remotos

Desde `Máquinas`:

- reiniciar
- abrir modal WiFi
- escanear redes

Esperado:

- el comando se encola
- la máquina lo toma
- el resultado queda reflejado en backend/panel

## 7. Prueba de reportes

Definir un rango corto y validar:

- reporte por máquina
- reporte por empleado
- reporte por departamento
- reportes de stock si forman parte del piloto

Exportación:

- `Excel`
- `PDF`

Esperado:

- archivos descargables
- datos consistentes con el rango

## 8. Prueba de notificaciones

Si SMTP está activo:

- enviar prueba desde `Notificaciones`
- generar al menos un evento real habilitado

Eventos típicos:

- empleado cerca del límite
- empleado bloqueado
- máquina offline
- stock bajo

Esperado:

- correo recibido en destinatarios correctos

## 9. Prueba de mantenimiento

Desde la raíz del repo:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto
.\mantenimiento-coffeecontrol.bat
```

Validar:

- `doctor`
- `backup`
- lectura de últimos backups

No ejecutar en cliente sin necesidad:

- `purge`
- `restore`
- `rebuild`

## 10. Criterio de aprobación

La instalación aprueba si:

- opera online sin errores funcionales
- resiste una caída controlada
- sincroniza correctamente al reconectar
- los roles respetan permisos
- los reportes y exportaciones son utilizables
- el soporte tiene un camino claro de recuperación

## Registro sugerido de prueba

Anotar:

- fecha
- técnico responsable
- versión de firmware
- versión de backend
- nombre de la máquina
- resultado de cada bloque
- incidentes observados
- resolución aplicada
