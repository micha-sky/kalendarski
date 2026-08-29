// Netlify Function (v2): CORS-safe proxy for remote .ics subscription feeds.
// Route is declared via config.path below (no netlify.toml redirect needed).
import { fetchRemoteIcs, ProxyError } from '../../server/icsProxyCore.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const target = new URL(req.url).searchParams.get('url');
  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing "url" parameter' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { body, contentType } = await fetchRemoteIcs(target);
    return new Response(body, {
      status: 200,
      headers: { ...CORS, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=900' },
    });
  } catch (err) {
    const status = err instanceof ProxyError ? err.statusCode : 500;
    return new Response(JSON.stringify({ error: err.message || 'Proxy error' }), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/ics-proxy' };
