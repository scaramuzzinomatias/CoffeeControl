# Runbook de Backup y Restore por Cliente

Documento operativo para instalaciones reales de CoffeeControl en su modelo actual:

- una empresa por backend
- una base por empresa
- un set de credenciales por empresa

## 1. Regla base

Hoy CoffeeControl no se opera como SaaS multiempresa dentro de una misma base.

La regla recomendada es:

- `McCain` -> backend propio + base propia
- `PepsiCo` -> backend propio + base propia

Esto simplifica:

- aislamiento de datos
- soporte
- restore
- rollback
- troubleshooting

## 2. Qué genera un backup

El comando:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
npm run db:backup
```

genera:

- el archivo de backup (`.sql` o `.dump`)
- un archivo de metadata al lado:
  - `*.meta.json`

La metadata guarda, como mínimo:

- fecha/hora de generación
- base origen
- host origen
- formato
- tamaño
- commit corto del repo, si está disponible

Esto sirve para no restaurar un backup de un cliente sobre otro por error.

## 3. Dónde conviene guardar los backups

Por defecto:

- `C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backups\db\`

Para operación real conviene además:

- copiar el backup fuera del servidor local
- o sincronizarlo a almacenamiento externo seguro

Ejemplo por cliente:

- `D:\Backups\CoffeeControl\mccain\`
- `D:\Backups\CoffeeControl\pepsico\`

## 4. Política operativa recomendada

### Backup

- diario como mínimo
- antes de:
  - migraciones
  - cambios grandes de configuración
  - limpiezas operativas
  - restores de prueba

### Restore

- solo sobre la base correcta
- usando `--dry-run` primero
- usando `--recreate` solo cuando se quiere reconstruir la base completa

## 5. Flujo recomendado de backup

### Backup simple

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
npm run db:backup
```

### Backup custom

```powershell
node scripts/db-backup.js --format custom
```

### Backup a carpeta externa

```powershell
node scripts/db-backup.js --dir D:\Backups\CoffeeControl\mccain
```

## 6. Flujo recomendado de restore

### Verificación previa

```powershell
node scripts/db-restore.js --input D:\Backups\CoffeeControl\mccain\coffeecontrol_mccain-20260411-120000.sql --dry-run
```

### Restore real

```powershell
node scripts/db-restore.js --input D:\Backups\CoffeeControl\mccain\coffeecontrol_mccain-20260411-120000.sql --yes
```

### Restore recreando base

```powershell
node scripts/db-restore.js --input D:\Backups\CoffeeControl\mccain\coffeecontrol_mccain-20260411-120000.dump --format custom --recreate --confirm coffeecontrol_mccain --yes
```

## 7. Protección contra restore cruzado

Si existe `*.meta.json`, `db:restore` valida la base origen del backup contra la base destino configurada en `DATABASE_URL`.

Si no coinciden:

- el restore se frena
- salvo que se fuerce explícitamente con:

```powershell
--allow-other-db
```

Esto está pensado solo para casos excepcionales y controlados.

## 8. Soporte y diagnóstico

Antes de operar en producción, conviene correr:

```powershell
npm run support:doctor
```

Ahora ese chequeo también informa:

- si existen `pg_dump`, `psql`, `pg_restore`
- cuál es el backup más reciente
- si ese backup tiene metadata

## 9. Recomendación para varias empresas

Hoy la recomendación sigue siendo:

- un backend por empresa
- una base por empresa
- un subdominio por empresa

Ejemplo:

- `mccain.coffeecontrol.tudominio.com`
- `pepsico.coffeecontrol.tudominio.com`

No conviene todavía:

- una sola base con varias empresas mezcladas
- un solo dataset compartido entre clientes

## 10. Criterio de operación sana

Una instalación está operativamente bien preparada cuando:

1. tiene backup diario
2. el último backup está identificado con metadata
3. el restore fue probado al menos una vez
4. existe una ruta clara para reconstruir una base por cliente
5. cada cliente está aislado en su propia base/backend
