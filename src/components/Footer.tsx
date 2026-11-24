import React from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';
import type { SiteSettings } from '../types';
import { BrandLogo } from './BrandLogo';
import type { PublicRoute } from './Header';

interface FooterProps {
  settings: SiteSettings;
  onNavigate: (route: PublicRoute, anchorId?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ settings, onNavigate }) => {
  return (
    <footer
      id="contact-footer"
      className="mt-20 text-[#F3EDE0] no-print"
      style={{ backgroundColor: 'var(--brand-primary)' }}
    >
      {/* Golden subtle top accent hairline matching the ad wave */}
      <div className="h-1 w-full" style={{ backgroundColor: 'var(--brand-accent)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/10">
          {/* Agency Identity & Tagline */}
          <div className="md:col-span-5 space-y-4">
            <BrandLogo settings={settings} size="md" showWordmark inverted />
            <p className="text-sm font-medium text-[#E0C27A]">{settings.tagline}</p>
            <p className="text-sm text-white/75 leading-relaxed max-w-md">
              {settings.welcomePhrase} — نحرص في {settings.agencyName} {settings.agencySubtitle} على تقديم برامج عمرة وسياحة منظمة بأعلى معايير الراحة والأمان.
            </p>
            {settings.address && (
              <div className="flex items-center gap-2 text-sm text-white/75 pt-1">
                <MapPin className="w-4 h-4 text-[#D8B464] shrink-0" />
                <span>{settings.address}</span>
              </div>
            )}
            {settings.email && (
              <div className="flex items-center gap-2 text-sm text-white/75">
                <Mail className="w-4 h-4 text-[#D8B464] shrink-0" />
                <span className="font-mono text-xs">{settings.email}</span>
              </div>
            )}
          </div>

          {/* Direct Booking Contact Phones (from the agency ad) */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="font-display text-base font-bold text-white">أرقام الحجز والتواصل المباشر</h3>
            <div className="space-y-3">
              {(settings.contacts || []).map((contact, i) => (
                <a
                  key={`${contact.label}_${i}`}
                  href={`tel:${contact.phone}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm font-medium text-white/90">{contact.label}</span>
                  <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-[#E8C97E] tabular-nums" dir="ltr">
                    <Phone className="w-3.5 h-3.5" />
                    {contact.phone}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="font-display text-base font-bold text-white">روابط سريعة</h3>
            <ul className="space-y-2.5 text-sm text-white/75">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home', 'packages-section')}
                  className="hover:text-[#E8C97E] transition-colors"
                >
                  استعراض جميع الباقات
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="hover:text-[#E8C97E] transition-colors"
                >
                  متابعة حالة الحجز
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="hover:text-[#E8C97E] transition-colors"
                >
                  دخول المشرفين والموظفين
                </button>
              </li>
            </ul>
            {(settings.instagramUrl || settings.twitterUrl || settings.snapchatUrl) && (
              <div className="pt-2 flex items-center gap-4 text-xs text-white/70">
                {settings.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-white underline-offset-4 hover:underline">
                    إنستغرام
                  </a>
                )}
                {settings.twitterUrl && (
                  <a href={settings.twitterUrl} target="_blank" rel="noreferrer" className="hover:text-white underline-offset-4 hover:underline">
                    إكس
                  </a>
                )}
                {settings.snapchatUrl && (
                  <a href={settings.snapchatUrl} target="_blank" rel="noreferrer" className="hover:text-white underline-offset-4 hover:underline">
                    سناب شات
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>
            © {new Date().getFullYear()} {settings.agencyName} {settings.agencySubtitle}. جميع الحقوق محفوظة.
          </p>
          <p>{settings.welcomePhrase}</p>
        </div>
      </div>
    </footer>
  );
};
