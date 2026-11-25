import type { SiteSettings } from '../types';

const SETTINGS_CACHE_KEY = 'rf_site_settings_cache_v1';
const LOGO_VERSION_CACHE_KEY = 'rf_pwa_logo_version_v1';

let activeManifestBlobUrl: string | null = null;
let latestSyncToken = 0;
let lastAppliedSignature = '';

export function readCachedSiteSettings(): SiteSettings | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteSettings;
    if (!parsed || typeof parsed !== 'object' || !parsed.agencyName) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedSiteSettings(settings: SiteSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function buildCacheBustedLogoSrc(
  logoUrl: string | undefined,
  version?: number | string
): string {
  const ver = version ?? Date.now();
  const trimmed = (logoUrl || '').trim();
  const base = trimmed || '/pwa-512x512.png';

  if (base.startsWith('data:') || base.startsWith('blob:')) {
    return base;
  }

  try {
    const resolved = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    resolved.searchParams.set('v', String(ver));
    return base.startsWith('http://') || base.startsWith('https://')
      ? resolved.toString()
      : `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    const clean = base.replace(/([?&])v=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}v=${encodeURIComponent(String(ver))}`;
  }
}

export async function purgeLegacyPwaIconCaches(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    const cacheNames = await window.caches.keys();
    await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await window.caches.open(name);
        const requests = await cache.keys();
        await Promise.all(
          requests.map((req) => {
            const url = req.url.toLowerCase();
            if (
              url.includes('pwa-') ||
              url.includes('apple-touch-icon') ||
              url.includes('favicon') ||
              url.includes('icon.svg') ||
              url.includes('manifest.webmanifest') ||
              url.includes('manifest.json')
            ) {
              return cache.delete(req);
            }
            return Promise.resolve(false);
          })
        );
      })
    );
  } catch {
    // Ignore cache inspection errors
  }
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const tryLoad = (useCors: boolean) => {
      const img = new Image();
      if (useCors) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (useCors) {
          tryLoad(false);
        } else {
          reject(new Error(`Failed to load icon image: ${src}`));
        }
      };
      img.src = src;
    };

    const isRemoteHttp =
      (src.startsWith('http://') || src.startsWith('https://')) &&
      typeof window !== 'undefined' &&
      !src.startsWith(window.location.origin);

    tryLoad(isRemoteHttp);
  });
}

function renderSquareIconDataUrl(
  img: HTMLImageElement,
  size: number,
  backgroundColor: string | null,
  paddingRatio: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  const naturalW = img.naturalWidth || img.width || size;
  const naturalH = img.naturalHeight || img.height || size;
  const innerSize = size * (1 - paddingRatio * 2);
  const scale = Math.min(innerSize / naturalW, innerSize / naturalH);
  const drawW = Math.round(naturalW * scale);
  const drawH = Math.round(naturalH * scale);
  const offsetX = Math.round((size - drawW) / 2);
  const offsetY = Math.round((size - drawH) / 2);

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  return canvas.toDataURL('image/png');
}

interface GeneratedIconSet {
  favicon64: string;
  appleTouch180: string;
  icon192: string;
  icon512: string;
  maskable512: string;
}

async function generateIconSetFromSource(
  src: string,
  maskableBg: string,
  appleBg: string
): Promise<GeneratedIconSet> {
  const fallbackAbsolute =
    typeof window !== 'undefined'
      ? new URL(src, window.location.origin).toString()
      : src;

  try {
    const img = await loadImageForCanvas(src);
    return {
      favicon64: renderSquareIconDataUrl(img, 64, null, 0.02),
      appleTouch180: renderSquareIconDataUrl(img, 180, appleBg, 0.1),
      icon192: renderSquareIconDataUrl(img, 192, null, 0.04),
      icon512: renderSquareIconDataUrl(img, 512, null, 0.04),
      maskable512: renderSquareIconDataUrl(img, 512, maskableBg, 0.14),
    };
  } catch {
    // Fallback cleanly to cache-busted absolute URL if remote host forbids canvas readback
    return {
      favicon64: fallbackAbsolute,
      appleTouch180: fallbackAbsolute,
      icon192: fallbackAbsolute,
      icon512: fallbackAbsolute,
      maskable512: fallbackAbsolute,
    };
  }
}

