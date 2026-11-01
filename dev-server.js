/**
 * TruthLens AI - Local Development Server
 * Zero-dependency Node.js HTTP server.
 * Serves static assets and routes /api/* to serverless handlers.
 * Loads .env.local on boot.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 1. Load .env.local or .env into process.env if present
function loadEnvFile(filename) {
  const fullPath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
    console.log(`[dev-server] Loaded environment from ${filename}`);
  } catch (err) {
    console.warn(`[dev-server] Warning reading ${filename}:`, err.message);
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '127.0.0.1';

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Handlers for /api routes
let analyzeHandler = null;
let healthHandler = null;

try {
  analyzeHandler = require('./api/analyze.js');
} catch (e) {
  console.error('[dev-server] Failed to load api/analyze.js:', e);
}

try {
  healthHandler = require('./api/health.js');
} catch (e) {
  console.error('[dev-server] Failed to load api/health.js:', e);
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Add CORS headers for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/health') {
    if (healthHandler) {
      return healthHandler(req, res);
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Health handler missing' }));
      return;
    }
  }

  if (pathname === '/api/analyze') {
    if (!analyzeHandler) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Analyze handler missing' }));
      return;
    }

    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk;
      // Safeguard max payload (1MB)
      if (rawBody.length > 1024 * 1024) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        req.body = rawBody ? JSON.parse(rawBody) : {};
      } catch (err) {
        req.body = rawBody;
      }
      analyzeHandler(req, res);
    });
    return;
  }

  // Static file serving
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  // Security check: ensure path is within repo directory
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n=================================================`);
  console.log(` TruthLens AI local development server is running`);
  console.log(` URL: http://${HOST}:${PORT}`);
  console.log(` Tests: http://${HOST}:${PORT}/tests/test.html`);
  console.log(`=================================================\n`);
});
