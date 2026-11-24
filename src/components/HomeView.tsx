import React, { useMemo, useState } from 'react';
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  Users,
  Phone,
  ShieldCheck,
  Bus,
  Building2,
  Compass,
  Image as ImageIcon,
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Share2,
} from 'lucide-react';
import {
  TRIP_TYPE_LABELS,
  type PackageCategory,
  type SeasonPoster,
  type SiteSettings,
  type TravelPackage,
} from '../types';
import { ASSET_IMAGES } from '../data/defaults';
import { useToast } from './ToastProvider';
import { shareSiteOrPackage } from '../utils/shareUtils';

interface HomeViewProps {
  settings: SiteSettings;
  packages: TravelPackage[];
  categories: PackageCategory[];
  posters: SeasonPoster[];
  loading: boolean;
  isStaffSignedIn?: boolean;
  onSelectPackage: (pkg: TravelPackage) => void;
  onTrackBooking: () => void;
  onManagePosters?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  packages,
  categories,
  posters,
  loading,
  isStaffSignedIn = false,
  onSelectPackage,
  onTrackBooking,
  onManagePosters,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [activePosterIndex, setActivePosterIndex] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const { showToast } = useToast();

  const handleSharePackage = async (e: React.MouseEvent, pkg: TravelPackage) => {
    e.stopPropagation();
    await shareSiteOrPackage(
      {
        title: `${pkg.title} — ${settings.agencyName}`,
        text: `اكتشف عرض "${pkg.title}" إلى ${pkg.destination} (${pkg.price.toLocaleString('ar-SA')} ${pkg.currency}) مع مكتب راية الفرات`,
      },
      (msg) => showToast(msg, 'success')
    );
  };

  const activePosters = useMemo(
    () => posters.filter((p) => p.active && Boolean(p.imageUrl)),
    [posters]
  );

  const safePosterIndex =
    activePosters.length > 0 ? activePosterIndex % activePosters.length : 0;
  const currentPoster = activePosters[safePosterIndex] || null;

  const handleNextPoster = () => {
    if (activePosters.length <= 1) return;
    setActivePosterIndex((prev) => (prev + 1) % activePosters.length);
  };

  const handlePrevPoster = () => {
    if (activePosters.length <= 1) return;
    setActivePosterIndex((prev) => (prev - 1 + activePosters.length) % activePosters.length);
  };

  const visiblePackages = useMemo(
    () => packages.filter((pkg) => pkg.visible),
    [packages]
  );

  const activePopulatedCategories = useMemo(() => {
    return categories
      .filter(
        (cat) =>
          cat.active &&
          visiblePackages.some((pkg) => pkg.categoryId === cat.id)
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categories, visiblePackages]);

  const activeCategoryIds = useMemo(
    () => new Set(activePopulatedCategories.map((c) => c.id)),
    [activePopulatedCategories]
  );

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    activePopulatedCategories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [activePopulatedCategories]);

  const uncategorizedPackages = useMemo(
    () =>
      visiblePackages.filter(
        (pkg) => !pkg.categoryId || !activeCategoryIds.has(pkg.categoryId)
      ),
    [visiblePackages, activeCategoryIds]
  );

  const hasSearchOrNumericFilters = Boolean(
    searchQuery.trim() || maxPrice !== 'all' || durationFilter !== 'all'
  );

