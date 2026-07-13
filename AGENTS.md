# CoffeeControl — Multi-Tenant RLS Migration

## Architecture

### PostgreSQL Roles

| Role | Env var | RLS | Purpose |
|------|---------|-----|---------|
| `coffeecontrol_owner` | `DATABASE_URL_OWNER` | Bypass (table owner) | DDL, migrations, fixture cleanup |
| `coffeecontrol_app` | `DATABASE_URL` | **Subject to RLS** | Express runtime |
| `coffeecontrol_bootstrap` | `DATABASE_URL_BOOTSTRAP` | Bypass (`BYPASSRLS`) | Login, machine registration, alert monitor |

### Tenant Context Mechanisms

- **`beginTenantTransaction(req, res, tenantId)`** (`src/middleware/tenantContext.js`): grabs a dedicated pool client, runs `SET app.tenant_id = $1`, assigns to `req.db`. Auto-commits on 2xx, rollbacks otherwise. Used in HTTP route handlers.
- **`withTenantContext(tenantId, callback)`** (`src/db/tenantContext.js`): pool.connect() → BEGIN → SET app.tenant_id → callback(client) → COMMIT → release. Used in services outside HTTP lifecycle.

### Isolation Strategy

- Tables with **100% access via `req.db` or `withTenantContext`** → **RLS enabled** (policy uses `current_setting('app.tenant_id')`)
- Tables with **any `pool.query` access** → **RLS disabled**, isolated by explicit `WHERE tenant_id = $1` filters (verified by cross-tenant tests)
- `bootstrapPool` operates outside RLS by design (login, machine MAC lookup, cross-tenant monitor)

### Migration Methodology (per table)

