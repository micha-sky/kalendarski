// Local static server for dist/ that ALSO serves /api/ics-proxy using the same
// core as the Netlify function — so the subscription flow can be verified
// end-to-end without the Netlify runtime. Dependency-free; runs on plain Node.
//
//   node scripts/dev-server.mjs            # serve on :5199
//   PORT=8080 node scripts/dev-server.mjs
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRemoteIcs, ProxyError } from '../server/icsProxyCore.js';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 5199;
const ALLOW_PRIVATE = process.env.ICS_PROXY_ALLOW_PRIVATE === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/ics-proxy') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const target = url.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing "url" parameter' }));
    }
    try {
      const { body, contentType } = await fetchRemoteIcs(target, { allowPrivate: ALLOW_PRIVATE });
      res.writeHead(200, { 'Content-Type': contentType });
      return res.end(body);
    } catch (err) {
      const status = err instanceof ProxyError ? err.statusCode : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || 'Proxy error' }));
    }
  }

  // Static files with an index.html SPA fallback.
  let pathname = normalize(decodeURIComponent(url.pathname));
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  let filePath = join(DIST, pathname);
  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`dev-server on http://localhost:${PORT} (proxy at /api/ics-proxy${ALLOW_PRIVATE ? ', private allowed' : ''})`);
});
