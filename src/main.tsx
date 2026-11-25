import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { DEFAULT_SITE_SETTINGS } from './data/defaults';
import {
  purgeLegacyPwaIconCaches,
  readCachedSiteSettings,
  syncDynamicPwaHeadAndManifest,
} from './utils/pwaDynamicMeta';
import './index.css';

// Immediately synchronize dynamic manifest, favicon & Apple Touch Icon before install prompt fires
void syncDynamicPwaHeadAndManifest(readCachedSiteSettings() || DEFAULT_SITE_SETTINGS);

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      void purgeLegacyPwaIconCaches();
      if (registration) {
        registration.update().catch(() => {
          // Ignore offline update check failures
        });
      }
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