1. Migrate `pool.query(...)` → `withTenantContext(tenantId, client => client.query(...))`
2. Review diff (no unrelated changes)
3. Run full test suite (must pass)
4. Commit code migration
5. Create migration SQL with `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
6. Apply migration, verify `relrowsecurity = true`
7. Run full test suite again
8. Commit RLS activation
9. Move to next table

---

## Inventory: 16 Tenant-Scoped Tables

### Group A — RLS Active (11 tables)

| Table | Enabled By | Access Pattern | Notes |
|-------|-----------|----------------|-------|
| `access_levels` | v32 | `req.db` | |
| `firmware_releases` | v33 | `req.db` + `bootstrapPool` (register) | bootstrapPool reads bypass RLS |
| `machine_commands` | v33 | `req.db` + `bootstrapPool` (register) | bootstrapPool reads bypass RLS |
| `nfc_cards` | v33 | `req.db` (via `db` param) | |
| `taps` | v33 | `req.db` | |
| `system_settings` | v35 | `withTenantContext` | **Pilot table** — first withTenantContext migration |
| `notification_settings` | v36 | `withTenantContext` | |
| `alert_events` | v37 | `withTenantContext` | 5 queries migrated (openAlert, resolveAlert, markAlertNotified) |
| `employees` | v38 | `withTenantContext` | 2 queries migrated (loadEmployeeWarningRecipients) |
| `admin_user_departments` | v39 | `req.db` | Ya 100% vía req.db antes de activar RLS |
| `audit_logs` | v40 | `withTenantContext` | 3 queries migrated (logAuditEvent, getAuditLogs, getLastMachineTechnicalAudit) |

> Nota: `access_levels`/`firmware_releases`/`machine_commands`/`nfc_cards`/`taps` tenían 100% de su acceso ya vía `req.db` desde antes de esta ronda de migración. `system_settings`, `notification_settings`, `alert_events`, `employees` y `audit_logs` se migraron explícitamente de `pool.query` a `withTenantContext` como parte de esta migración, y recién después se activó RLS ahí. `admin_user_departments` ya tenía 100% de acceso vía `req.db` (sin `pool.query`).

### Group B — RLS Policies Exist (v34) but NOT Enabled (5 tables)

| Table | Files with `pool.query` | pool.query count | Priority |
|-------|------------------------|-----------------|----------|
| `stock_movements` | `services/stock.js`, `routes/reports.js` | 10 | 1 |
| `machine_stock_items` | `services/stock.js`, `routes/reports.js` | 12 | 1 |
| `mobile_sessions` | `lib/authTokens.js` | 4 | 2 |
| `admin_users` | 6 files | 3 + 2 bootstrap | 3 |
| `machines` | 10 files | 1 + 5 bootstrap | 3 |

---

## Migration SQL Files

| File | Content |
|------|---------|
| `backend/sql/migration_v32.sql` | RLS policy + composite UNIQUE on `access_levels` |
| `backend/sql/migration_v33.sql` | RLS policy + **ENABLE** for `firmware_releases`, `nfc_cards`, `machine_commands`, `taps` |
| `backend/sql/migration_v34.sql` | RLS policies (no enable) for all 11 Group B tables (original set) |
| `backend/sql/migration_v35.sql` | **ENABLE RLS** on `system_settings` |
| `backend/sql/migration_v36.sql` | **ENABLE RLS** on `notification_settings` |
| `backend/sql/migration_v37.sql` | **ENABLE RLS** on `alert_events` |
| `backend/sql/migration_v38.sql` | **ENABLE RLS** on `employees` |
| `backend/sql/migration_v39.sql` | **ENABLE RLS** on `admin_user_departments` |
| `backend/sql/migration_v40.sql` | **ENABLE RLS** on `audit_logs` |

## Commits (chronological on master)
824ac56 feat: activa RLS en audit_logs
2fce942 feat: migra audit_logs a withTenantContext
4144e3f feat: activa RLS en admin_user_departments
9c86086 feat: activa RLS en employees
2c5e4c3 feat: migra loadEmployeeWarningRecipients a withTenantContext
697c5d7 docs: agrega AGENTS.md con inventario completo de la migracion RLS
8c73bac feat: activa RLS en alert_events
064119e feat: migra alert_events a withTenantContext
c95f552 RLS Grupo B: enable RLS on notification_settings
328d493 RLS Grupo B: agregar withTenantContext y migrar systemSettings
bd19d41 test: agrega cobertura de aislamiento cross-tenant para notification_settings
04577ea test: agrega cobertura de aislamiento cross-tenant para mobile_sessions
d34ca69 test: agrega cobertura de aislamiento cross-tenant para admin_users y admin_user_departments
be2ad56 feat: cierra el frente de RLS — políticas creadas en 11 tablas
7047f11 feat: activa RLS en firmware_releases, nfc_cards, machine_commands, taps

## Key Files

| File | Role |
|------|------|
| `backend/src/db/tenantContext.js` | `withTenantContext(tenantId, callback)` helper |
| `backend/src/middleware/tenantContext.js` | `beginTenantTransaction(req, res, tenantId)` |
| `backend/src/services/systemSettings.js` | Migrated to `withTenantContext` (pilot) |
| `backend/src/services/alerts.js` | `notification_settings` + `alert_events` + `employees` migrated to `withTenantContext`. Zero `pool.query`/`pool.connect` calls remain |
| `backend/src/services/audit.js` | Migrated to `withTenantContext` — 3 queries (logAuditEvent, getAuditLogs, getLastMachineTechnicalAudit) |
| `backend/src/services/stock.js` | Uses `pool.query` + `pool.connect()` — pending migration |
| `backend/src/lib/authTokens.js` | Uses `pool.query` — pending migration (auth path) |
| `backend/src/lib/accessScope.js` | No migration needed — `getUserDepartmentScopes` receives `client` from both callers |
| `backend/test/integration.test.js` | 41 tests including 5 cross-tenant isolation tests |

## Cross-Tenant Tests

1. `audit_logs multi-tenant aislamiento cross-tenant`
2. `admin_users lista no filtra usuarios entre tenants`
3. `admin_user_departments no filtra scopes de departamento entre tenants`
4. `mobile_sessions: refresh_token de tenant B no funciona en tenant A`
5. `notification_settings: preferencias no se filtran entre tenants`

Helpers: `createTenantBWithAdmin(labelSuffix)`, `httpRequestWithHost(method, path, hostHeader, body, token)`.

## Running Tests

```bash
cd backend
node --test test/integration.test.js
```

Expected: 41 pass, 0 fail.

## Applying Migrations

Migrations that require table ownership (ENABLE RLS, CREATE POLICY) must be applied as `coffeecontrol_owner`:

```bash
cd backend
node -e "
async function main() {
  const { Client } = require('pg');
  const fs = require('fs');
  require('dotenv').config();
  const sql = fs.readFileSync('sql/migration_v<N>.sql', 'utf8');
  const c = new Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await c.connect(); await c.query(sql); await c.end();
  console.log('OK');
}
main().catch(e => { console.error(e.message); process.exit(1); });
"
```

Verify RLS status:
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = '<table_name>';
```

## Completed

- `system_settings` (v35) — pilot `withTenantContext` migration.
- `notification_settings` (v36) — second `withTenantContext` migration.
- `alert_events` (v37) — 5 queries (`openAlert`, `resolveAlert`, `markAlertNotified`) migrated to `withTenantContext`, RLS activo.
- `employees` (v38) — 2 queries (`loadEmployeeWarningRecipients`) migrated to `withTenantContext`, RLS activo.
- `admin_user_departments` (v39) — RLS activo (ya 100% vía req.db).
- `audit_logs` (v40) — 3 queries (`logAuditEvent`, `getAuditLogs`, `getLastMachineTechnicalAudit`) migrated, RLS activo.

## Next Steps (Priority Order)

1. `stock_movements` + `machine_stock_items` — refactor `services/stock.js` transactions (highest query count, most complex)
2. `mobile_sessions` — refactor `lib/authTokens.js` (auth critical path — extra care needed)
3. `admin_users` + `machines` — bootstrapPool access requires architectural consideration