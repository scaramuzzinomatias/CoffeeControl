# Fase 1 — Checklist de verificación manual

## 1. Creación de roles

```bash
# Conectarse como superusuario y ejecutar:
psql -U postgres -d coffeecontrol -f backend/sql/roles_setup.sql

# Verificar que los 3 roles existen:
psql -U postgres -d coffeecontrol -c "\du coffeecontrol_*"
```

**Esperado**: 3 roles listados: `coffeecontrol_owner`, `coffeecontrol_app`, `coffeecontrol_bootstrap`. El último con atributo `BypassRLS`.

---

## 2. Configurar .env

Copiar `.env.example` a `.env` (o modificar el existente). Las 3 connection strings deben apuntar a la misma base con usuarios distintos:

```env
DATABASE_URL=postgresql://coffeecontrol_app:password@127.0.0.1:5432/coffeecontrol
DATABASE_URL_BOOTSTRAP=postgresql://coffeecontrol_bootstrap:password@127.0.0.1:5432/coffeecontrol
DATABASE_URL_OWNER=postgresql://coffeecontrol_owner:password@127.0.0.1:5432/coffeecontrol
```

---

## 3. Ejecutar la migración v31

```bash
# Como coffeecontrol_owner (necesita ser owner para ALTER TABLE):
psql $DATABASE_URL_OWNER -f backend/sql/migration_v31.sql
```

**Verificar tabla tenants**:
```bash
psql $DATABASE_URL_OWNER -c "SELECT id, slug, name, active FROM tenants;"
```
**Esperado**: 1 fila: `1 | legacy | Migración Legacy | t`

**Verificar schema_migrations**:
```bash
psql $DATABASE_URL_OWNER -c "SELECT version, filename FROM schema_migrations WHERE version = 31;"
```
**Esperado**: 1 fila: `31 | migration_v31.sql`

**Verificar tenant_id en tablas** (muestra aleatoria):
```bash
psql $DATABASE_URL_OWNER -c "SELECT id, name, tenant_id FROM employees LIMIT 3;"
psql $DATABASE_URL_OWNER -c "SELECT id, name, tenant_id FROM machines LIMIT 3;"
psql $DATABASE_URL_OWNER -c "SELECT id, username, tenant_id FROM admin_users LIMIT 3;"
```
**Esperado**: todas las filas existentes tienen `tenant_id = 1`.

**Verificar vistas**:
```bash
psql $DATABASE_URL_OWNER -c "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name IN ('machine_status', 'daily_consumption', 'monthly_summary', 'employee_machine_consumption');"
```
**Esperado**: 4 vistas listadas.

**Verificar que tenant_id está en las vistas**:
```bash
psql $DATABASE_URL_OWNER -c "\d+ machine_status"
```
**Esperado**: la columna `tenant_id` aparece en la definición.

---

## 4. Verificar conexión como coffeecontrol_app

```bash
# La app debe poder conectarse como coffeecontrol_app
psql $DATABASE_URL -c "SELECT current_user;"
```
**Esperado**: `coffeecontrol_app`

```bash
# Debe poder leer datos existentes
psql $DATABASE_URL -c "SELECT count(*) FROM employees;"
psql $DATABASE_URL -c "SELECT count(*) FROM machines;"
```
**Esperado**: mismos conteos que con el owner.

```bash
# Debe poder leer las vistas
psql $DATABASE_URL -c "SELECT count(*) FROM machine_status;"
```
**Esperado**: sin error (puede devolver 0 filas si no hay datos, pero NO debe tirar error).

---

> **Nota**: Los roles se crean sin password. Después de roles_setup.sql, asignar contraseñas:
> ```sql
> ALTER ROLE coffeecontrol_owner WITH PASSWORD 'cambiar_password_owner';
> ALTER ROLE coffeecontrol_app WITH PASSWORD 'cambiar_password_app';
> ALTER ROLE coffeecontrol_bootstrap WITH PASSWORD 'cambiar_password_bootstrap';
> ```

## 5. Verificar conexión como coffeecontrol_bootstrap

```bash
psql $DATABASE_URL_BOOTSTRAP -c "SELECT current_user;"
```
**Esperado**: `coffeecontrol_bootstrap`

```bash
# Debe poder leer las columnas autorizadas
psql $DATABASE_URL_BOOTSTRAP -c "SELECT id, username, tenant_id FROM admin_users LIMIT 1;"
```
**Esperado**: fila del admin.

```bash
# NO debe poder leer columnas NO autorizadas
psql $DATABASE_URL_BOOTSTRAP -c "SELECT id, full_name FROM admin_users LIMIT 1;"
```
**Esperado**: ERROR: permission denied for column full_name.

```bash
# Debe poder leer columnas de tenants (resolveTenantFromHost usa slug, active)
psql $DATABASE_URL_BOOTSTRAP -c "SELECT id, slug, active FROM tenants;"
```
**Esperado**: 1 fila: `1 | legacy | t`.

```bash
# Debe poder leer mac y active en machines (machineAuth usa WHERE mac = $1 AND active = true)
psql $DATABASE_URL_BOOTSTRAP -c "SELECT id, mac, active, tenant_id FROM machines LIMIT 1;"
```
**Esperado**: sin error (puede devolver 0 filas).

---

## 6. Iniciar el servidor y probar login

```bash
# Iniciar server con las nuevas variables de entorno
node backend/src/server.js
```

