// src/db/bootstrapPool.js
//
// ╔══════════════════════════════════════════════════════════════╗
// ║  ATENCIÓN: este pool BYPASEA RLS.                          ║
// ║  Úsalo SOLO para queries de "arranque" que necesitan       ║
// ║  descubrir el tenant antes de tener contexto de RLS:       ║
// ║    - routes/auth.js              (login panel)             ║
// ║    - lib/authTokens.js           (getActiveAdminUser...)   ║
// ║    - middleware/machineAuth.js    (lookup de máquina/MAC)  ║
// ║    - routes/machines.js           (POST /register)         ║
// ║                                                            ║
// ║  NO importes bootstrapPool en routes de negocio normales.  ║
// ║  NO uses bootstrapPool para queries sin WHERE tenant_id.   ║
// ╚══════════════════════════════════════════════════════════════╝

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL_BOOTSTRAP,
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('[BOOTSTRAP] Error inesperado:', err.message);
});

module.exports = pool;
