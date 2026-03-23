// src/ws.js — WebSocket para actualizaciones en tiempo real al dashboard
// El dashboard se conecta aquí y recibe cada tap al instante

const { WebSocketServer } = require('ws');

let wss = null;

function initWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        console.log(`[WS] Cliente conectado — ${ip} (total: ${wss.clients.size})`);

        ws.on('close', () => {
            console.log(`[WS] Cliente desconectado (total: ${wss.clients.size})`);
        });

        ws.on('error', (err) => {
            console.error('[WS] Error:', err.message);
        });

        // Enviar estado inicial al conectarse
        ws.send(JSON.stringify({ event: 'connected', message: 'CoffeeControl en línea' }));
    });

    console.log('[WS] Servidor WebSocket listo en /ws');
}

// Enviar un mensaje a todos los clientes conectados al dashboard
function broadcast(data) {
    if (!wss) return;
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(msg);
        }
    });
}

module.exports = { initWebSocket, broadcast };
