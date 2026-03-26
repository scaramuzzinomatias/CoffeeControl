const { withPool, readSqlFile } = require('./_lib');

async function main() {
    await withPool(async (pool) => {
        const sql = readSqlFile('schema.sql');
        await pool.query(sql);
    });
    console.log('Schema actual aplicado correctamente desde backend/sql/schema.sql');
}

main().catch((err) => {
    console.error('[db:init] Error:', err.message);
    process.exit(1);
});