**Probar login exitoso** (panel):
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Host: legacy.localhost:3000' \
  -d '{"username":"admin","password":"coffeecontrol"}'
```
**Esperado**: HTTP 200 con `{ "token": "...", "role": "admin", ... }`. El token debe incluir `tenant_id` en el payload (verificable decodificando con https://jwt.io).

**Probar login con credenciales incorrectas**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Host: legacy.localhost:3000' \
  -d '{"username":"admin","password":"wrong"}'
```
**Esperado**: HTTP 401.

---

## 7. Probar autenticación de máquina (ESP)

```bash
# Usar una MAC de las semillas (ninguna existe en la BD limpia,
# pero después de correr schema.sql + migrations hay machines
# sin MAC — la seed de schema.sql no tiene MAC)
# Primero registrar una máquina:
curl -X POST http://localhost:3000/api/machines/register \
  -H 'Content-Type: application/json' \
  -H 'X-Registration-Secret: coffeecontrol-registro-2024' \
  -H 'Host: legacy.localhost:3000' \
  -d '{"mac":"AA BB CC DD EE FF"}'
```
**Esperado**: `{ "status": "pending" }` (pasa a pending_machines porque no hay máquina aprobada con esa MAC).

```bash
# Aprobar la máquina pendiente (requiere authJwt):
# Primero obtener token de admin (ver paso 6)
TOKEN="<token del paso 6>"
# NOTA: el ID de la pending_machine es dinámico (secuencia).
# Consultar con: psql $DATABASE_URL_OWNER -c "SELECT id, mac FROM pending_machines WHERE approved = false ORDER BY id DESC LIMIT 1"
PENDING_ID=65  # <- reemplazar con el ID real
curl -X POST http://localhost:3000/api/machines/pending/$PENDING_ID/approve \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Host: legacy.localhost:3000' \
  -d '{"name":"Máquina Test","location":"Oficina","price_cents":1200}'
```
**Esperado**: HTTP 201.

```bash
# Ahora autenticar la máquina (machineAuth):
# NOTA: la ruta es POST /api/tap/ (sin "pour")
curl -X POST http://localhost:3000/api/tap/ \
  -H 'Content-Type: application/json' \
  -H 'X-Machine-Mac: AABBCCDDEEFF' \
  -H 'Host: legacy.localhost:3000' \
  -d '{"nfc_uid":"0000000000"}'
```
**Esperado**: HTTP 200/401 (la máquina existe y está activa → 401 "Tarjeta no registrada"). Si devuelve 401 "Header X-Machine-Mac requerido", el middleware machineAuth no está funcionando.

---

## 8. Probar change-password (ruta protegida por authJwt con req.db)

```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Host: legacy.localhost:3000' \
  -d '{"current_password":"coffeecontrol","new_password":"nuevaClaveSegura123"}'
```
**Esperado**: HTTP 200. (Restaurar contraseña después de la prueba.)

---

## 9. Probar ruta JWT sin token

```bash
curl http://localhost:3000/api/employees \
  -H 'Host: legacy.localhost:3000'
```
**Esperado**: HTTP 401.

---

## 10. Confirmar que no hay regresiones

Después de las pruebas anteriores, confirmar que:

- [ ] Las rutas públicas (`/api/auth/login`, `/api/mobile-auth/login`, `/api/machines/register`, `/health`) funcionan sin token JWT ni MAC.
- [ ] Las rutas protegidas con `authJwt` (`/api/employees`, `/api/machines`, `/api/reports`, etc.) rechazan requests sin token con 401.
- [ ] Las rutas protegidas con `machineAuth` (`/api/tap/*`) rechazan requests sin MAC con 401.
- [ ] La respuesta del login incluye `tenant_id` en el JWT.
- [ ] La migración v31 está registrada en `schema_migrations`.
- [ ] Los 3 roles existen y tienen los permisos correctos.
- [ ] El servidor arranca sin errores.
- [ ] Los logs no muestran errores de conexión a la base.

## Notas

- En esta fase RLS **no está activo** en ninguna tabla. El comportamiento debe ser **idéntico** al anterior: ninguna query debería fallar por falta de `SET LOCAL app.tenant_id`.
- Si alguna ruta falla con `ERROR: unrecognized configuration parameter "app.tenant_id"`, es porque la vista o ruta está usando `current_setting` sin `missing_ok`. Revisar que ninguna vista de la Fase 1 incluya ese filtro (las vistas solo exponen `tenant_id` como columna, no filtran por él).
- Los únicos archivos con `bootstrapPool` importado deben ser: `routes/auth.js`, `lib/authTokens.js`, `middleware/machineAuth.js`, y `routes/machines.js` (register). Verificar con `grep -r "bootstrapPool" src/ --include="*.js"`.
- **IMPORTANTE**: En PostgreSQL, los `GRANT ... (col1, col2) ON TABLE` afectan también a las columnas usadas en la cláusula `WHERE`, no solo en la lista `SELECT`. Verificar que toda columna usada en `WHERE` de consultas `bootstrapPool` esté incluida en los GRANTs correspondientes.
- **Ruta correcta**: `POST /api/tap/` (no `/api/tap/pour`). No hay ruta `GET /api/auth/me` en el backend.
- **Login sin Host**: Si el header `Host` no coincide con ningún tenant slug, devuelve 404 `{"error": "Tenant no encontrado", "slug": "..."}`.
