// src/middleware/checkRegistrationSecret.js
//
// Valida el header X-Registration-Secret contra la variable de entorno.
// Se usa exclusivamente en POST /api/machines/register (ruta pública,
// sin JWT ni MAC).

function checkRegistrationSecret(req, res, next) {
    const s = req.headers['x-registration-secret'];
    if (!s || s !== process.env.REGISTRATION_SECRET) {
        return res.status(401).json({ error: 'Secret de registro inválido' });
    }
    next();
}

module.exports = checkRegistrationSecret;
