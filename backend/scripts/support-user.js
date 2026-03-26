const bcrypt = require('bcryptjs');
const {
    withPool,
    normalizeDepartmentList
} = require('./_lib');

const BOOLEAN_FLAGS = new Set(['activate', 'help', 'h']);

function parseCli(argv) {
    const args = {};
    const positional = [];

    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || '');
        if (!token.startsWith('--')) {
            positional.push(token);
            continue;
        }

        const stripped = token.slice(2);
        const eqIndex = stripped.indexOf('=');
        if (eqIndex >= 0) {
            args[stripped.slice(0, eqIndex)] = stripped.slice(eqIndex + 1);
            continue;
        }

        if (BOOLEAN_FLAGS.has(stripped)) {
            args[stripped] = true;
            continue;
        }

        const next = argv[i + 1];
        if (next && !String(next).startsWith('--')) {
            args[stripped] = String(next);
            i += 1;
        } else {
            args[stripped] = true;
        }
    }

    return { args, positional };
}

function usage() {
    console.log([
        'Uso:',
        '  node scripts/support-user.js --username admin --password nuevaClave --role admin',
        '  node scripts/support-user.js --username sup.ventas --password coffeecontrol2024 --role supervisor --full-name "Supervisor Ventas" --email sup@empresa.com --departments "Ventas,RRHH"',
        '  node scripts/support-user.js --username tecnico.1 --password coffeecontrol2024 --role tecnico --full-name "Técnico de campo"',
        '',
        'Parámetros:',
        '  --username      requerido',
        '  --password      requerido',
        '  --role          admin | gerente | supervisor | tecnico',
        '  --full-name     opcional',
        '  --email         opcional',
        '  --departments   áreas separadas por coma, punto y coma o salto de línea',
        '  --activate      fuerza active=true'
    ].join('\n'));
}

async function syncScopes(client, userId, scopes) {
    await client.query('DELETE FROM admin_user_departments WHERE admin_user_id = $1', [userId]);
    if (!scopes.length) return;

    const values = [];
    const params = [];
    scopes.forEach((department, index) => {
        const base = index * 2;
        params.push(userId, department);
        values.push(`($${base + 1}, $${base + 2})`);
    });

    await client.query(
        `INSERT INTO admin_user_departments (admin_user_id, department)
         VALUES ${values.join(', ')}`,
        params
    );
}

async function main() {
    const argv = process.argv.slice(2);
    const { args, positional } = parseCli(argv);
    if (args.help || args.h) {
        usage();
        return;
    }

    const username = String(args.username || positional[0] || '').trim().toLowerCase();
    const passwordFallback = args.username && !args.password
        ? positional[0]
        : positional[1];
    const password = String(args.password || passwordFallback || '');
    const role = String(args.role || positional[2] || 'admin').trim().toLowerCase();
    const fullNameRaw = args['full-name'] ?? positional[3];
    const emailRaw = args.email ?? positional[4];
    const departmentsRaw = args.departments ?? positional[5] ?? '';
    const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : null;
    const email = typeof emailRaw === 'string' ? emailRaw.trim() : null;
    const active = args.activate ? true : null;

    if (!username || !password) {
        usage();
        throw new Error('username y password son requeridos');
    }
    if (!['admin', 'gerente', 'supervisor', 'tecnico'].includes(role)) {
        throw new Error('role inválido. Usá admin, gerente, supervisor o tecnico');
    }
    if (password.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    const scopes = role === 'supervisor'
        ? normalizeDepartmentList(departmentsRaw)
        : [];
    const legacyDepartment = role === 'supervisor'
        ? (scopes[0] || null)
        : null;
    const passwordHash = await bcrypt.hash(password, 10);

    await withPool(async (pool) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const existing = await client.query(
                `SELECT id, username
                 FROM admin_users
                 WHERE username = $1`,
                [username]
            );

            let userId;
            if (existing.rowCount > 0) {
                userId = existing.rows[0].id;
                await client.query(
                    `UPDATE admin_users
                     SET password_hash = $1,
                         role = $2,
                         full_name = COALESCE($3, full_name),
                         department = $4,
                         email = COALESCE($5, email),
                         active = COALESCE($6, active)
                     WHERE id = $7`,
                    [
                        passwordHash,
                        role,
                        fullName,
                        legacyDepartment,
                        email,
                        active,
                        userId
                    ]
                );
            } else {
                const inserted = await client.query(
                    `INSERT INTO admin_users (username, password_hash, role, full_name, department, email, active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING id`,
                    [
                        username,
                        passwordHash,
                        role,
                        fullName,
                        legacyDepartment,
                        email,
                        active === null ? true : active
                    ]
                );
                userId = inserted.rows[0].id;
            }

            await syncScopes(client, userId, scopes);
            await client.query('COMMIT');

            console.log(JSON.stringify({
                ok: true,
                username,
                role,
                department_scopes: scopes,
                created: existing.rowCount === 0
            }));
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw err;
        } finally {
            client.release();
        }
    });
}

main().catch((err) => {
    console.error('[support:user] Error:', err.message);
    process.exit(1);
});