function updateHeadMetaAndLinks(params: {
  fullName: string;
  shortName: string;
  description: string;
  themeColor: string;
  bgColor: string;
  icons: GeneratedIconSet;
}): void {
  const { head } = document;
  if (!head) return;

  document.title = `${params.fullName} — ${params.description.slice(0, 60)}`;

  const setMeta = (selector: string, attrs: Record<string, string>) => {
    let el = head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      head.appendChild(el);
    }
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  };

  setMeta('meta[name="theme-color"]', {
    name: 'theme-color',
    content: params.themeColor,
  });
  setMeta('meta[name="apple-mobile-web-app-title"]', {
    name: 'apple-mobile-web-app-title',
    content: params.shortName,
  });
  setMeta('meta[property="og:title"]', {
    property: 'og:title',
    content: params.fullName,
  });
  setMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: params.description,
  });

  // Replace all static/stale icon links with the freshly rendered dynamic icons
  head
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((node) => node.remove());

  const iconLink = document.createElement('link');
  iconLink.rel = 'icon';
  iconLink.type = 'image/png';
  iconLink.sizes = '64x64';
  iconLink.href = params.icons.favicon64;
  head.appendChild(iconLink);

  const shortcutLink = document.createElement('link');
  shortcutLink.rel = 'shortcut icon';
  shortcutLink.type = 'image/png';
  shortcutLink.href = params.icons.favicon64;
  head.appendChild(shortcutLink);

  const appleLink = document.createElement('link');
  appleLink.rel = 'apple-touch-icon';
  appleLink.sizes = '180x180';
  appleLink.href = params.icons.appleTouch180;
  head.appendChild(appleLink);

  // Build dynamic Web App Manifest with absolute same-origin navigation URLs
  const origin = window.location.origin;
  const manifestPayload = {
    id: `${origin}/`,
    name: params.fullName,
    short_name: params.shortName,
    description: params.description,
    lang: 'ar',
    dir: 'rtl',
    theme_color: params.themeColor,
    background_color: params.bgColor,
    display: 'standalone',
    orientation: 'portrait-primary',
    start_url: `${origin}/`,
    scope: `${origin}/`,
    icons: [
      {
        src: params.icons.icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: params.icons.icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: params.icons.maskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  const manifestBlob = new Blob([JSON.stringify(manifestPayload)], {
    type: 'application/manifest+json',
  });
  const nextBlobUrl = URL.createObjectURL(manifestBlob);

  head.querySelectorAll('link[rel="manifest"]').forEach((node) => node.remove());
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = nextBlobUrl;
  head.appendChild(manifestLink);

  const previousBlobUrl = activeManifestBlobUrl;
  activeManifestBlobUrl = nextBlobUrl;
  if (previousBlobUrl && previousBlobUrl !== nextBlobUrl) {
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(previousBlobUrl);
      } catch {
        // Ignore revoke failure
      }
    }, 5000);
  }
}

export async function syncDynamicPwaHeadAndManifest(settings: SiteSettings): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const version = settings.logoVersion || 1;
  const cleanAgency = (settings.agencyName || 'راية الفرات').trim();
  const cleanSubtitle = (settings.agencySubtitle || 'للسفر والسياحة').trim();
  const fullName = cleanSubtitle && !cleanAgency.includes(cleanSubtitle)
    ? `${cleanAgency} ${cleanSubtitle}`
    : cleanAgency;
  const shortName = cleanAgency.slice(0, 12);
  const description = (
    settings.heroSubtitle ||
    settings.tagline ||
    'منصة متكاملة لحجز وإدارة الباقات السياحية ورحلات العمرة لمكتب راية الفرات.'
  ).trim();
  const themeColor = settings.primaryColor || '#0F332B';
  const bgColor = settings.bgColor || '#F8F4EC';

  const signature = [
    settings.logoUrl || '',
    version,
    fullName,
    themeColor,
    bgColor,
    description,
  ].join('|');

  if (signature === lastAppliedSignature) {
    return;
  }

  const syncToken = ++latestSyncToken;
  const bustedLogoSrc = buildCacheBustedLogoSrc(settings.logoUrl, version);

  // Purge old SW cached icon assets whenever version changes
  try {
    const prevVersion = window.localStorage.getItem(LOGO_VERSION_CACHE_KEY);
    if (prevVersion !== String(version)) {
      window.localStorage.setItem(LOGO_VERSION_CACHE_KEY, String(version));
      void purgeLegacyPwaIconCaches();
    }
  } catch {
    // Ignore storage error
  }

  const icons = await generateIconSetFromSource(bustedLogoSrc, bgColor, bgColor);

  // If primary custom URL failed cleanly on canvas and we fell back, also check default icon
  if (syncToken !== latestSyncToken) {
    return;
  }

  lastAppliedSignature = signature;
  updateHeadMetaAndLinks({
    fullName,
    shortName,
    description,
    themeColor,
    bgColor,
    icons,
  });
}
