require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express  = require('express');
const http     = require('http');
const path     = require('path');
const { initWebSocket } = require('./ws');

const machineAuth  = require('./middleware/machineAuth');
const authJwt      = require('./middleware/authJwt');

const authRoutes       = require('./routes/auth');
const tapRoutes        = require('./routes/tap');
const dashboardRoutes  = require('./routes/dashboard');
const employeeRoutes   = require('./routes/employees');
const machineRoutes    = require('./routes/machines');
const reportRoutes     = require('./routes/reports');
const adminUserRoutes  = require('./routes/adminUsers');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Machine-Secret, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
app.use((req, res, next) => { console.log(`${new Date().toISOString()} ${req.method} ${req.path}`); next(); });

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas ESP8266 (secret de máquina)
app.use('/api/tap', machineAuth, tapRoutes);

// Rutas del panel (JWT)
app.use('/api/dashboard',   authJwt, dashboardRoutes);
app.use('/api/employees',   authJwt, employeeRoutes);
app.use('/api/machines', (req, res, next) => {
    if (req.method === 'POST' && req.path === '/register') {
        const s = req.headers['x-registration-secret'];
        if (!s || s !== process.env.REGISTRATION_SECRET) {
            return res.status(401).json({ error: 'Secret de registro inválido' });
        }
        return next();
    }
    authJwt(req, res, next);
}, machineRoutes);
app.use('/api/reports',     authJwt, reportRoutes);
app.use('/api/admin-users', authJwt, adminUserRoutes);

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Servir el panel web ───────────────────────────────
// Los archivos HTML están dos niveles arriba de /backend/src/
const publicPath = path.join(__dirname, '../../');
app.use(express.static(publicPath));

// Raíz → redirige al panel de administración
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'coffeecontrol-admin.html'));
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
initWebSocket(server);
server.listen(PORT, () => {
    console.log(`\n CoffeeControl v2 en http://localhost:${PORT}`);
    console.log(` Panel admin:  http://localhost:${PORT}/`);
    console.log(` Dashboard:    http://localhost:${PORT}/coffeecontrol.html`);
    console.log(` Demo:         http://localhost:${PORT}/demo.html`);
    console.log(` Credenciales: admin / coffeecontrol2024\n`);
});