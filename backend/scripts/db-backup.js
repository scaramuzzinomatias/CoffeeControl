const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    projectRoot,
    ensureDir,
    parseArgs,
    parseDatabaseUrl,
    formatTimestamp,
    findPostgresExecutable
} = require('./_lib');

function usage() {
    console.log(`Uso:
  node scripts/db-backup.js [--output archivo] [--dir carpeta] [--format sql|custom] [--schema-only] [--data-only]

Ejemplos:
  npm run db:backup
  node scripts/db-backup.js --format custom
  node scripts/db-backup.js --dir C:\\Backups\\CoffeeControl
  node scripts/db-backup.js --output C:\\Backups\\coffeecontrol-20260326.sql`);
}

function resolveOutputPath({ outputArg, dirArg, format, databaseName }) {
    if (outputArg) {
        return path.resolve(outputArg);
    }
    const baseDir = ensureDir(path.resolve(dirArg || path.join(projectRoot, 'backups', 'db')));
    const ext = format === 'custom' ? 'dump' : 'sql';
    return path.join(baseDir, `${databaseName}-${formatTimestamp()}.${ext}`);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }

    const format = String(args.format || 'sql').trim().toLowerCase();
    if (!['sql', 'custom'].includes(format)) {
        throw new Error('Formato inválido. Usá --format sql o --format custom');
    }
    if (args['schema-only'] && args['data-only']) {
        throw new Error('No podés combinar --schema-only con --data-only');
    }

    const pgDump = findPostgresExecutable('pg_dump');
    if (!pgDump) {
        throw new Error('No se encontró pg_dump. Instalá PostgreSQL o definí PG_BIN apuntando a su carpeta bin');
    }

    const db = parseDatabaseUrl();
    const outputPath = resolveOutputPath({
        outputArg: args.output,
        dirArg: args.dir,
        format,
        databaseName: db.database
    });
    ensureDir(path.dirname(outputPath));

    const dumpArgs = [
        `--dbname=${db.connectionString}`,
        '--no-owner',
        '--no-privileges',
        '--encoding=UTF8',
        `--file=${outputPath}`
    ];

    if (format === 'custom') {
        dumpArgs.push('--format=custom');
    } else {
        dumpArgs.push('--format=plain', '--clean', '--if-exists');
    }
    if (args['schema-only']) dumpArgs.push('--schema-only');
    if (args['data-only']) dumpArgs.push('--data-only');

    console.log(`[db:backup] Base: ${db.database} @ ${db.host}:${db.port}`);
    console.log(`[db:backup] pg_dump: ${pgDump}`);
    console.log(`[db:backup] Salida: ${outputPath}`);

    const result = spawnSync(pgDump, dumpArgs, {
        stdio: 'inherit',
        env: process.env
    });

    if (result.status !== 0) {
        if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
        throw new Error(`pg_dump terminó con código ${result.status}`);
    }

    const stats = fs.statSync(outputPath);
    console.log(`[db:backup] OK — ${(stats.size / 1024).toFixed(1)} KB`);
}

try {
    main();
} catch (err) {
    console.error('[db:backup] Error:', err.message);
    process.exit(1);
}
