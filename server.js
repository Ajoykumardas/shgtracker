const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const REASONS_FILE = path.join(DATA_DIR, 'member_reasons.json');

const CUTOFF_FILE = path.join(DATA_DIR, 'shg_cutoff_responses.json');

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

// In-memory cache
let membersData = null;
let hierarchyData = null;
let savedReasons = {};
let savedCutoff = {};

function loadData() {
  const membersFile = path.join(PUBLIC_DIR, 'members.json');
  const hierarchyFile = path.join(PUBLIC_DIR, 'hierarchy_summary.json');
  
  if (fs.existsSync(membersFile)) {
    try {
      const raw = fs.readFileSync(membersFile, 'utf-8');
      membersData = JSON.parse(raw);
    } catch (e) {
      console.error('Error loading members.json:', e);
    }
  }

  if (fs.existsSync(hierarchyFile)) {
    try {
      const raw = fs.readFileSync(hierarchyFile, 'utf-8');
      hierarchyData = JSON.parse(raw);
    } catch (e) {
      console.error('Error loading hierarchy_summary.json:', e);
    }
  }

  if (fs.existsSync(REASONS_FILE)) {
    try {
      const raw = fs.readFileSync(REASONS_FILE, 'utf-8');
      savedReasons = JSON.parse(raw);
    } catch (e) {
      savedReasons = {};
    }
  }

  if (fs.existsSync(CUTOFF_FILE)) {
    try {
      const raw = fs.readFileSync(CUTOFF_FILE, 'utf-8');
      savedCutoff = JSON.parse(raw);
    } catch (e) {
      savedCutoff = {};
    }
  }
}

loadData();

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
  if (pathname === '/api/reasons') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(savedReasons));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          savedReasons = { ...savedReasons, ...payload };
          fs.writeFileSync(REASONS_FILE, JSON.stringify(savedReasons, null, 2), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, count: Object.keys(savedReasons).length }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/cutoff') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(savedCutoff));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          savedCutoff = { ...savedCutoff, ...payload };
          fs.writeFileSync(CUTOFF_FILE, JSON.stringify(savedCutoff, null, 2), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, count: Object.keys(savedCutoff).length }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }
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
