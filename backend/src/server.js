require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express  = require('express');
const http     = require('http');
const path     = require('path');
const { initWebSocket } = require('./ws');
const { startAlertMonitor } = require('./services/alerts');

const machineAuth  = require('./middleware/machineAuth');
const authJwt      = require('./middleware/authJwt');
const resolveTenantFromHost = require('./middleware/resolveTenantFromHost');
const checkRegistrationSecret = require('./middleware/checkRegistrationSecret');
const authSuperadmin = require('./middleware/authSuperadmin');
const tenantRoutes = require('./routes/tenants');

const authRoutes       = require('./routes/auth');
const publicAuthRoutes = require('./routes/publicAuth');
const mobileAuthRoutes = require('./routes/mobileAuth');
const tapRoutes        = require('./routes/tap');
const dashboardRoutes  = require('./routes/dashboard');
const employeeRoutes   = require('./routes/employees');
const machineRoutes    = require('./routes/machines');
const machineCommandRoutes = require('./routes/machineCommands');
const firmwareRoutes   = require('./routes/firmware');
const machineFirmwareRoutes = require('./routes/machineFirmware');
const reportRoutes     = require('./routes/reports');
const adminUserRoutes  = require('./routes/adminUsers');
const nfcCardsRoutes   = require('./routes/nfcCards');
const accessLevelsRoutes = require('./routes/accessLevels');
const notificationSettingsRoutes = require('./routes/notificationSettings');
const systemSettingsRoutes = require('./routes/systemSettings');
const auditLogsRoutes = require('./routes/auditLogs');
const mobileTechRoutes = require('./routes/mobileTech');
const alertsRoutes = require('./routes/alerts');

const app = express();
app.use((req, res, next) => {
    const startedAt = Date.now();
    const remoteIp = req.socket?.remoteAddress || '-';
    const remotePort = req.socket?.remotePort || '-';
    const contentLength = req.headers['content-length'] || '0';
    const requestLabel = `${req.method} ${req.originalUrl || req.url}`;

    console.log(`${new Date().toISOString()} [HTTP] START ${requestLabel} from=${remoteIp}:${remotePort} len=${contentLength}`);

    req.on('aborted', () => {
        console.warn(`${new Date().toISOString()} [HTTP] ABORT ${requestLabel} after=${Date.now() - startedAt}ms from=${remoteIp}:${remotePort}`);
    });

    req.on('error', (err) => {
        console.error(`${new Date().toISOString()} [HTTP] REQERR ${requestLabel} after=${Date.now() - startedAt}ms from=${remoteIp}:${remotePort} err=${err.message}`);
    });

    res.on('finish', () => {
        console.log(`${new Date().toISOString()} [HTTP] END ${requestLabel} status=${res.statusCode} after=${Date.now() - startedAt}ms from=${remoteIp}:${remotePort}`);
    });

    res.on('close', () => {
        if (!res.writableEnded) {
            console.warn(`${new Date().toISOString()} [HTTP] CLOSE ${requestLabel} status=${res.statusCode} after=${Date.now() - startedAt}ms from=${remoteIp}:${remotePort}`);
        }
    });

    next();
});

app.use(express.json({ limit: '1mb' }));
app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        console.error(`${new Date().toISOString()} [HTTP] JSONERR ${req.method} ${req.originalUrl || req.url} err=${err.message}`);
        return res.status(400).json({ error: 'JSON inválido' });
    }
    return next(err);
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Machine-Secret, X-Machine-Mac, X-Registration-Secret, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Rutas públicas — requieren resolución de tenant por subdominio
app.use('/api/auth', publicAuthRoutes);
app.use('/api/auth', resolveTenantFromHost, authRoutes);
app.use('/api/mobile-auth', resolveTenantFromHost, mobileAuthRoutes);

// Rutas ESP8266 (secret de máquina)
app.use('/api/tap', machineAuth, tapRoutes);
app.use('/api/machine-control', machineAuth, machineCommandRoutes);
app.use('/api/machine-firmware', machineAuth, machineFirmwareRoutes);

// Rutas del panel (JWT)
app.use('/api/dashboard',   authJwt, dashboardRoutes);
app.use('/api/employees',   authJwt, employeeRoutes);
// POST /api/machines/register — ruta pública (solo secret, sin JWT ni MAC)
// resolveTenantFromHost corre solo acá, no en el resto de /api/machines
app.post('/api/machines/register', resolveTenantFromHost, checkRegistrationSecret, machineRoutes.registerHandler);

// El resto de /api/machines requiere JWT, sin resolveTenantFromHost
app.use('/api/machines', authJwt, machineRoutes);

app.use('/api/reports',     authJwt, reportRoutes);
app.use('/api/admin-users', authJwt, adminUserRoutes);
app.use('/api/nfc-cards',   authJwt, nfcCardsRoutes);
app.use('/api/access-levels', authJwt, accessLevelsRoutes);
app.use('/api/notification-settings', authJwt, notificationSettingsRoutes);
app.use('/api/system-settings', authJwt, systemSettingsRoutes);
app.use('/api/audit-logs', authJwt, auditLogsRoutes);
app.use('/api/mobile-tech', authJwt, mobileTechRoutes);
app.use('/api/alerts', authJwt, alertsRoutes);
app.use('/api/firmware', authJwt, firmwareRoutes);
app.use('/api/superadmin/tenants', authSuperadmin, tenantRoutes);

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
server.on('clientError', (err, socket) => {
    console.error(`${new Date().toISOString()} [HTTP] CLIENTERR err=${err.message}`);
    if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
});
initWebSocket(server);
server.listen(PORT, '0.0.0.0', () => {
    if (process.env.DISABLE_ALERT_MONITOR !== 'true') {
        startAlertMonitor();
    }
    console.log(`\n CoffeeControl v2 en http://localhost:${PORT}`);
    console.log(` Red local:    http://192.168.1.76:${PORT}`);
    console.log(` Panel admin:  http://localhost:${PORT}/`);
    console.log(` Monitor op:   http://localhost:${PORT}/coffeecontrol.html`);
    console.log(` Demo:         http://localhost:${PORT}/demo.html`);
    console.log(` Credenciales seed: admin / coffeecontrol | supervisor1 / coffeecontrol2024\n`);
});
