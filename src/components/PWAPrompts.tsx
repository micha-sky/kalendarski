import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { canInstall, promptInstall, applyUpdate } from '../pwa';

/**
 * Renders two unobtrusive PWA affordances:
 * - an "Install" button in the header (only when the browser offers install)
 * - an "Update available" toast when a new service worker is waiting
 * Both are driven by window CustomEvents dispatched from pwa.ts.
 */

export const InstallButton: React.FC = () => {
  const [installable, setInstallable] = useState(canInstall());

  useEffect(() => {
    const onInstallable = () => setInstallable(true);
    const onInstalled = () => setInstallable(false);
    window.addEventListener('pwa:installable', onInstallable);
    window.addEventListener('pwa:installed', onInstalled);
    return () => {
      window.removeEventListener('pwa:installable', onInstallable);
      window.removeEventListener('pwa:installed', onInstalled);
    };
  }, []);

  if (!installable) return null;

  return (
    <button
      onClick={() => promptInstall()}
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
      title="Install Kalendarski"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Install</span>
    </button>
  );
};

export const UpdateToast: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onReady = () => setShow(true);
    window.addEventListener('pwa:updateready', onReady);
    return () => window.removeEventListener('pwa:updateready', onReady);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
    >
      <span>A new version is available.</span>
      <button
        onClick={() => applyUpdate()}
        className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reload
      </button>
      <button
        onClick={() => setShow(false)}
        className="text-gray-400 hover:text-white dark:hover:text-gray-900"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
