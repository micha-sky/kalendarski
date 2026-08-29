# Privacy

Kalendarski is built to be private by absence. There is no account, no backend
database, and no analytics or tracking of any kind.

## What stays on your device

All of your data — events, calendars, subscriptions, the chosen location, and
theme — lives only in your browser's `localStorage`. It is never uploaded, and
clearing your browser data removes it completely.

## No tracking

- No cookies, no local/session storage used for identification.
- No fingerprinting, no advertising or analytics scripts.
- No third-party scripts at all — the app is fully self-contained.
- No error-reporting service; crashes are logged only to your browser console.

## Network requests the app makes

Every request is functional (needed to show you something you asked for), goes
to a named provider, and carries no personal identifiers or cookies:

| Purpose | Endpoint | Data sent |
| --- | --- | --- |
| Weather gradient & conditions | Open-Meteo (`*.open-meteo.com`) | Approximate coordinates (rounded), dates |
| Place search | Open-Meteo geocoding | The place name you type |
| Reverse geocoding ("use my location") | BigDataCloud | Your coordinates, only when you tap it |
| Calendar subscriptions | `/api/ics-proxy` on this site | The feed URL you add |

The subscription proxy fetches the `.ics` URLs you explicitly add and refuses to
reach private/internal addresses. It stores nothing.

## Location

Geolocation is requested only after you choose "Use my current location," and
coordinates are rounded before being sent to weather providers.
