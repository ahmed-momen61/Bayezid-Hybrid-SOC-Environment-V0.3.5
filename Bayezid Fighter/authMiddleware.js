const crypto = require('crypto');

const BAYEZID_API_KEY = process.env.BAYEZID_API_KEY || null;
const AUTH_ENABLED = process.env.BAYEZID_AUTH_ENABLED !== 'false';

const PUBLIC_PATHS = new Set([
    '/api/v1/health',
    '/api/v1/status',
    '/api/v1/alerts',
]);

const PUBLIC_PREFIXES = [
    '/api/v1/health',
];

const isPublicRoute = (path) => {
    if (PUBLIC_PATHS.has(path)) return true;
    for (const prefix of PUBLIC_PREFIXES) {
        if (path.startsWith(prefix)) return true;
    }
    return false;
};

const timingSafeCompare = (a, b) => {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

const authMiddleware = (req, res, next) => {
    if (!AUTH_ENABLED) return next();

    if (req.method === 'GET' && isPublicRoute(req.path)) return next();

    if (!BAYEZID_API_KEY) {
        console.log('[⚠️] AUTH: BAYEZID_API_KEY not set. Running in open mode.');
        return next();
    }

    const providedKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!providedKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing X-API-KEY header'
        });
    }

    if (!timingSafeCompare(providedKey, BAYEZID_API_KEY)) {
        console.log(`[🚫] AUTH: Invalid API key attempt from ${req.ip} → ${req.method} ${req.path}`);
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid API key'
        });
    }

    next();
};

module.exports = { authMiddleware };