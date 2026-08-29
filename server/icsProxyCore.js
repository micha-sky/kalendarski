// Core logic for the ICS subscription proxy, shared by the Netlify function
// (netlify/functions/ics-proxy.mjs) and the local dev server (scripts/dev-server.mjs).
// Framework-agnostic and dependency-free so it runs under plain Node and is unit-testable.
//
// Why a proxy at all: browsers can't fetch arbitrary remote .ics feeds (CORS).
// Why the guards: a naive "fetch whatever the client asks for" server is an SSRF
// hole — it must refuse internal/private targets and cap size/time.

import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;

export class ProxyError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'ProxyError';
    this.statusCode = statusCode;
  }
}

/** True for loopback/private/link-local/reserved addresses that must not be reachable. */
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;      // "this host", private, loopback
    if (a === 169 && b === 254) return true;                // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;       // private
    if (a === 192 && b === 168) return true;                // private
    if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT (100.64/10)
    if (a >= 224) return true;                              // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (lower === '::1' || lower === '::') return true;     // loopback / unspecified
    if (lower.startsWith('fe80')) return true;              // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // unparseable → treat as unsafe
}

/**
 * Validate a subscription URL and return a normalized URL object, or throw ProxyError.
 * Rejects non-http(s) schemes and any host that resolves to a private/internal address.
 * `webcal://` is normalized to `https://`. Set allowPrivate for local testing only.
 */
export async function assertPublicHttpUrl(urlStr, { allowPrivate = false } = {}) {
  // webcal:// is a non-special scheme, so the URL protocol setter can't upgrade
  // it to https — normalize on the string before parsing.
  const normalized = urlStr.replace(/^webcal:/i, 'https:');
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new ProxyError(400, 'Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProxyError(400, 'Only http(s)/webcal calendar URLs are allowed');
  }

  if (allowPrivate) return url;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new ProxyError(403, 'Blocked host');
  }

  // IP literal → check directly (no DNS).
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new ProxyError(403, 'Blocked private address');
    return url;
  }

  // Hostname → every resolved address must be public.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new ProxyError(502, 'Could not resolve host');
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new ProxyError(403, 'Blocked private address');
  }
  return url;
}

/** Read a response body but abort past maxBytes so a huge feed can't exhaust memory. */
async function readCapped(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ProxyError(413, 'Calendar feed is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Fetch a remote .ics feed safely. Follows redirects manually, re-validating each
 * hop so a public URL can't bounce to an internal one. Returns { body, contentType }.
 */
export async function fetchRemoteIcs(
  urlStr,
  { allowPrivate = false, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS, maxRedirects = MAX_REDIRECTS } = {},
) {
  let current = urlStr;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicHttpUrl(current, { allowPrivate });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
          'User-Agent': 'Kalendarski-ICS-Proxy/1.0',
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof ProxyError) throw err;
      throw new ProxyError(504, controller.signal.aborted ? 'Upstream timed out' : 'Upstream fetch failed');
    } finally {
      clearTimeout(timer);
    }

    // Manual redirect: re-validate the next URL on the loop.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new ProxyError(502, 'Redirect without a location');
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) throw new ProxyError(502, `Upstream responded ${response.status}`);

    const body = await readCapped(response, maxBytes);
    if (!/BEGIN:VCALENDAR/i.test(body.slice(0, 1000))) {
      throw new ProxyError(422, 'That URL did not return an iCalendar feed');
    }
    return { body, contentType: 'text/calendar; charset=utf-8' };
  }

  throw new ProxyError(508, 'Too many redirects');
}
