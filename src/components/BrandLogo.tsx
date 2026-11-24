import React from 'react';
import type { SiteSettings } from '../types';

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
  const secondary = settings.secondaryColor || '#0E6E73';
  const accent = settings.accentColor || '#B88E3E';

  return (
    <div className="inline-flex items-center gap-3 shrink-0 select-none">
      {settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={settings.agencyName}
          referrerPolicy="no-referrer"
          className={`${iconDims} rounded-full object-contain bg-white/95 p-0.5 border border-[var(--brand-accent)]/40 shrink-0`}
        />
      ) : (
        <svg
          viewBox="0 0 120 120"
          className={`${iconDims} shrink-0`}
          aria-hidden="true"
        >
          {/* Outer Circular Emblem Ring matching the Rayat Al-Furat Ad */}
          <circle
            cx="60"
            cy="58"
            r="48"
            fill={inverted ? '#FAF6EE' : '#FDFBF7'}
            stroke={secondary}
            strokeWidth="3.5"
          />
          <circle
            cx="60"
            cy="58"
            r="43"
            fill="none"
            stroke={accent}
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />

          {/* Golden Calligraphic Emblem Arc & Emblematic Monogram */}
          <path
            d="M36 48 C42 28, 72 24, 83 41 C89 51, 80 62, 65 62 C52 62, 46 53, 52 43 C56 37, 67 36, 72 44"
            fill="none"
            stroke={accent}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="62" cy="30" r="2.6" fill={accent} />
          <circle cx="71" cy="28" r="2.2" fill={accent} />
          <text
            x="60"
            y="59"
            textAnchor="middle"
            fill={primary}
            style={{
              fontFamily: 'Cairo, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
            }}
          >
            الفرات
          </text>

          {/* Swooping Teal Ribbon from the Official Ad */}
          <path
            d="M22 72 Q60 95 98 63 L93 74 Q60 105 27 83 Z"
            fill={secondary}
          />
          {/* Golden Under-Swoosh */}
          <path
            d="M14 88 Q52 108 92 78 Q54 98 19 82 Z"
            fill={accent}
          />
          {/* Ribbon Micro Text */}
          <text
            x="60"
            y="84"
            textAnchor="middle"
            fill="#FFFFFF"
            style={{
              fontFamily: 'Tajawal, sans-serif',
              fontWeight: 700,
              fontSize: '9px',
            }}
          >
            للسفر والسياحة
          </text>
        </svg>
      )}

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
