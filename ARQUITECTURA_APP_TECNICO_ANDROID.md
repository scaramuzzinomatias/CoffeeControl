# Arquitectura Recomendada — App Tecnico Android

Este documento define la arquitectura recomendada para la **app tecnico Android** de CoffeeControl, asumiendo estas decisiones ya tomadas:

- los TAGs fisicos son los mismos que hoy lee el `RC522`
- la app tecnico debe poder **leer esos tags con el telefono**
- el acceso debe soportar **huella / rostro / biometria del dispositivo**
- el foco operativo es:
  - maquinas
  - stock
  - onboarding
  - comandos remotos
  - alta / reemplazo / reasignacion de TAGs

---

## 1. Decision principal

La app tecnico **no deberia hacerse como PWA final**.

La PWA sirve como prototipo operativo, pero para la version definitiva del tecnico la recomendacion correcta es:

- **Android nativa**
- con NFC real del telefono
- con biometria del sistema

Motivos:

- una PWA no da una base suficientemente robusta para lectura NFC de tags fisicos
- la UX biometrica es mucho mejor en app nativa
- las tareas de campo requieren menos friccion, mejor performance y mejor control del dispositivo
- Android es el camino natural para el tecnico de campo; iPhone no es prioridad para esta etapa

---

## 2. Alcance V1 recomendado

La V1 de la app tecnico deberia cubrir:

1. login inicial con usuario + contrasena
2. desbloqueo posterior con biometria
3. lista de maquinas
4. detalle tecnico de maquina
5. stock por maquina
6. onboarding de maquinas pendientes
7. comandos remotos
   - reiniciar
   - cambiar WiFi
   - escanear redes
8. lectura NFC de TAG fisico
9. asignacion / reemplazo / reasignacion de TAG

No incluir en V1:

- reportes gerenciales
- feed en vivo completo
- auditoria completa
- analitica por empleado
- modo offline para escritura de cambios sensibles

---

## 3. Stack recomendado

### Opcion recomendada

- **Kotlin**
- **Jetpack Compose**
- **Navigation Compose**
- **Retrofit + OkHttp**
- **Kotlin Serialization** o **Moshi**
- **BiometricPrompt**
- **Android Keystore**
- **EncryptedSharedPreferences** o storage cifrado equivalente
- **NfcAdapter + ReaderMode**

### Por que este stack

- es el camino mas estable para Android hoy
- NFC y biometria se resuelven mejor en nativo que en web
- evita meter un bridge innecesario para una funcion central como leer tags
- facilita una UX verdaderamente movil y no "web envuelta"

### Opcion alternativa

- `Capacitor` reutilizando parte de la PWA actual

Solo la recomiendo si se prioriza velocidad extrema sobre calidad de integracion nativa.

Mi recomendacion fuerte sigue siendo:

- **gerente**: PWA o experiencia web movil
- **tecnico**: Android nativa

---

## 4. Login y biometria

### Objetivo

El tecnico no deberia escribir usuario y contrasena todo el tiempo.

### Flujo recomendado

1. Primer ingreso:
   - usuario + contrasena
   - backend valida
   - backend entrega sesion movil

2. La app ofrece:
   - "Activar desbloqueo biometrico"

3. Si el usuario acepta:
   - se guarda el secreto de sesion cifrado localmente
   - el acceso futuro queda protegido por `BiometricPrompt`

4. Siguientes aperturas:
   - la app pide biometria del dispositivo
   - si valida, desbloquea la sesion local
   - si la sesion vencio, renueva silenciosamente o pide login de nuevo

### Importante

La biometria **no reemplaza** la autenticacion del backend.

La biometria solo:

- desbloquea el secreto local almacenado
- evita que el tecnico vuelva a escribir la clave

### Recomendacion de backend

El backend actual usa un JWT simple de 8h. Para la app tecnico es mejor pasar a:

- `access token` corto
- `refresh token` o `session token` movil

### Recomendacion concreta

Agregar para mobile:

- `POST /api/mobile-auth/login`
- `POST /api/mobile-auth/refresh`
- `POST /api/mobile-auth/logout`
- opcion futura: `POST /api/mobile-auth/logout-all`

Y una tabla tipo:

- `mobile_sessions`
  - `id`
  - `admin_user_id`
  - `device_name`
  - `platform`
  - `refresh_token_hash`
  - `last_used_at`
  - `revoked_at`
  - `created_at`

---

## 5. Lectura NFC de los tags actuales

### Punto clave

Los tags son "los mismos del RC522", por lo tanto el supuesto de trabajo es:

- `13.56 MHz`
- compatibles con lectura NFC del telefono Android

### Como se lee hoy en firmware

El firmware actual arma el UID asi:

- lee `rfid.uid.uidByte[i]`
- lo convierte a hex
- lo rellena con `0` si hace falta
- luego lo pasa a mayusculas

Referencia en firmware:

- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp)

### Como deberia leerlo Android

La app tecnico deberia:

1. activar `ReaderMode`
2. capturar el `Tag`
3. leer `tag.id`
4. convertir los bytes a hex **en el mismo orden**
5. normalizar a mayusculas, sin separadores

Ejemplo esperado:

- `0A30FC80`

### Riesgo a validar

Antes de cerrar la implementacion hay que probar con un tag real y comparar:

- UID leido por maquina
- UID leido por Android

