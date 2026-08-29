// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertPublicHttpUrl, fetchRemoteIcs, isPrivateIp, ProxyError } from '../icsProxyCore.js';

describe('isPrivateIp', () => {
  it('flags loopback, private, link-local and reserved ranges', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.9.9', '192.168.1.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '93.184.216.34', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe('assertPublicHttpUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(ProxyError);
    await expect(assertPublicHttpUrl('ftp://example.com/x.ics')).rejects.toBeInstanceOf(ProxyError);
  });
  it('rejects localhost and private IP literals', async () => {
    await expect(assertPublicHttpUrl('http://localhost/x.ics')).rejects.toBeInstanceOf(ProxyError);
    await expect(assertPublicHttpUrl('http://127.0.0.1/x.ics')).rejects.toBeInstanceOf(ProxyError);
    await expect(assertPublicHttpUrl('http://192.168.0.10/x.ics')).rejects.toBeInstanceOf(ProxyError);
    await expect(assertPublicHttpUrl('http://[::1]/x.ics')).rejects.toBeInstanceOf(ProxyError);
  });
  it('normalizes webcal to https', async () => {
    const url = await assertPublicHttpUrl('webcal://93.184.216.34/feed.ics');
    expect(url.protocol).toBe('https:');
  });
  it('accepts a public IP literal', async () => {
    const url = await assertPublicHttpUrl('https://93.184.216.34/feed.ics');
    expect(url.hostname).toBe('93.184.216.34');
  });
});

describe('fetchRemoteIcs', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the body for a valid iCalendar response', async () => {
    const ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:1\nEND:VEVENT\nEND:VCALENDAR';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar' } }),
    );
    const { body, contentType } = await fetchRemoteIcs('https://93.184.216.34/feed.ics');
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(contentType).toMatch(/calendar/);
  });

  it('rejects a non-iCalendar response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>not a calendar</html>', { status: 200 }),
    );
    await expect(fetchRemoteIcs('https://93.184.216.34/feed.ics')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('never fetches a blocked target', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(fetchRemoteIcs('http://169.254.169.254/latest/meta-data')).rejects.toBeInstanceOf(ProxyError);
    expect(spy).not.toHaveBeenCalled();
  });
});
