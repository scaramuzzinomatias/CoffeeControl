const pool = require('./pool');

async function withTenantContext(tenantId, callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'SELECT set_config(\'app.tenant_id\', $1, true)',
            [String(tenantId)]
        );
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { withTenantContext };