  const filteredPackages = useMemo(() => {
    return visiblePackages.filter((pkg) => {
      if (categoryFilter === 'uncategorized') {
        if (pkg.categoryId && activeCategoryIds.has(pkg.categoryId)) return false;
      } else if (categoryFilter !== 'all') {
        if (pkg.categoryId !== categoryFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${pkg.title} ${pkg.destination} ${pkg.subtitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (maxPrice !== 'all') {
        const limit = Number(maxPrice);
        if (pkg.price > limit) return false;
      }

      if (durationFilter === 'short' && pkg.durationDays > 3) return false;
      if (durationFilter === 'medium' && (pkg.durationDays < 4 || pkg.durationDays > 6)) return false;
      if (durationFilter === 'long' && pkg.durationDays < 7) return false;

      return true;
    });
  }, [visiblePackages, categoryFilter, activeCategoryIds, searchQuery, maxPrice, durationFilter]);

  const resetFilters = () => {
    setCategoryFilter('all');
    setSearchQuery('');
    setMaxPrice('all');
    setDurationFilter('all');
  };

  const renderPackageCard = (pkg: TravelPackage) => {
    const imgFailed = !pkg.coverImage || brokenImages[pkg.id];
    const catLabel =
      (pkg.categoryId && categoryNameMap.get(pkg.categoryId)) ||
      TRIP_TYPE_LABELS[pkg.tripType];
    const busesCount = Array.isArray(pkg.buses) ? pkg.buses.length : 0;

    return (
      <article
        key={pkg.id}
        className="group bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        {/* 4:3 Image Frame */}
        <div
          onClick={() => onSelectPackage(pkg)}
          className="relative aspect-[4/3] overflow-hidden bg-[#EFE7D8] cursor-pointer"
        >
          {imgFailed ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#0F332B] to-[#0E6E73] text-white">
              <Compass className="w-10 h-10 text-[#E8C97E] mb-2" />
              <span className="font-display font-bold text-base">{pkg.destination}</span>
            </div>
          ) : (
            <img
              src={pkg.coverImage}
              alt={pkg.title}
              referrerPolicy="no-referrer"
              onError={() => setBrokenImages((prev) => ({ ...prev, [pkg.id]: true }))}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
          <button
            type="button"
            onClick={(e) => handleSharePackage(e, pkg)}
            title="مشاركة الباقة"
            aria-label={`مشاركة ${pkg.title}`}
            className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-white/90 hover:bg-white text-[#0F332B] flex items-center justify-center shadow-sm transition-transform hover:scale-105"
          >
            <Share2 className="w-4 h-4 text-[#0E6E73]" />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute bottom-3 right-4 left-4 flex items-center justify-between text-xs text-white/95 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#E8C97E]" />
              {pkg.destination}
            </span>
            <span className="tabular-nums">
              {pkg.availableSeats > 0 ? `متبقي ${pkg.availableSeats} مقعد` : 'مكتمل'}
            </span>
          </div>
        </div>

        {/* Clean Zero-Pill Card Body */}
        <div className="p-6 flex flex-col flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7A74] mb-2">
            <span className="font-semibold text-[#0E6E73]">{catLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {pkg.durationLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {pkg.departureDate}
            </span>
            {busesCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-[#8C6D2E] font-medium">
                  <Bus className="w-3.5 h-3.5" />
                  {busesCount} {busesCount === 1 ? 'حافلة' : 'حافلات'}
                </span>
              </>
            )}
          </div>

          <h3
            onClick={() => onSelectPackage(pkg)}
            className="font-display text-lg font-extrabold text-[#0F332B] mb-2 cursor-pointer group-hover:text-[var(--brand-secondary)] transition-colors"
          >
            {pkg.title}
          </h3>

          <p className="text-sm text-[#556660] leading-relaxed line-clamp-2 mb-4">
            {pkg.subtitle}
          </p>

          {pkg.highlights && pkg.highlights.length > 0 && (
            <ul className="space-y-1.5 text-xs text-[#374B45] mb-6 pt-3 border-t border-[#F0E9DC]">
              {pkg.highlights.slice(0, 3).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#B88E3E] font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-4 border-t border-[#E6DCCA] flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-[#6B7A74]">يبدأ من / للشخص</p>
              <p className="font-display text-2xl font-extrabold text-[#0F332B] tabular-nums leading-tight">
                {pkg.price.toLocaleString('ar-SA')}{' '}
                <span className="text-sm font-bold text-[#8C6D2E]">{pkg.currency}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectPackage(pkg)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              عرض التفاصيل والحجز
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div>
      {/* 1. Editorial Storefront Hero */}
      <section className="relative overflow-hidden border-b border-[#E6DCCA]">
        <div className="relative min-h-[520px] lg:min-h-[580px] flex items-center">
          <img
            src={ASSET_IMAGES.heroHaramain}
            alt="إطلالة مكة المكرمة والحرمين الشريفين"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(270deg, rgba(15, 51, 43, 0.90) 0%, rgba(15, 51, 43, 0.72) 48%, rgba(15, 51, 43, 0.35) 100%)',
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
            <div className="max-w-2xl space-y-6">
              <p className="text-sm font-medium text-[#E8C97E] tracking-wide">
                {settings.agencyName} {settings.agencySubtitle} · {settings.tagline}
              </p>

              <h1
                className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-[1.22]"
                style={{ textWrap: 'balance' }}
              >
                {settings.heroTitle}
              </h1>

              <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
                {settings.heroSubtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="#packages-section"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-[#0F332B] bg-[#E8C97E] hover:bg-[#DFBA63] transition-colors whitespace-nowrap"
                >
                  استكشف الباقات المتاحة
                  <ArrowLeft className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={onTrackBooking}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  متابعة حجز سابق
                </button>

                {currentPoster && (
                  <button
                    type="button"
                    onClick={() => setPosterModalOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#E8C97E] hover:text-white underline underline-offset-4 transition-colors whitespace-nowrap"
                  >
                    <ImageIcon className="w-4 h-4" />
                    عرض إعلان الموسم
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Packages Catalog & Dynamic Category Sections */}
      <section id="packages-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8C6D2E]">
              {visiblePackages.length > 0 ? 'باقات مختارة للموسم الحالي' : settings.welcomePhrase}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F332B]">
              الرحلات والباقات السياحية المتاحة
            </h2>
          </div>

          {/* Dynamic Category Filter Tabs — ONLY active categories with >= 1 visible package */}
          {!loading && visiblePackages.length > 0 && activePopulatedCategories.length > 0 && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EFE7D8] overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === 'all'
                    ? 'bg-[#0F332B] text-white shadow-xs'
                    : 'text-[#374B45] hover:text-[#0F332B]'
                }`}
              >
                جميع الباقات
              </button>
              {activePopulatedCategories.map((cat) => {
                const active = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#0F332B] text-white shadow-xs'
                        : 'text-[#374B45] hover:text-[#0F332B]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
              {uncategorizedPackages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('uncategorized')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === 'uncategorized'
                      ? 'bg-[#0F332B] text-white shadow-xs'
                      : 'text-[#374B45] hover:text-[#0F332B]'
                  }`}
                >
                  باقات أخرى
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search, Price & Duration Filter Controls (only when packages exist) */}
        {!loading && visiblePackages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 p-4 rounded-2xl bg-white border border-[#E6DCCA] mb-10">
            <div className="lg:col-span-5 relative">
              <Search className="w-4 h-4 text-[#556660] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالوجهة أو اسم الرحلة..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-[#142621] placeholder:text-[#788882] focus:border-[var(--brand-secondary)] focus:outline-none"
              />
            </div>

            <div className="lg:col-span-3">
              <select
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                aria-label="الفلترة حسب السعر"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-[#142621] focus:border-[var(--brand-secondary)] focus:outline-none"
              >
                <option value="all">جميع الأسعار</option>
                <option value="350">حتى 350 ريال</option>
                <option value="1500">حتى 1,500 ريال</option>
                <option value="4000">حتى 4,000 ريال</option>
                <option value="10000">حتى 10,000 ريال</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                aria-label="الفلترة حسب المدة"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-[#142621] focus:border-[var(--brand-secondary)] focus:outline-none"
              >
                <option value="all">جميع المدد</option>
                <option value="short">رحلات قصيرة (1 – 3 أيام)</option>
                <option value="medium">رحلات متوسطة (4 – 6 أيام)</option>
                <option value="long">رحلات مطوّلة (7 أيام فأكثر)</option>
              </select>
            </div>

            <div className="lg:col-span-1 flex items-center">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-medium text-[#556660] hover:text-[#0F332B] hover:bg-[#FAF7F0] border border-transparent hover:border-[#E6DCCA] transition-colors whitespace-nowrap"
              >
                إعادة ضبط
              </button>
            </div>
          </div>
        )}

        {/* Loading / Empty / Dynamic Sections */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-2xl bg-white border border-[#E6DCCA] overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-[#EFE7D8]" />
                <div className="p-6 space-y-3">
                  <div className="h-3 bg-[#EFE7D8] rounded w-1/2" />
                  <div className="h-5 bg-[#EFE7D8] rounded w-3/4" />
                  <div className="h-4 bg-[#EFE7D8] rounded w-full" />
                  <div className="h-10 bg-[#EFE7D8] rounded-xl w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : visiblePackages.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white rounded-3xl border border-[#E6DCCA] space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-center text-[#B88E3E]">
              <Compass className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#0F332B]">
                لا توجد باقات متاحة للحجز حالياً، ترقبوا عروضنا القادمة
              </h3>
              <p className="text-sm text-[#556660] leading-relaxed">
                يعمل فريق {settings.agencyName} {settings.agencySubtitle} على تجهيز باقات الموسم الجديد. يمكنكم متابعة حجوزاتكم السابقة أو التواصل المباشر معنا للاستفسار عن الرحلات القادمة.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onTrackBooking}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                متابعة حجز سابق
              </button>
              {settings.contacts?.[0] && (
                <a
                  href={`tel:${settings.contacts[0].phone}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0F332B] bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73]"
                >
                  <Phone className="w-4 h-4 text-[#B88E3E]" />
                  اتصل بالمكتب ({settings.contacts[0].phone})
                </a>
              )}
            </div>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white rounded-2xl border border-[#E6DCCA]">
            <Compass className="w-10 h-10 text-[#B88E3E] mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-[#0F332B] mb-1">
              لا توجد باقات مطابقة لخيارات البحث الحالية
            </h3>
            <p className="text-sm text-[#556660] mb-5">
              جرّب تغيير التصنيف أو توسيع نطاق السعر والمدة لعرض الباقات المتاحة.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              عرض جميع الباقات
            </button>
          </div>
        ) : categoryFilter === 'all' && !hasSearchOrNumericFilters && activePopulatedCategories.length > 0 ? (
          <div className="space-y-14">
            {activePopulatedCategories.map((cat) => {
              const catPackages = visiblePackages.filter((pkg) => pkg.categoryId === cat.id);
              if (catPackages.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#E6DCCA]">
                    <div>
                      <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#0F332B]">
                        {cat.name}
                      </h3>
                      {cat.description && (
                        <p className="text-sm text-[#556660] mt-1">{cat.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#8C6D2E] tabular-nums shrink-0">
                      {catPackages.length} {catPackages.length === 1 ? 'باقة متاحة' : 'باقات متاحة'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                    {catPackages.map(renderPackageCard)}
                  </div>
                </div>
              );
            })}

            {uncategorizedPackages.length > 0 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#E6DCCA]">
                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#0F332B]">
                      باقات وعروض متنوعة
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-[#8C6D2E] tabular-nums shrink-0">
                    {uncategorizedPackages.length}{' '}
                    {uncategorizedPackages.length === 1 ? 'باقة متاحة' : 'باقات متاحة'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {uncategorizedPackages.map(renderPackageCard)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredPackages.map(renderPackageCard)}
          </div>
        )}
      </section>

      {/* 3. Official Season Campaign & Agency Trust Section */}
      <section
        id="season-offer"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      >
        <div className="bg-white rounded-3xl border border-[#E6DCCA] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Agency Guarantees & Official Ad Info */}
          <div
            className={`${
              currentPoster ? 'lg:col-span-7' : 'lg:col-span-12'
            } p-8 sm:p-12 flex flex-col justify-center space-y-6`}
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#8C6D2E]">
                يشمل العرض لرحلات {settings.agencyName}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F332B]">
                تنظيم متكامل يرافقكم من لحظة الحجز وحتى العودة
              </h2>
              <p className="text-sm sm:text-base text-[#556660] leading-relaxed">
                نجمع في مكتب {settings.agencyName} {settings.agencySubtitle} بين الخبرة الميدانية في تنظيم رحلات الحرمين والرحلات السياحية وبين الحجز الإلكتروني السهل والمتابعة الفورية لطلبكم.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-center text-[#0F332B]">
                  <Bus className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-sm text-[#0F332B]">النقل والسكن</h3>
                <p className="text-xs text-[#556660] leading-relaxed">
                  حافلات سياحية حديثة وتنقلات منظمة ومريحة طوال مسار الرحلة.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-center text-[#0F332B]">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-sm text-[#0F332B]">السكن الفندقي</h3>
                <p className="text-xs text-[#556660] leading-relaxed">
                  فنادق مختارة بعناية وقريبة من الحرمين والوجهات الرئيسية.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-center text-[#0F332B]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-sm text-[#0F332B]">الإرشاد الديني</h3>
                <p className="text-xs text-[#556660] leading-relaxed">
                  مرافقة إرشادية وتنظيمية لخدمة المعتمرين والمسافرين على مدار الساعة.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0E9DC] flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex flex-wrap items-center gap-6">
                {(settings.contacts || []).map((c, idx) => (
                  <a
                    key={idx}
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-2 text-[#0F332B] hover:text-[var(--brand-secondary)] transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#B88E3E]" />
                    <span className="font-medium">{c.label}:</span>
                    <span className="font-mono font-semibold tabular-nums" dir="ltr">
                      {c.phone}
                    </span>
                  </a>
                ))}
              </div>

              {!currentPoster && isStaffSignedIn && onManagePosters && (
                <button
                  type="button"
                  onClick={onManagePosters}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#0F332B] bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5 text-[#0E6E73]" />
                  إضافة إعلان موسمي
                </button>
              )}
            </div>
          </div>

          {/* Official Agency Ad Visual Frame (Dynamic Season Posters) */}
          {currentPoster && (
            <div className="lg:col-span-5 bg-[#FAF7F0] border-t lg:border-t-0 lg:border-r border-[#E6DCCA] p-6 sm:p-8 flex flex-col items-center justify-center gap-4">
              <div className="relative max-w-[310px] w-full">
                <button
                  type="button"
                  onClick={() => setPosterModalOpen(true)}
                  className="group relative rounded-2xl overflow-hidden border border-[#E6DCCA] w-full shadow-sm hover:shadow-md transition-shadow block bg-white"
                  aria-label={`تكبير ${currentPoster.title}`}
                >
                  <img
                    src={currentPoster.imageUrl}
                    alt={currentPoster.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 py-2.5 px-3 bg-[#0F332B]/90 text-white text-xs font-medium text-center">
                    اضغط لتكبير {currentPoster.title}
                  </div>
                </button>

                {activePosters.length > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handlePrevPoster}
                      className="p-2 rounded-xl bg-white border border-[#E6DCCA] text-[#0F332B] hover:border-[#0E6E73] transition-colors"
                      aria-label="الإعلان السابق"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {activePosters.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setActivePosterIndex(idx)}
                          aria-label={`عرض الإعلان ${idx + 1}`}
                          className={`h-2 rounded-full transition-all ${
                            idx === safePosterIndex
                              ? 'w-6 bg-[#0F332B]'
                              : 'w-2 bg-[#D3C7B2] hover:bg-[#B88E3E]'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleNextPoster}
                      className="p-2 rounded-xl bg-white border border-[#E6DCCA] text-[#0F332B] hover:border-[#0E6E73] transition-colors"
                      aria-label="الإعلان التالي"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {currentPoster.subtitle && (
                <p className="text-xs text-[#556660] text-center max-w-[300px] leading-relaxed">
                  {currentPoster.subtitle}
                </p>
              )}

              {isStaffSignedIn && onManagePosters && (
                <button
                  type="button"
                  onClick={onManagePosters}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#0F332B] bg-white border border-[#E6DCCA] hover:border-[#0E6E73] hover:text-[#0E6E73] transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  تعديل / إضافة / حذف الإعلان
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Poster Lightbox Modal */}
      {posterModalOpen && currentPoster && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPosterModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden border border-[#E6DCCA]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#FAF7F0] border-b border-[#E6DCCA]">
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-[#0F332B] truncate">
                  {currentPoster.title}
                </p>
                {currentPoster.subtitle && (
                  <p className="text-[11px] text-[#556660] truncate">{currentPoster.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isStaffSignedIn && onManagePosters && (
                  <button
                    type="button"
                    onClick={() => {
                      setPosterModalOpen(false);
                      onManagePosters();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E6DCCA] text-[11px] font-bold text-[#0F332B] hover:border-[#0E6E73]"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-[#0E6E73]" />
                    إدارة الإعلانات
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPosterModalOpen(false)}
                  className="p-1.5 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[82vh] overflow-y-auto p-3 bg-[#F8F4EC] flex flex-col items-center gap-3">
              <img
                src={currentPoster.imageUrl}
                alt={currentPoster.title}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] w-auto rounded-xl object-contain"
              />
              {activePosters.length > 1 && (
                <div className="flex items-center justify-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={handlePrevPoster}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    <ChevronRight className="w-4 h-4" />
                    السابق
                  </button>
                  <span className="text-xs font-mono text-[#556660] tabular-nums">
                    {safePosterIndex + 1} / {activePosters.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPoster}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    التالي
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
