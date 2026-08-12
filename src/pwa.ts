/* PWA wiring: service-worker registration, update detection, and install prompt.
 * Communicates with the UI via window CustomEvents so components stay decoupled.
 */

// Chrome's beforeinstallprompt is not in the DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstall: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // A worker is already waiting (updated in a previous visit).
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting;
          window.dispatchEvent(new CustomEvent('pwa:updateready'));
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // A new worker finished installing while a controller is active →
            // this is an update, not a first install.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              window.dispatchEvent(new CustomEvent('pwa:updateready'));
            }
          });
        });
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });

  // Reload once the new worker takes control.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

export function applyUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

// Install-prompt capture.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new CustomEvent('pwa:installable'));
});

window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  window.dispatchEvent(new CustomEvent('pwa:installed'));
});

export function canInstall(): boolean {
  return deferredInstall !== null;
}

export async function promptInstall(): Promise<void> {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  window.dispatchEvent(new CustomEvent('pwa:installed'));
}
