# Arquitectura App Gerente Movil

Documento de alcance y direccion para la app movil del rol `gerente`.

## Estado actual del criterio

Ya existe una **PWA V1** en `coffeecontrol-gerente.html`, pensada como prototipo funcional para validar flujo, alcance y lenguaje visual.

La decision actual es:
- conservar esa PWA como referencia/prototipo
- y orientar la siguiente implementacion seria a una **app gerente nativa**

O sea: este documento sigue siendo valido como alcance funcional, pero no debe leerse como una defensa de que la PWA sea el formato final.

## Objetivo

Dar al gerente una experiencia movil de consulta y decision, sin depender del panel de escritorio y sin mezclar tareas tecnicas de campo.

La app debe servir para:
- ver el estado general del sistema en segundos
- detectar desvíos
- ubicar una maquina, un area o un empleado
- preparar reuniones con datos concretos
- reaccionar ante alertas operativas sin entrar a soporte profundo

## Principio de producto

No copiar 1:1 el panel admin de PC.

La app gerente debe ser:
- mas ejecutiva
- mas limpia
- mas rapida de leer
- orientada a resumen, contexto y decision

No debe ser una app tecnica ni un panel comprimido.

## Alcance recomendado V1

### Login

- selector de empresa antes del login
- usuario + contrasena
- mostrar/ocultar contrasena
- biometria luego del primer acceso
- cambio de empresa desde sesion

### Tabs principales

- `Inicio`
- `Maquinas`
- `Reportes`
- `Alertas`

### Pantallas V1

#### 1. Inicio

Pantalla de resumen ejecutivo:
- consumos del dia
- consumos del mes
- monto del periodo
- maquinas online/offline
- alertas activas
- top area o top maquina
- atajos a reportes y alertas

#### 2. Maquinas

Vista resumida del parque:
- nombre
- ubicacion
- estado online/offline
- taps del dia y del mes
- alertas asociadas
- acceso a detalle resumido

El gerente no necesita en V1:
- WiFi remoto
- escaneo de redes
- comandos tecnicos profundos

#### 3. Reportes

Reportes rapidos para movil:
- rango de fechas simple
- corte por empleado
- corte por area
- corte por maquina
- filtros basicos
- acceso rapido a exportacion o compartir resumen

#### 4. Alertas

Bandeja movil de alertas:
- maquina offline
- stock bajo
- empleado bloqueado
- eventos relevantes para gestion

Cada alerta deberia abrir:
- maquina
- empleado
- o reporte contextual

#### 5. Sesion

- empresa activa
- usuario y rol
- biometria activa/no
- cambiar empresa
- cerrar sesion

## Fuera de V1

No incluir al inicio:
- ABM completo de empleados
- gestion de usuarios del panel
- notificaciones y sistema
- auditoria completa
- comandos tecnicos
- stock operativo
- gestion de TAGs

Eso queda mejor en:
- panel admin de escritorio
- app tecnico

## Roles objetivo

V1 pensada principalmente para:
- `gerente`
- `admin`

Mas adelante podria evaluarse una variante acotada para:
- `supervisor`

## Backend

La idea es reutilizar el backend actual.

Bloques que ya existen y pueden reutilizarse:
- autenticacion JWT
- dashboard
- reports
- machines
- alerts
- scopes por area para supervisor

Si hace falta simplificar payloads para movil, conviene agregar endpoints moviles especificos sin romper el panel existente.

## Experiencia visual

La app gerente deberia diferenciarse de la tecnico.

### App tecnico

- tactica
- operativa
- rapida
- orientada a campo

### App gerente

- ejecutiva
- limpia
- mas editorial
- mas enfocada en lectura y resumen

## Roadmap recomendado

### Fase 1

- mockup dedicado
- arquitectura V1 definida
- decision de stack

### Fase 2

- login + biometria
- selector de empresa
- pantalla Inicio
- lista de Maquinas

### Fase 3

- Reportes moviles
- Alertas
- compartir/exportar resumen

### Fase 4

- pulido UX
- push notifications si tiene sentido
- filtros mas ricos

## Archivos relacionados

- `app-gerente-mockup.html`
- `app-mobile-mockups.html`
- `MODELO_OPERATIVO_CLIENTES.md`
- `ARQUITECTURA_APP_TECNICO_ANDROID.md`
