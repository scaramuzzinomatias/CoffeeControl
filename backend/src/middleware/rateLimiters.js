const rateLimit = require('express-rate-limit');

// Limiter para /api/auth/login — frena fuerza bruta de contraseñas.
// Máximo 10 intentos cada 15 minutos por IP.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de login. Probá de nuevo en unos minutos.' },
    skipSuccessfulRequests: true
});

// Limiter para /api/auth/tenant-check — permite tipeo normal (varias letras
// por segundo mientras el usuario escribe) pero frena escaneo automatizado
// de slugs. Máximo 30 requests por minuto por IP.
const tenantCheckLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas consultas. Esperá un momento.' }
});

module.exports = { loginLimiter, tenantCheckLimiter };
