// src/middleware/machineAuth.js
// v2: autenticación por MAC address en lugar de secret
// El ESP8266 manda su MAC en el header X-Machine-Mac

const pool = require('../db/pool');

async function machineAuth(req, res, next) {
    const mac = req.headers['x-machine-mac'];

    if (!mac) {
        return res.status(401).json({ error: 'Header X-Machine-Mac requerido' });
    }

    const macClean = mac.toUpperCase().replace(/[^A-F0-9]/g, '');

    try {
        // Buscar la máquina aprobada por MAC
        const result = await pool.query(
            `SELECT id, name, blocked, blocked_reason
             FROM machines
             WHERE mac = $1 AND active = true`,
            [macClean]
        );

        if (result.rowCount === 0) {
            // MAC desconocida — puede ser nueva o pendiente
            // El endpoint /register se encarga de crearla
            return res.status(401).json({
                error:  'Máquina no registrada',
                reason: 'unknown_mac',
                mac:    macClean
            });
        }

        const machine = result.rows[0];

        if (machine.blocked) {
            console.log(`[AUTH] Máquina bloqueada: ${machine.name} (${macClean})`);
            return res.status(403).json({
                error:  'Máquina bloqueada',
                reason: machine.blocked_reason || 'blocked'
            });
        }

        // Actualizar last_seen
        pool.query(
            'UPDATE machines SET last_seen = NOW() WHERE id = $1',
            [machine.id]
        ).catch(() => {});

        req.machine = machine;
        next();

    } catch (err) {
        console.error('[AUTH] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
}

module.exports = machineAuth;
