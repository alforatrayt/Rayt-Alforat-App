import React, { useState } from 'react';
import { Menu, Share2, X } from 'lucide-react';
import type { SiteSettings } from '../types';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useToast } from './ToastProvider';
import { shareSiteOrPackage } from '../utils/shareUtils';

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
  const { showToast } = useToast();

  const handleLink = (route: PublicRoute, anchorId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(route, anchorId);
  };

  const handleShareSite = async () => {
    await shareSiteOrPackage(
      {
        title: `${settings.agencyName} ${settings.agencySubtitle}`,
        text: 'اكتشف أحدث عروض وباقات السفر مع مكتب راية الفرات',
      },
      (msg) => showToast(msg, 'success')
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-b border-[#E6DCCA] no-print">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 lg:gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLink('home')}
          className="text-right focus-visible:outline-none shrink-0"
          aria-label={settings.agencyName}
        >
          <BrandLogo settings={settings} size="sm" showWordmark />
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#374B45]">
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

        {/* Zone 3: PWA Install + Share + Primary Admin Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <PWAInstallButton settings={settings} compact />

          <button
            type="button"
            onClick={handleShareSite}
            title="مشاركة الموقع"
            aria-label="مشاركة الموقع"
            className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#E6DCCA] bg-white text-[#0F332B] hover:bg-[#FAF7F0] transition-colors text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 min-h-[38px]"
          >
            <Share2 className="w-4 h-4 text-[#0E6E73] shrink-0" />
            <span className="hidden sm:inline">مشاركة</span>
          </button>

          <button
            type="button"
            onClick={() => handleLink('admin')}
            className="hidden sm:inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 min-h-[38px]"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {isStaffSignedIn ? 'لوحة التحكم' : 'بوابة الإدارة'}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded-lg text-[#0F332B] hover:bg-[#EFE7D8] transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="القائمة الرئيسية"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E6DCCA] bg-[#FAF7F0] px-4 py-4 space-y-2">
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

          <div className="pt-2 border-t border-[#E6DCCA] space-y-2">
            <PWAInstallButton settings={settings} fullWidth onActionDone={() => setMobileMenuOpen(false)} />
            <button
              type="button"
              onClick={async () => {
                setMobileMenuOpen(false);
                await handleShareSite();
              }}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-[#0F332B] bg-white border border-[#E6DCCA] flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-[#0E6E73]" />
              مشاركة الموقع مع الأصدقاء
            </button>
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
