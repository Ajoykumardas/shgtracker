const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const MAX_BODY_BYTES = 20 * 1024 * 1024; // restore payloads can be large

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Saved responses live in Supabase Postgres. Each store exposes the same
// GET-all / POST-merge contract the frontend has always used.
const STORES = {
  '/api/reasons':  { get: db.getReasons,  save: db.saveReasons },
  '/api/cutoff':   { get: db.getCutoff,   save: db.saveCutoff },
  '/api/lakhpati': { get: db.getLakhpati, save: db.saveLakhpati }
};

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
        resolve(payload);
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON payload'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  const store = STORES[pathname];
  if (store) {
    if (req.method === 'GET') {
      return sendJson(res, 200, await store.get());
    }
    if (req.method === 'POST') {
      await store.save(await readJsonBody(req));
      const counts = await db.counts();
      return sendJson(res, 200, { success: true, count: counts[pathname.replace('/api/', '')] });
    }
  }

  // Backup & Restore — full export / merge-import of all saved responses
  if (pathname === '/api/backup' && req.method === 'GET') {
    const [reasons, cutoff, lakhpati, counts] = await Promise.all([
      db.getReasons(), db.getCutoff(), db.getLakhpati(), db.counts()
    ]);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ reasons, cutoff, lakhpati, counts, exportedAt: new Date().toISOString() }, null, 2));
  }

  if (pathname === '/api/restore' && req.method === 'POST') {
    const payload = await readJsonBody(req);
    if (payload.reasons)  await db.saveReasons(payload.reasons);
    if (payload.cutoff)   await db.saveCutoff(payload.cutoff);
    if (payload.lakhpati) await db.saveLakhpati(payload.lakhpati);
    return sendJson(res, 200, { success: true, counts: await db.counts() });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Lightweight Health / Ping endpoint for uptime monitors
  if (pathname === '/health' || pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  }

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(err => {
      if (!err.status) console.error(`${req.method} ${pathname} failed:`, err);
      if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : 'Database error' });
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (pathname.startsWith('/data/')) {
    filePath = path.join(DATA_DIR, pathname.replace('/data/', ''));
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileStream = fs.createReadStream(filePath);

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (acceptEncoding.includes('gzip') && (ext === '.json' || ext === '.js' || ext === '.css' || ext === '.html' || ext === '.csv')) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Cache-Control': 'no-cache'
    });
    fileStream.pipe(zlib.createGzip()).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fileStream.pipe(res);
  }
});

db.init()
  .then(() => db.counts())
  .then(counts => {
    console.log(`Connected to Postgres — reasons: ${counts.reasons}, cutoff: ${counts.cutoff}, lakhpati: ${counts.lakhpati}`);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`SHG Verification Portal running at http://localhost:${PORT}`);

      // Built-in Self-Pinger: If RENDER_EXTERNAL_URL is set in Render environment, automatically ping itself every 10 minutes
      const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
      if (appUrl) {
        const pingUrl = `${appUrl.replace(/\/$/, '')}/health`;
        console.log(`Starting self-ping service for: ${pingUrl}`);
        setInterval(() => {
          const httpModule = pingUrl.startsWith('https') ? require('https') : require('http');
          httpModule.get(pingUrl, (res) => {
            console.log(`[Self-Ping] Pinged ${pingUrl} - Status: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
          }).on('error', (err) => {
            console.warn(`[Self-Ping] Ping error:`, err.message);
          });
        }, 10 * 60 * 1000); // Every 10 minutes
      }
    });
  })
  .catch(err => {
    console.error('Failed to initialise database:', err.message);
    process.exit(1);
  });
