const pool = require('../db/pool');
const bootstrapPool = require('../db/bootstrapPool');
const { beginTenantTransaction } = require('./tenantTransaction');

async function machineAuth(req, res, next) {
    const mac = req.headers['x-machine-mac'];
    if (!mac) return res.status(401).json({ error: 'Header X-Machine-Mac requerido' });

    const macClean = mac.toUpperCase().replace(/[^A-F0-9]/g, '');

    try {
        const result = await bootstrapPool.query(
            `SELECT id, name, tenant_id, blocked, blocked_reason
             FROM machines
             WHERE mac = $1 AND active = true`,
            [macClean]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                error: 'Máquina no registrada',
                reason: 'unknown_mac',
                mac: macClean
            });
        }

        const machine = result.rows[0];

        if (machine.blocked) {
            console.log(`[AUTH] Máquina bloqueada: ${machine.name} (${macClean})`);
            return res.status(403).json({
                error: 'Máquina bloqueada',
                reason: machine.blocked_reason || 'blocked'
            });
        }

        await beginTenantTransaction(req, res, machine.tenant_id);

        pool.query(
            'UPDATE machines SET last_seen = NOW() WHERE id = $1 AND tenant_id = $2',
            [machine.id, machine.tenant_id]
        ).catch(() => {});

        req.machine = machine;
        next();
    } catch (err) {
        console.error('[AUTH] Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno' });
        }
    }
}

module.exports = machineAuth;
