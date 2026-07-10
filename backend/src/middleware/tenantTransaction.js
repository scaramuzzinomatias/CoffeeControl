const pool = require('../db/pool');

async function beginTenantTransaction(req, res, tenantId) {
    if (req.db) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'SELECT set_config(\'app.tenant_id\', $1, true)',
            [tenantId]
        );
        req.db = client;

        let done = false;

        function finish(success) {
            if (done) return;
            done = true;
            const action = success ? 'COMMIT' : 'ROLLBACK';
            client.query(action).finally(() => client.release()).catch(() => {});
        }

        res.on('finish', () => finish(res.statusCode >= 200 && res.statusCode < 400));
        res.on('close', () => {
            if (!res.writableEnded) {
                finish(false);
            }
        });

        return client;
    } catch (err) {
        await client.release();
        throw err;
    }
}

module.exports = { beginTenantTransaction };
