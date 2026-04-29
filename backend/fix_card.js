require('dotenv').config();
const pool = require('./src/db/pool');

async function main() {
    const r = await pool.query(
        "UPDATE nfc_cards SET active=false WHERE uid='6AEBB01A'"
    );
    console.log('Filas afectadas:', r.rowCount);
    await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
