import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { SiteSettings } from '../types';
import { BrandLogo } from './BrandLogo';

export type PublicRoute = 'home' | 'detail' | 'booking' | 'track' | 'admin';

interface HeaderProps {
  settings: SiteSettings;
  activeRoute: PublicRoute;
  onNavigate: (route: PublicRoute, anchorId?: string) => void;
  isStaffSignedIn: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeRoute,
  onNavigate,
  isStaffSignedIn,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLink = (route: PublicRoute, anchorId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(route, anchorId);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-b border-[#E6DCCA] no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLink('home')}
          className="text-right focus-visible:outline-none shrink-0"
          aria-label={settings.agencyName}
        >
          <BrandLogo settings={settings} size="sm" showWordmark />
        </button>

        {/* Zone 2: 4 Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#374B45]">
          <button
            type="button"
            onClick={() => handleLink('home', 'packages-section')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeRoute === 'home' || activeRoute === 'detail'
                ? 'border-[var(--brand-accent)] text-[var(--brand-primary)] font-bold'
                : 'border-transparent hover:text-[var(--brand-primary)] hover:border-[#E6DCCA]'
            }`}
          >
            الباقات
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'season-offer')}
            className="py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent hover:text-[var(--brand-primary)] hover:border-[#E6DCCA]"
          >
            عروض الموسم
          </button>
          <button
            type="button"
            onClick={() => handleLink('track')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeRoute === 'track'
                ? 'border-[var(--brand-accent)] text-[var(--brand-primary)] font-bold'
                : 'border-transparent hover:text-[var(--brand-primary)] hover:border-[#E6DCCA]'
            }`}
          >
            متابعة الحجز
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'contact-footer')}
            className="py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent hover:text-[var(--brand-primary)] hover:border-[#E6DCCA]"
          >
            تواصل معنا
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLink('admin')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 min-h-[40px]"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {isStaffSignedIn ? 'لوحة التحكم' : 'بوابة الإدارة'}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-[#0F332B] hover:bg-[#EFE7D8] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="القائمة الرئيسية"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E6DCCA] bg-[#FAF7F0] px-4 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleLink('home', 'packages-section')}
            className="block w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#142621] hover:bg-[#EFE7D8]"
          >
            الباقات السياحية
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'season-offer')}
            className="block w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#142621] hover:bg-[#EFE7D8]"
          >
            عروض الموسم
          </button>
          <button
            type="button"
            onClick={() => handleLink('track')}
            className="block w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#142621] hover:bg-[#EFE7D8]"
          >
            متابعة الحجز
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'contact-footer')}
            className="block w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#142621] hover:bg-[#EFE7D8]"
          >
            تواصل معنا
          </button>
          <div className="pt-2 border-t border-[#E6DCCA]">
            <button
              type="button"
              onClick={() => handleLink('admin')}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {isStaffSignedIn ? 'لوحة التحكم' : 'بوابة الإدارة'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
