// Client side of calendar subscriptions. Remote .ics feeds can't be fetched
// directly from the browser (CORS), so we go through the same-origin proxy at
// /api/ics-proxy (a Netlify function in prod, the local dev server in testing).

const PROXY_ENDPOINT = '/api/ics-proxy';

/**
 * Fetch a remote iCalendar feed through the proxy and return its raw text.
 * Throws an Error carrying the proxy's message on failure.
 */
export async function fetchSubscriptionIcs(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`);
  } catch {
    throw new Error('Could not reach the calendar proxy. Check your connection.');
  }

  if (!response.ok) {
    let message = `Could not load calendar (error ${response.status})`;
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new Error(message);
  }

  return response.text();
}

/** Best-effort friendly name from a feed URL (its host), for the default calendar name. */
export function nameFromUrl(url: string): string {
  try {
    return new URL(url.replace(/^webcal:/i, 'https:')).hostname.replace(/^www\./, '');
  } catch {
    return 'Subscribed calendar';
  }
}
