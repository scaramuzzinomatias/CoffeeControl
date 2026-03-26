// src/ws.js — WebSocket para actualizaciones en tiempo real al dashboard
// El dashboard se conecta aquí y recibe cada tap al instante

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const {
    isManagerRole,
    canViewAnalytics,
    normalizeDepartmentList,
    departmentsEqual
} = require('./lib/accessScope');

const SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

let wss = null;

function rejectUpgrade(socket, statusCode, message) {
    try {
        socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
    } catch (_) {}
    try {
        socket.destroy();
    } catch (_) {}
}

function extractToken(req) {
    const url = new URL(req.url, 'http://localhost');
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;
    return null;
}

function initWebSocket(server) {
    wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/ws') {
            return rejectUpgrade(socket, 404, 'Not Found');
        }

        const token = extractToken(req);
        if (!token) {
            console.warn('[WS] Handshake rechazado: token ausente');
            return rejectUpgrade(socket, 401, 'Unauthorized');
        }

        let user;
        try {
            user = jwt.verify(token, SECRET);
        } catch (err) {
            console.warn('[WS] Handshake rechazado: token inválido o expirado');
            return rejectUpgrade(socket, 401, 'Unauthorized');
        }

        if (!canViewAnalytics(user?.role)) {
            console.warn(`[WS] Handshake rechazado: rol sin acceso al feed (${user?.role || 'sin rol'})`);
            return rejectUpgrade(socket, 403, 'Forbidden');
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            ws.user = user;
            if (user.exp) {
                const msUntilExpiry = (user.exp * 1000) - Date.now();
                if (msUntilExpiry <= 0) {
                    try { ws.close(4001, 'Token expirado'); } catch (_) {}
                    return;
                }
                ws.authExpiryTimer = setTimeout(() => {
                    try { ws.close(4001, 'Token expirado'); } catch (_) {}
                }, msUntilExpiry);
                if (typeof ws.authExpiryTimer.unref === 'function') ws.authExpiryTimer.unref();
            }
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        const who = ws.user?.username ? `${ws.user.username}/${ws.user.role}` : ip;
        console.log(`[WS] Cliente conectado — ${who} @ ${ip} (total: ${wss.clients.size})`);

        ws.on('close', () => {
            if (ws.authExpiryTimer) clearTimeout(ws.authExpiryTimer);
            console.log(`[WS] Cliente desconectado (total: ${wss.clients.size})`);
        });

        ws.on('error', (err) => {
            console.error('[WS] Error:', err.message);
        });

        // Enviar estado inicial al conectarse
        ws.send(JSON.stringify({
            event: 'connected',
            message: 'CoffeeControl en línea',
            username: ws.user?.username || null,
            role: ws.user?.role || null
        }));
    });

    console.log('[WS] Servidor WebSocket listo en /ws');
}

function canReceiveBroadcast(user, data) {
    if (!canViewAnalytics(user?.role)) return false;
    if (isManagerRole(user?.role)) return true;
    const scopes = normalizeDepartmentList(user?.department_scopes || []);
    if (!scopes.length) return true;
    const eventDepartment = String(data?.department || '').trim();
    if (!eventDepartment) return false;
    return scopes.some(scope => departmentsEqual(scope, eventDepartment));
}

// Enviar un mensaje a todos los clientes conectados al dashboard
function broadcast(data) {
    if (!wss) return;
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1 && canReceiveBroadcast(client.user, data)) { // OPEN
            client.send(msg);
        }
    });
}

module.exports = { initWebSocket, broadcast };
