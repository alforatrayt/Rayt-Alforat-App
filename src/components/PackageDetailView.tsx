import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  X,
  Building2,
  Bus,
  FileText,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import {
  TRIP_TYPE_LABELS,
  type FormTemplate,
  type SiteSettings,
  type TravelPackage,
} from '../types';

interface PackageDetailViewProps {
  pkg: TravelPackage;
  formTemplate: FormTemplate | null;
  settings: SiteSettings;
  onBack: () => void;
  onStartBooking: (pkg: TravelPackage) => void;
}

export const PackageDetailView: React.FC<PackageDetailViewProps> = ({
  pkg,
  formTemplate,
  settings,
  onBack,
  onStartBooking,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb Back Action */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#374B45] hover:text-[#0F332B] mb-6 transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى جميع الباقات
      </button>

      {/* Main 2-Column Contiguous PDP Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Right Column (RTL Primary Content) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Hero Cover Image */}
          <div className="rounded-2xl overflow-hidden border border-[#E6DCCA] bg-[#EFE7D8] aspect-[16/9]">
            {!pkg.coverImage || imgError ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0F332B] to-[#0E6E73] text-white p-8">
                <Compass className="w-12 h-12 text-[#E8C97E] mb-3" />
                <span className="font-display text-2xl font-bold">{pkg.title}</span>
              </div>
            ) : (
              <img
                src={pkg.coverImage}
                alt={pkg.title}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Title & Unboxed Metadata */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#556660]">
              <span className="font-bold text-[#0E6E73]">{TRIP_TYPE_LABELS[pkg.tripType]}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#B88E3E]" />
                {pkg.destination}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#B88E3E]" />
                {pkg.durationLabel} ({pkg.durationDays} أيام / {pkg.durationNights} ليالٍ)
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#B88E3E]" />
                {pkg.departureDate}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-[#0F332B]">
              {pkg.title}
            </h1>
            <p className="text-base text-[#556660] leading-relaxed">{pkg.subtitle}</p>
          </div>

          {/* Day-by-Day Itinerary */}
          {pkg.itinerary && pkg.itinerary.length > 0 && (
            <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-6">
              <h2 className="font-display text-xl font-extrabold text-[#0F332B]">
                البرنامج السياحي اليومي
              </h2>
              <div className="space-y-5 divide-y divide-[#F0E9DC]">
                {pkg.itinerary.map((item, idx) => (
                  <div key={idx} className={idx > 0 ? 'pt-5' : ''}>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-center font-display font-bold text-sm text-[#0F332B] shrink-0 tabular-nums">
                        {item.day}
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="font-display font-bold text-base text-[#0F332B]">
                          اليوم {item.day}: {item.title}
                        </h3>
                        <p className="text-sm text-[#556660] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inclusions & Exclusions */}
          <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="font-display text-lg font-extrabold text-[#0F332B]">
                ما تشمله الباقة
              </h2>
              <ul className="space-y-2.5 text-sm text-[#374B45]">
                {(pkg.inclusions || []).map((inc, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#0E6E73] shrink-0 mt-1" />
                    <span className="leading-relaxed">{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4 md:border-r md:border-[#F0E9DC] md:pr-8">
              <h2 className="font-display text-lg font-extrabold text-[#0F332B]">
                ما لا تشمله الباقة
              </h2>
              <ul className="space-y-2.5 text-sm text-[#556660]">
                {(pkg.exclusions || []).map((exc, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <X className="w-4 h-4 text-[#991B1B] shrink-0 mt-1" />
                    <span className="leading-relaxed">{exc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Hotel, Transport & Cancellation Policy */}
          <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#0F332B] font-display font-bold text-base">
                  <Building2 className="w-4 h-4 text-[#B88E3E]" />
                  معلومات الفنادق والسكن
                </div>
                <p className="text-sm text-[#556660] leading-relaxed">
                  {pkg.hotelInfo || 'فنادق معتمدة ومختارة بعناية.'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#0F332B] font-display font-bold text-base">
                  <Bus className="w-4 h-4 text-[#B88E3E]" />
                  النقل والطيران
                </div>
                <p className="text-sm text-[#556660] leading-relaxed">
                  {pkg.transportInfo || 'وسائل نقل حديثة ومجهزة بالكامل.'}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-[#F0E9DC] space-y-2">
              <div className="flex items-center gap-2 text-[#0F332B] font-display font-bold text-base">
                <ShieldAlert className="w-4 h-4 text-[#B88E3E]" />
                شروط الإلغاء والتعديل
              </div>
              <p className="text-sm text-[#556660] leading-relaxed whitespace-pre-line">
                {pkg.cancellationPolicy || settings.defaultCancellationPolicy}
              </p>
            </div>
          </section>
        </div>

        {/* Left Sticky Contiguous Purchase Module */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-[#E6DCCA] p-6 space-y-6">
            <div className="pb-5 border-b border-[#F0E9DC]">
              <p className="text-xs text-[#6B7A74] mb-1">السعر للبالغ</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-[#0F332B] tabular-nums">
                  {pkg.price.toLocaleString('ar-SA')}
                </span>
                <span className="text-base font-bold text-[#8C6D2E]">{pkg.currency}</span>
              </div>
            </div>

            {/* Pricing Breakdown by Age Category */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#556660]">سعر البالغ (12 سنة فأكثر)</span>
                <span className="font-bold text-[#142621] tabular-nums">
                  {pkg.price.toLocaleString('ar-SA')} {pkg.currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#556660]">سعر الطفل (2 – 11 سنة)</span>
                <span className="font-bold text-[#142621] tabular-nums">
                  {pkg.childPrice.toLocaleString('ar-SA')} {pkg.currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#556660]">سعر الرضيع (أقل من سنتين)</span>
                <span className="font-bold text-[#142621] tabular-nums">
                  {pkg.infantPrice.toLocaleString('ar-SA')} {pkg.currency}
                </span>
              </div>
            </div>

            {/* Key Trip Specs */}
            <div className="pt-4 border-t border-[#F0E9DC] space-y-3 text-sm text-[#374B45]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[#556660]">
                  <Calendar className="w-4 h-4 text-[#B88E3E]" />
                  موعد الانطلاق
                </span>
                <span className="font-semibold">{pkg.departureDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[#556660]">
                  <Users className="w-4 h-4 text-[#B88E3E]" />
                  المقاعد المتاحة
                </span>
                <span className="font-semibold tabular-nums">
                  {pkg.availableSeats > 0 ? `${pkg.availableSeats} مقعد` : 'مكتمل'}
                </span>
              </div>
              {formTemplate && (
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[#556660] shrink-0">
                    <FileText className="w-4 h-4 text-[#B88E3E]" />
                    استمارة الحجز
                  </span>
                  <span className="font-medium text-xs text-left text-[#0E6E73]">
                    {formTemplate.name}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={pkg.availableSeats <= 0}
              onClick={() => onStartBooking(pkg)}
              className="w-full py-3.5 px-5 rounded-xl font-display font-bold text-base text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {pkg.availableSeats > 0 ? 'احجز الآن' : 'اكتملت المقاعد'}
            </button>

            <p className="text-xs text-center text-[#6B7A74] leading-relaxed">
              لن يتم خصم أي مبلغ الآن — ستصلك رسالة بالرقم المرجعي لمتابعة حالة حجزك وتأكيد السداد مع المكتب.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
