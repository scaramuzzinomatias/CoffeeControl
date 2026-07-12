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

### Group A — RLS Active (8 tables)

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

> Nota: `access_levels`/`firmware_releases`/`machine_commands`/`nfc_cards`/`taps` tenían 100% de su acceso ya vía `req.db` desde antes de esta ronda de migración. `system_settings`, `notification_settings` y `alert_events` se migraron explícitamente de `pool.query` a `withTenantContext` como parte de esta migración, y recién después se activó RLS ahí.

### Group B — RLS Policies Exist (v34) but NOT Enabled (8 tables)

| Table | Files with `pool.query` | pool.query count | Priority |
|-------|------------------------|-----------------|----------|
| `employees` | `services/alerts.js` | 1 | 1 |
| `admin_user_departments` | `lib/accessScope.js`, `services/alerts.js` | 2 | 2 |
| `audit_logs` | `services/audit.js`, `routes/machines.js` | 3 | 3 |
| `stock_movements` | `services/stock.js`, `routes/reports.js` | 10 | 4 |
| `machine_stock_items` | `services/stock.js`, `routes/reports.js` | 12 | 4 |
| `mobile_sessions` | `lib/authTokens.js` | 4 | 5 |
| `admin_users` | 6 files | 3 + 2 bootstrap | 6 |
| `machines` | 10 files | 1 + 5 bootstrap | 6 |

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

## Commits (chronological on master)
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
| `backend/src/services/alerts.js` | `notification_settings` + `alert_events` migrated to `withTenantContext`. Still has `pool.query` for `employees` (~line 472) and `admin_user_departments` (~line 490) |
| `backend/src/services/audit.js` | Uses `pool.query` — pending migration |
| `backend/src/services/stock.js` | Uses `pool.query` + `pool.connect()` — pending migration |
| `backend/src/lib/authTokens.js` | Uses `pool.query` — pending migration (auth path) |
| `backend/src/lib/accessScope.js` | Uses `pool` fallback — pending migration |
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

## Next Steps (Priority Order)

1. `employees` — migrate 1 `pool.query` in `services/alerts.js` (~line 472) to `withTenantContext`
2. `admin_user_departments` — migrate `services/alerts.js` (~line 490) and `lib/accessScope.js`
3. `audit_logs` — migrate `services/audit.js` (2 queries) + `routes/machines.js` helper
4. `stock_movements` + `machine_stock_items` — refactor `services/stock.js` transactions (highest query count, most complex)
5. `mobile_sessions` — refactor `lib/authTokens.js` (auth critical path — extra care needed)
6. `admin_users` + `machines` — bootstrapPool access requires architectural consideration