Porque en NFC siempre conviene validar si la representacion de bytes coincide exactamente.

### Si esta validacion da bien

Entonces la app tecnico puede registrar el mismo UID que hoy usa el backend.

---

## 6. Flujo de gestion de TAGs

### Regla operativa

El empleado **no** registra su propio tag.

Solo usuarios autorizados:

- tecnico
- distribuidor
- gerente
- admin

### Flujos V1

#### A. Asignar tag nuevo a empleado existente

1. tecnico busca empleado
2. toca `Escanear tag`
3. apoya el TAG en el telefono
4. la app lee UID
5. backend valida si el UID:
   - no existe
   - existe pero estaba inactivo
   - existe y esta asignado
6. tecnico confirma
7. backend asigna
8. queda auditado

#### B. Reemplazo de tag perdido

1. tecnico abre empleado
2. marca tag actual como `lost`
3. escanea nuevo tag
4. confirma asignacion
5. backend deja trazabilidad de reemplazo

#### C. Reasignacion

1. tecnico escanea tag
2. backend muestra estado actual
3. tecnico elige nuevo empleado
4. backend reasigna y audita

---

## 7. Endpoints reutilizables del backend actual

La app tecnico puede reutilizar casi sin cambios:

- `POST /api/auth/login` (solo como base temporal)
- `GET /api/machines`
- `GET /api/machines/pending`
- `POST /api/machines/pending/:id/approve`
- `POST /api/machines/pending/:id/reject`
- `PATCH /api/machines/:id`
- `POST /api/machines/:id/commands`
- `GET /api/machines/:id/commands/:commandId`
- `GET /api/machines/:id/stock`
- `POST /api/machines/:id/stock`
- `PATCH /api/machines/:id/stock/:stockItemId`
- `POST /api/machines/:id/stock/:stockItemId/restock`
- `POST /api/machines/:id/stock/:stockItemId/adjust`

Referencias:

- [machines.js](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/backend/src/routes/machines.js)

---

## 8. Endpoints nuevos recomendados para TAGs desde la app tecnico

El backend actual de tarjetas NFC esta muy orientado al panel gerencial.

Referencias:

- [employees.js](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/backend/src/routes/employees.js)
- [nfcCards.js](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/backend/src/routes/nfcCards.js)

### Recomendacion

Crear endpoints tecnicos dedicados, por ejemplo:

- `GET /api/mobile-tech/employees/search?q=...`
- `POST /api/mobile-tech/employees/:id/cards`
- `PATCH /api/mobile-tech/employees/:id/cards/:cardId`
- `GET /api/mobile-tech/cards/lookup/:uid`

### Ventajas

- no se mezclan permisos del panel con flujo movil
- el payload queda pensado para la UX del tecnico
- es mas facil auditar
- se puede recortar la data sensible que ve la app

### Middleware recomendado

Agregar algo como:

- `requireCardOperator`

Permitidos:

- `admin`
- `gerente`
- `tecnico`
- `distribuidor`

No permitir:

- `supervisor`

---

## 9. Pantallas V1

### 1. Login

- usuario
- contrasena
- activar biometria despues del primer ingreso

### 2. Home / Maquinas

- lista de maquinas
- estado online/offline
- backend
- stock resumido

### 3. Detalle de maquina

- SSID
- IP
- RSSI
- URL backend
- ultimo error
- acciones remotas

### 4. Stock

- ver selecciones
- alta
- edicion
- reposicion
- ajuste
- baja / reactivacion

### 5. Pendientes

- lista de maquinas pendientes
- aprobar
- rechazar

### 6. Buscar empleado

- por nombre
- legajo
- DNI
- email

### 7. Escanear tag

- lector NFC en primer plano
- UID detectado
- resolucion de estado

### 8. Asignar / reemplazar / reasignar

- confirmar operacion
- mostrar resultado

---

## 10. Estrategia offline

Para esta app tecnico, la recomendacion V1 es:

- **sin operaciones sensibles offline**

O sea:

- puede cachear shell/UI
- puede cachear alguna data reciente
- pero no deberia guardar para despues:
  - asignaciones de tag
  - cambios de stock
  - onboarding
  - comandos remotos

Motivo:

- son acciones administrativas
- requieren backend
- requieren auditoria consistente

---

## 11. Roadmap recomendado

### Fase 0 — Validacion de base

1. Probar dos tags reales en Android
2. Confirmar que el UID coincide con la maquina
3. Confirmar que el modelo de telefono elegido lee esos tags de forma estable

### Fase 1 — Backend movil

1. `mobile-auth`
2. `mobile_sessions`
3. endpoints tecnicos para tarjetas
4. permisos `requireCardOperator`

### Fase 2 — App tecnico core

1. login
2. biometria
3. maquinas
4. stock
5. pendientes

### Fase 3 — NFC tecnico

1. escaneo de tag
2. lookup de UID
3. asignacion
4. reemplazo
5. reasignacion

---

## 12. Recomendacion final

La decision recomendada hoy es:

- mantener la PWA tecnico actual como prototipo funcional o herramienta secundaria
- construir la **app tecnico Android nativa** como producto final de campo
- dejar la app gerente para una etapa separada, posiblemente como PWA

En resumen:

- **PWA**: buena para validar UX y operacion liviana
- **Android nativa**: correcta para tecnico con NFC real + biometria
