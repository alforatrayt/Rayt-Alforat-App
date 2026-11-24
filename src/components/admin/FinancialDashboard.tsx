import React, { useMemo, useState } from 'react';
import {
  Bus,
  Calendar,
  Download,
  FileText,
  Loader2,
  Package,
  Search,
  User,
  Wallet,
  Globe,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type SiteSettings,
  type TravelPackage,
} from '../../types';
import {
  buildFinancialDataset,
  exportFinancialReportToExcel,
  exportFinancialReportToPdf,
  type FinancialFilterMode,
} from '../../utils/financialExport';
import { computeBookingFinancialTotals } from '../../services/firestoreService';
import { useToast } from '../ToastProvider';
import { BookingFinancialModal } from './BookingFinancialModal';

interface FinancialDashboardProps {
  bookings: Booking[];
  packages: TravelPackage[];
  settings: SiteSettings;
  currentUserEmail?: string;
  onRefresh: () => Promise<void>;
}

const FILTER_MODES: Array<{
  id: FinancialFilterMode;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'all', label: 'الإجمالي العام', icon: Globe },
  { id: 'package', label: 'حسب الباقة كاملة', icon: Package },
  { id: 'bus', label: 'حسب الحافلة الواحدة', icon: Bus },
  { id: 'date_range', label: 'حسب التاريخ المحدد', icon: Calendar },
  { id: 'individual', label: 'حسب الفرد / الحجز', icon: User },
];

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  bookings,
  packages,
  settings,
  currentUserEmail,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const [mode, setMode] = useState<FinancialFilterMode>('all');
  const [packageId, setPackageId] = useState<string>(() => packages[0]?.id || '');
  const [busId, setBusId] = useState<string>(() => packages[0]?.buses?.[0]?.id || '');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [individualQuery, setIndividualQuery] = useState('');
  const [excludeCancelled, setExcludeCancelled] = useState(true);

  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeBookingModal, setActiveBookingModal] = useState<Booking | null>(null);

  const packageMap = useMemo(() => {
    const map = new Map<string, TravelPackage>();
    packages.forEach((p) => map.set(p.id, p));
    return map;
  }, [packages]);

  const effectivePackageId =
    packageId && packageMap.has(packageId) ? packageId : packages[0]?.id || '';
  const selectedPkg = effectivePackageId ? packageMap.get(effectivePackageId) : undefined;
  const availableBuses = selectedPkg?.buses || [];
  const effectiveBusId =
    busId === '__unassigned__' || availableBuses.some((b) => b.id === busId)
      ? busId
      : availableBuses[0]?.id || '__unassigned__';

  const dataset = useMemo(
    () =>
      buildFinancialDataset(bookings, packages, {
        mode,
        packageId: effectivePackageId,
        busId: effectiveBusId,
        fromDate,
        toDate,
        individualQuery,
        excludeCancelled,
      }),
    [
      bookings,
      packages,
      mode,
      effectivePackageId,
      effectiveBusId,
      fromDate,
      toDate,
      individualQuery,
      excludeCancelled,
    ]
  );

  // Per-bus breakdown when viewing a single package
  const packageBusSummaries = useMemo(() => {
    if (mode !== 'package' || !selectedPkg) return [];
    const scoped = excludeCancelled
      ? bookings.filter((b) => b.packageId === selectedPkg.id && b.status !== 'cancelled')
      : bookings.filter((b) => b.packageId === selectedPkg.id);

    const summaries = (selectedPkg.buses || []).map((bus) => {
      const matching = scoped.filter((b) => b.busId === bus.id);
      let seats = 0;
      let required = 0;
      let collected = 0;
      matching.forEach((b) => {
        seats += (b.adultsCount || 0) + (b.childrenCount || 0) + (b.infantsCount || 0);
        required += b.totalPrice || 0;
        const fin = computeBookingFinancialTotals(b.totalPrice, b.payments || []);
        collected += (b.payments?.length || 0) > 0 ? fin.paidAmount : b.paidAmount || 0;
      });
      return {
        busId: bus.id,
        name: bus.name,
        capacity: bus.capacity,
        seats,
        bookingsCount: matching.length,
        required,
        collected,
        remaining: Math.max(0, required - collected),
      };
    });

    const unassigned = scoped.filter((b) => !b.busId && !b.busName);
    if (unassigned.length > 0) {
      let seats = 0;
      let required = 0;
      let collected = 0;
      unassigned.forEach((b) => {
        seats += (b.adultsCount || 0) + (b.childrenCount || 0) + (b.infantsCount || 0);
        required += b.totalPrice || 0;
        const fin = computeBookingFinancialTotals(b.totalPrice, b.payments || []);
        collected += (b.payments?.length || 0) > 0 ? fin.paidAmount : b.paidAmount || 0;
      });
      summaries.push({
        busId: '__unassigned__',
        name: 'حجوزات غير مسكنة بحافلة',
        capacity: 0,
        seats,
        bookingsCount: unassigned.length,
        required,
        collected,
        remaining: Math.max(0, required - collected),
      });
    }
    return summaries;
  }, [mode, selectedPkg, bookings, excludeCancelled]);

  const handlePackageChange = (nextPkgId: string) => {
    setPackageId(nextPkgId);
    const nextPkg = packageMap.get(nextPkgId);
    setBusId(nextPkg?.buses?.[0]?.id || '__unassigned__');
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const fileName = await exportFinancialReportToExcel({ dataset, settings });
      showToast(`تم تصدير التقرير المالي (${fileName}) بنجاح`, 'success');
    } catch (err) {
      console.error(err);
      showToast('تعذر تصدير ملف Excel.', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const fileName = await exportFinancialReportToPdf({ dataset, settings });
      showToast(`تم تصدير التقرير المالي PDF (${fileName}) بنجاح`, 'success');
    } catch (err) {
      console.error(err);
      showToast('تعذر إنشاء ملف PDF المالي.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Official Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            التقارير المالية وتتبع المدفوعات
          </h1>
          <p className="text-sm text-[#556660]">
            استعرض الإيرادات والمبالغ المحصّلة والمتبقية حسب الفرد أو الحافلة أو الباقة أو الفترة الزمنية، وصدّر التقارير الرسمية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={exportingExcel}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-[#0E6E73] text-[#0E6E73] hover:bg-[#FAF7F0] disabled:opacity-60 whitespace-nowrap"
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            تصدير Excel (.xlsx)
          </button>

          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-[#E8C97E]" />
            )}
            تصدير التقرير PDF
          </button>
        </div>
      </div>

      {/* Filter Mode Tabs & Dynamic Controls */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] overflow-x-auto max-w-full">
            {FILTER_MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0F332B] text-white'
                      : 'text-[#556660] hover:text-[#0F332B]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#374B45] cursor-pointer">
            <input
              type="checkbox"
              checked={excludeCancelled}
              onChange={(e) => setExcludeCancelled(e.target.checked)}
              className="w-4 h-4 accent-[#0F332B]"
            />
            استبعاد الحجوزات الملغاة
          </label>
        </div>

        {/* Mode-specific Controls */}
        {(mode === 'package' || mode === 'bus') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#F0E9DC]">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">اختر الباقة</label>
              <select
                value={effectivePackageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-semibold text-[#0F332B]"
              >
                {packages.length === 0 ? (
                  <option value="">لا توجد باقات مضافة حالياً</option>
                ) : (
                  packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.departureDate})
                    </option>
                  ))
                )}
              </select>
            </div>

            {mode === 'bus' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">اختر الحافلة / الفوج</label>
                <select
                  value={effectiveBusId}
                  onChange={(e) => setBusId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#0E6E73] text-sm font-semibold text-[#0F332B]"
                >
                  {availableBuses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.name} (السعة: {bus.capacity} مقعد)
                    </option>
                  ))}
                  <option value="__unassigned__">حجوزات غير مسكنة في حافلة محددة</option>
                </select>
              </div>
            )}
          </div>
        )}

        {mode === 'date_range' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#F0E9DC]">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">من تاريخ</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">إلى تاريخ</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
              />
            </div>
          </div>
        )}

        {mode === 'individual' && (
          <div className="pt-3 border-t border-[#F0E9DC]">
            <div className="relative">
              <Search className="w-4 h-4 text-[#6B7A74] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={individualQuery}
                onChange={(e) => setIndividualQuery(e.target.value)}
                placeholder="ابحث باسم المسافر أو صاحب الحجز أو رقم الجوال أو المرجع (RF-...)..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E6DCCA] p-5 space-y-1.5">
          <div className="flex items-center justify-between text-[#556660]">
            <span className="text-xs font-medium">إجمالي المبالغ المطلوبة</span>
            <Wallet className="w-4 h-4 text-[#0F332B]" />
          </div>
          <p className="font-display text-2xl font-extrabold text-[#0F332B] tabular-nums">
            {dataset.totalRequired.toLocaleString('ar-SA')} {dataset.currency}
          </p>
          <p className="text-xs text-[#6B7A74]">
            {dataset.bookingsCount} حجز · {dataset.travelersCount} مسافر
            {mode === 'bus' && dataset.busCapacity
              ? ` (إشغال ${dataset.busOccupiedSeats || 0}/${dataset.busCapacity})`
              : ''}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#0E6E73]/40 p-5 space-y-1.5">
          <div className="flex items-center justify-between text-[#0E6E73]">
            <span className="text-xs font-semibold">
              {mode === 'date_range' ? 'المبالغ المحصّلة خلال الفترة' : 'إجمالي المبالغ المحصّلة فعلياً'}
            </span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="font-display text-2xl font-extrabold text-[#0E6E73] tabular-nums">
            {dataset.totalCollected.toLocaleString('ar-SA')} {dataset.currency}
          </p>
          <p className="text-xs text-[#556660]">
            نسبة التحصيل: <strong className="text-[#0E6E73]">{dataset.collectionRatePct}%</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#B88E3E]/50 p-5 space-y-1.5">
          <div className="flex items-center justify-between text-[#8C6D2E]">
            <span className="text-xs font-semibold">إجمالي المبالغ المتبقية</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="font-display text-2xl font-extrabold text-[#8C6D2E] tabular-nums">
            {dataset.totalRemaining.toLocaleString('ar-SA')} {dataset.currency}
          </p>
          <p className="text-xs text-[#6B7A74]">ذمم ومستحقات متبقية لدى العملاء</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E6DCCA] p-5 space-y-2">
          <p className="text-xs font-semibold text-[#0F332B]">توزيع وسائل التحصيل</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#556660]">كاش (نقدي)</span>
              <span className="font-bold text-[#0F332B] tabular-nums">
                {dataset.methodTotals.cash.toLocaleString('ar-SA')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#556660]">تحويل بنكي</span>
              <span className="font-bold text-[#0F332B] tabular-nums">
                {dataset.methodTotals.bank_transfer.toLocaleString('ar-SA')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#556660]">شبكة (مدى/بطاقة)</span>
              <span className="font-bold text-[#0F332B] tabular-nums">
                {dataset.methodTotals.pos_card.toLocaleString('ar-SA')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Bus Breakdown Grid inside Package Mode */}
      {mode === 'package' && packageBusSummaries.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-[#0F332B]">
            توزيع الإيرادات والمقاعد حسب الحافلات في هذه الباقة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packageBusSummaries.map((bs) => (
              <button
                key={bs.busId}
                type="button"
                onClick={() => {
                  setBusId(bs.busId);
                  setMode('bus');
                }}
                className="text-right bg-white rounded-2xl border border-[#E6DCCA] hover:border-[#0E6E73] p-4 space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-sm text-[#0F332B] inline-flex items-center gap-1.5">
                    <Bus className="w-4 h-4 text-[#0E6E73]" />
                    {bs.name}
                  </span>
                  <span className="text-xs font-mono text-[#6B7A74] tabular-nums">
                    {bs.capacity > 0 ? `${bs.seats} / ${bs.capacity} راكب` : `${bs.seats} مسافر`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F0E9DC] text-xs">
                  <div>
                    <span className="text-[#6B7A74] block">المطلوب</span>
                    <strong className="text-[#0F332B] tabular-nums">{bs.required.toLocaleString('ar-SA')}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7A74] block">المحصّل</span>
                    <strong className="text-[#0E6E73] tabular-nums">{bs.collected.toLocaleString('ar-SA')}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7A74] block">المتبقي</span>
                    <strong className="text-[#8C6D2E] tabular-nums">{bs.remaining.toLocaleString('ar-SA')}</strong>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Financial Table (Date-Range Payment Log OR Bookings Financial Statement) */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0E9DC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-extrabold text-base text-[#0F332B]">
              {dataset.scopeTitle}
            </h2>
            <p className="text-xs text-[#6B7A74]">{dataset.scopeSubtitle}</p>
          </div>
          <span className="text-xs font-semibold text-[#0E6E73] tabular-nums">
            {mode === 'date_range'
              ? `${dataset.paymentLogRows.length} حركة تحصيل`
              : `${dataset.bookingRows.length} سجل حجز`}
          </span>
        </div>

        {mode === 'date_range' ? (
          dataset.paymentLogRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#556660]">
              لا توجد دفعات مالية مسجلة ضمن الفترة المحددة ({fromDate} — {toDate}).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">تاريخ الدفعة</th>
                    <th className="py-3 px-4 font-semibold">المرجع</th>
                    <th className="py-3 px-4 font-semibold">العميل</th>
                    <th className="py-3 px-4 font-semibold">الباقة والحافلة</th>
                    <th className="py-3 px-4 font-semibold">وسيلة الدفع</th>
                    <th className="py-3 px-4 font-semibold">المبلغ المحصّل</th>
                    <th className="py-3 px-4 font-semibold">ملاحظة</th>
                    <th className="py-3 px-4 font-semibold">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E9DC]">
                  {dataset.paymentLogRows.map((row) => (
                    <tr key={`${row.booking.id}_${row.payment.id}`} className="hover:bg-[#FAF7F0]/60">
                      <td className="py-3 px-4 font-mono text-xs tabular-nums">{row.payment.date}</td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-[#0F332B]">
                        {row.booking.bookingRef}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#142621]">{row.booking.customerName}</p>
                        <p className="text-xs font-mono text-[#6B7A74]" dir="ltr">
                          {row.booking.customerPhone}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-medium text-[#0F332B]">{row.booking.packageTitle}</p>
                        {row.booking.busName && (
                          <p className="text-[#0E6E73]">{row.booking.busName}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-[#374B45]">
                        {PAYMENT_METHOD_LABELS[row.payment.method]}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0E6E73] tabular-nums whitespace-nowrap">
                        {row.payment.amount.toLocaleString('ar-SA')} {row.booking.currency}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#556660]">{row.payment.note || '—'}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setActiveBookingModal(row.booking)}
                          className="px-3 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B] whitespace-nowrap"
                        >
                          عرض السجل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : dataset.bookingRows.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#556660]">
            لا توجد سجلات مالية مطابقة لمعايير التصفية الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                <tr>
                  <th className="py-3 px-4 font-semibold">المرجع</th>
                  <th className="py-3 px-4 font-semibold">العميل والمسافرون</th>
                  <th className="py-3 px-4 font-semibold">الباقة والحافلة</th>
                  <th className="py-3 px-4 font-semibold">المطلوب</th>
                  <th className="py-3 px-4 font-semibold">المدفوع</th>
                  <th className="py-3 px-4 font-semibold">المتبقي</th>
                  <th className="py-3 px-4 font-semibold">حالة السداد</th>
                  <th className="py-3 px-4 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DC]">
                {dataset.bookingRows.map((row) => {
                  const b = row.booking;
                  return (
                    <tr key={b.id} className="hover:bg-[#FAF7F0]/60">
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs font-bold text-[#0F332B]">{b.bookingRef}</p>
                        <p className="text-[11px] text-[#6B7A74]">
                          {BOOKING_STATUS_LABELS[b.status]}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-[#142621]">{b.customerName}</p>
                        <p className="text-xs text-[#6B7A74] tabular-nums">
                          <span className="font-mono" dir="ltr">
                            {b.customerPhone}
                          </span>{' '}
                          · {row.travelersCount} مسافر
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-medium text-[#0F332B]">{b.packageTitle}</p>
                        <p className="text-[#0E6E73] font-semibold">
                          {b.busName || 'غير مسكن بحافلة'}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-bold tabular-nums whitespace-nowrap">
                        {row.totalPrice.toLocaleString('ar-SA')} {b.currency}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0E6E73] tabular-nums whitespace-nowrap">
                        {row.paidAmount.toLocaleString('ar-SA')} {b.currency}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#8C6D2E] tabular-nums whitespace-nowrap">
                        {row.remainingAmount.toLocaleString('ar-SA')} {b.currency}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            row.paymentStatus === 'paid'
                              ? 'text-[#0E6E73]'
                              : row.paymentStatus === 'partial'
                              ? 'text-[#8C6D2E]'
                              : 'text-red-700'
                          }`}
                        >
                          {row.paymentStatus === 'paid' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {PAYMENT_STATUS_LABELS[row.paymentStatus]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setActiveBookingModal(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-bold text-[#0F332B] whitespace-nowrap"
                        >
                          <Wallet className="w-3.5 h-3.5 text-[#0E6E73]" />
                          تحديث الدفع / الحافلة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeBookingModal && (
        <BookingFinancialModal
          booking={activeBookingModal}
          allBookings={bookings}
          pkg={packageMap.get(activeBookingModal.packageId)}
          currentUserEmail={currentUserEmail}
          onUpdated={(updated) => setActiveBookingModal(updated)}
          onRefresh={onRefresh}
          onClose={() => setActiveBookingModal(null)}
        />
      )}
    </div>
  );
};
