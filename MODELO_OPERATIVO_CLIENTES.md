# Modelo Operativo por Cliente y Despliegue en Nube

Este documento define cómo conviene operar CoffeeControl en su estado actual, pensando en clientes reales, soporte, recuperación de credenciales y despliegue cloud.

## 1. Estado actual del producto

CoffeeControl hoy está bien preparado para:

- una empresa por instalación
- una o varias máquinas de esa empresa
- control de consumo por empleado
- reportes, alertas, auditoría y operación remota

CoffeeControl hoy no está diseñado todavía como SaaS multiempresa real.

Eso significa que hoy no conviene meter en la misma instalación lógica a empresas totalmente distintas como:

- McCain
- PepsiCo

## 2. Recomendación actual

La recomendación correcta hoy es:

- una instalación por empresa
- una base por empresa
- un backend por empresa
- una cuenta protegida de soporte por empresa
- una o más cuentas funcionales del cliente por empresa

## 3. Modelo de cuentas recomendado

### Cuenta `admin` protegida

Es la cuenta maestra de la instalación.

Uso recomendado:

- la usa solo el proveedor / soporte
- no se usa para la operación diaria del cliente
- no se entrega como usuario habitual

Características:

- acceso total
- puede recuperar al resto
- si está protegida, no puede editarse desde el panel
- su contraseña solo se recupera localmente por soporte

### Cuenta `gerente`

Es la cuenta principal del cliente.

Uso recomendado:

- operación diaria de la empresa
- gestión de empleados
- reportes
- notificaciones
- límites y jerarquías
- usuarios funcionales del cliente

Características:

- acceso funcional completo de la empresa
- no debe ser una cuenta protegida
- debe tener email real del responsable

### Otras cuentas

- `supervisor`: seguimiento por área
- `tecnico`: operación de máquinas, stock y comandos remotos
- `distribuidor`: instalación, onboarding y soporte de máquinas

## 4. Alta recomendada de una empresa nueva

Para una nueva instalación, el flujo recomendado es:

1. Crear la base de datos de esa empresa.
2. Levantar una instancia backend de esa empresa.
3. Crear o resetear la cuenta `admin` protegida.
4. Crear el usuario `gerente` del cliente.
5. Entregar al cliente el usuario `gerente` con una contraseña temporal.
6. Pedir cambio de contraseña en el primer acceso.
7. Crear luego `supervisores`, `tecnicos` o `distribuidores` si hacen falta.

## 5. Recuperación de credenciales

### Si el `admin` protegido olvida la contraseña

No hay recuperación por mail.

La recuperación se hace solo por soporte local con:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
node scripts/support-user.js --username admin --password NuevaClaveSegura2026 --role admin --protected --activate
```

### Si el `gerente` olvida la contraseña

Hoy no existe flujo de “Olvidé mi contraseña” por email.

La recuperación se hace:

- por `admin` / soporte
- o desde soporte local con `support-user.js`

Ejemplo:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
node scripts/support-user.js --username gerente1 --password NuevaClaveSegura2026 --role gerente --full-name "Gerente Cliente" --email gerente@empresa.com --activate
```

### Si un `supervisor`, `tecnico` o `distribuidor` olvida la contraseña

Mismo criterio que `gerente`:

- reset desde panel por un usuario alto
- o reset local por soporte

## 6. Ejemplo operativo por cliente

### McCain

- base: `coffeecontrol_mccain`
- backend: instancia propia
- cuenta protegida: `admin`
- cuenta funcional principal: `gerencia.mccain`

### PepsiCo

- base: `coffeecontrol_pepsico`
- backend: instancia propia
- cuenta protegida: `admin`
- cuenta funcional principal: `gerencia.pepsico`

Cada cliente queda totalmente aislado del otro.

## 7. Despliegue en nube — qué conviene hoy

### Opción recomendada hoy

Un mismo servidor cloud puede alojar varias empresas, pero con stacks separados.

Ejemplo:

- un VPS o VM
- un reverse proxy
- una instancia backend por empresa
- una base de datos por empresa
- un subdominio por empresa

### Ejemplo de dominios

No hace falta comprar un dominio distinto para cada cliente.

Lo más sano hoy es usar subdominios:

- `mccain.tudominio.com`
- `pepsico.tudominio.com`

o más explícito:

- `mccain.coffeecontrol.tudominio.com`
- `pepsico.coffeecontrol.tudominio.com`

Esto es mejor que usar paths como:

- `tudominio.com/mccain`
- `tudominio.com/pepsico`

Porque los subdominios aíslan mejor:

- sesión
- configuración
- operación
- certificados
- troubleshooting

## 8. Topología recomendada hoy

### Reverse proxy

Ejemplo con Nginx o Caddy:

- `mccain.tudominio.com` -> backend McCain en puerto interno `3001`
- `pepsico.tudominio.com` -> backend PepsiCo en puerto interno `3002`

### Base de datos

Dos caminos válidos:

- un mismo PostgreSQL con dos bases separadas
- dos PostgreSQL separados

Recomendación actual:

- un mismo servidor PostgreSQL
- una base por empresa

Ejemplo:

- `coffeecontrol_mccain`
- `coffeecontrol_pepsico`

### Variables de entorno

Cada empresa debe tener su propia configuración:

- `DATABASE_URL`
- `JWT_SECRET`
- `REGISTRATION_SECRET`
- SMTP si aplica
- branding futuro si aplica

## 9. Cómo apuntan las máquinas al backend en nube

Cada máquina de una empresa debe apuntar al backend de esa empresa.

Ejemplo:

- máquinas McCain -> `https://mccain.tudominio.com`
- máquinas PepsiCo -> `https://pepsico.tudominio.com`

Eso se puede resolver de dos formas:

- modo `local`: el técnico carga la URL en el portal del ESP32 al instalar
- modo `saas`: el firmware compila con una URL fija y todas las máquinas de esa empresa apuntan ahí

Para el estado actual del producto, el modo más flexible es:

- una URL por empresa
- cargada por instalación o parametrizada por despliegue

## 10. Qué no conviene hoy

No conviene hoy:

- usar una sola base para empresas distintas
- usar un solo backend sin aislamiento por empresa
- mezclar McCain y PepsiCo en el mismo dataset
- entregar la cuenta `admin` protegida como cuenta operativa del cliente

## 11. Qué sí podría venir después

Más adelante, si el producto crece a SaaS real, ahí sí conviene implementar:

- tabla `tenants`
- `tenant_id` en todas las tablas relevantes
- aislamiento por empresa dentro de la app
- branding/configuración por empresa
- onboarding multiempresa real

Pero ese es otro bloque de arquitectura.

## 12. Recomendación final

Hoy, la forma profesional y segura de operar CoffeeControl es:

- una empresa por backend
- una base por empresa
- un subdominio por empresa
- backups identificados por cliente/base
- restore probado con procedimiento explícito

Runbook operativo asociado:

- [RUNBOOK_BACKUP_RESTORE_CLIENTES.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/RUNBOOK_BACKUP_RESTORE_CLIENTES.md)
- [PLANTILLA_DESPLIEGUE_CLIENTE.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/PLANTILLA_DESPLIEGUE_CLIENTE.md)

- una empresa por instalación
- un backend por empresa
- una base por empresa
- una cuenta `admin` protegida para soporte
- una cuenta `gerente` para el cliente
- recuperación de contraseñas por soporte, no por improvisación manual

Ese modelo es simple, seguro y coherente con el producto actual.
