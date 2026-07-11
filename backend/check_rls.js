const { createPool } = require('./scripts/_lib');
const p = createPool();
p.query("SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relrowsecurity = true")
  .then(r => { console.log(r.rows); p.end(); });
