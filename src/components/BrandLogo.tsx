import React from 'react';
import type { SiteSettings } from '../types';
import { buildCacheBustedLogoSrc } from '../utils/pwaDynamicMeta';

interface BrandLogoProps {
  settings: SiteSettings;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  inverted?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  settings,
  size = 'md',
  showWordmark = true,
  inverted = false,
}) => {
  const iconDims = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const primary = settings.primaryColor || '#0F332B';
  const logoSrc = buildCacheBustedLogoSrc(settings.logoUrl, settings.logoVersion);

  return (
    <div className="inline-flex items-center gap-3 shrink-0 select-none">
      <img
        src={logoSrc}
        alt={settings.agencyName}
        referrerPolicy="no-referrer"
        className={`${iconDims} rounded-full object-contain bg-white/95 p-0.5 border border-[var(--brand-accent)]/40 shrink-0`}
      />

      {showWordmark && (
        <span
          className={`font-display font-extrabold whitespace-nowrap leading-none tracking-tight ${
            size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl'
          }`}
          style={{ color: inverted ? '#FAF6EE' : primary }}
        >
          {settings.agencyName}
        </span>
      )}
    </div>
  );
};
