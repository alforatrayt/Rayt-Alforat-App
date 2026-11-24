import React, { useEffect, useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  XCircle,
  Calendar,
  Users,
  Phone,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type BookingStatus,
  type BookingTracker,
  type SiteSettings,
} from '../types';
import { lookupBookingTracker } from '../services/firestoreService';
import { formatFirestoreDate } from '../utils/exportUtils';

interface TrackBookingViewProps {
  settings: SiteSettings;
  initialRef?: string;
  initialPhone?: string;
}

const STEPS: Array<{ key: BookingStatus; label: string; desc: string }> = [
  { key: 'pending_review', label: 'قيد المراجعة', desc: 'استلم الفريق طلبك ويراجع بيانات المسافرين' },
  { key: 'awaiting_payment', label: 'بانتظار الدفع', desc: 'تمت الموافقة المبدئية وبانتظار تأكيد السداد' },
  { key: 'confirmed', label: 'حجز مؤكد', desc: 'تم تأكيد مقاعدك وإصدار تفاصيل الرحلة' },
];

export const TrackBookingView: React.FC<TrackBookingViewProps> = ({
  settings,
  initialRef = '',
  initialPhone = '',
}) => {
  const [bookingRef, setBookingRef] = useState(initialRef);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<BookingTracker | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const runSearch = async (refVal: string, phoneVal: string) => {
    if (!refVal.trim() || !phoneVal.trim()) {
      setErrorMsg('يُرجى إدخال الرقم المرجعي للحجز ورقم الجوال المسجّل.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setSearched(true);
    try {
      const found = await lookupBookingTracker(refVal, phoneVal);
      setResult(found);
    } catch {
      setResult(null);
      setErrorMsg('تعذر الاستعلام في الوقت الحالي، تأكد من صحة البيانات وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRef && initialPhone) {
      runSearch(initialRef, initialPhone);
    }
  }, [initialRef, initialPhone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(bookingRef, phone);
  };

  const activeStepIndex =
    result?.status === 'pending_review'
      ? 0
      : result?.status === 'awaiting_payment'
      ? 1
      : result?.status === 'confirmed'
      ? 2
      : -1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
      <div className="text-center space-y-2.5">
        <p className="text-xs font-semibold text-[#8C6D2E]">الاستعلام الفوري عن الطلبات</p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0F332B]">
          متابعة حالة الحجز
        </h1>
        <p className="text-sm sm:text-base text-[#556660] max-w-lg mx-auto">
          أدخل الرقم المرجعي للحجز ورقم الجوال المستخدم أثناء التسجيل للاطلاع على آخر تحديثات حجزك.
        </p>
      </div>

      {/* Search Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#142621]">
              الرقم المرجعي للحجز
            </label>
            <input
              type="text"
              dir="ltr"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
              placeholder="RF-123456"
              className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] font-mono text-sm text-right focus:border-[var(--brand-secondary)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#142621]">
              رقم الجوال
            </label>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] font-mono text-sm text-right focus:border-[var(--brand-secondary)] focus:outline-none"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ البحث عن الحجز...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              الاستعلام عن حالة الحجز
            </>
          )}
        </button>
      </form>

      {/* Search Result */}
      {searched && !loading && !result && !errorMsg && (
        <div className="bg-white rounded-2xl border border-[#E6DCCA] p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-[#B88E3E] mx-auto" />
          <h2 className="font-display text-lg font-bold text-[#0F332B]">
            لم يتم العثور على حجز مطابق
          </h2>
          <p className="text-sm text-[#556660] max-w-md mx-auto">
            تأكد من تطابق الرقم المرجعي (مثل RF-123456) ورقم الجوال الذي أدخلته عند التسجيل، أو تواصل مباشرة مع المكتب للمساعدة.
          </p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F0E9DC]">
            <div>
              <p className="text-xs text-[#6B7A74]">الرقم المرجعي</p>
              <p className="font-mono text-2xl font-bold text-[#0F332B] tabular-nums">
                {result.bookingRef}
              </p>
            </div>
            <div className="text-right sm:text-left">
              <p className="text-xs text-[#6B7A74]">الحالة الحالية</p>
              <p
                className={`font-display text-lg font-extrabold flex items-center sm:justify-end gap-2 ${
                  result.status === 'confirmed'
                    ? 'text-[#0E6E73]'
                    : result.status === 'cancelled'
                    ? 'text-red-700'
                    : 'text-[#8C6D2E]'
                }`}
              >
                {result.status === 'confirmed' && <CheckCircle2 className="w-5 h-5" />}
                {result.status === 'pending_review' && <Clock className="w-5 h-5" />}
                {result.status === 'awaiting_payment' && <CreditCard className="w-5 h-5" />}
                {result.status === 'cancelled' && <XCircle className="w-5 h-5" />}
                {BOOKING_STATUS_LABELS[result.status]}
              </p>
            </div>
          </div>

          {/* Progress Steps (when not cancelled) */}
          {result.status !== 'cancelled' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((step, idx) => {
                const done = idx <= activeStepIndex;
                return (
                  <div
                    key={step.key}
                    className={`p-4 rounded-xl border ${
                      done
                        ? 'bg-[#FAF7F0] border-[#0E6E73]'
                        : 'bg-white border-[#EFE7D8] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-mono font-bold flex items-center justify-center ${
                          done ? 'bg-[#0F332B] text-white' : 'bg-[#EFE7D8] text-[#556660]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-display font-bold text-sm text-[#0F332B]">
                        {step.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#556660] leading-relaxed">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              تم إلغاء هذا الحجز. في حال رغبتك بإعادة الحجز أو الاستفسار يُرجى التواصل مع إدارة المكتب.
            </div>
          )}

          {/* Public Note from Agency */}
          {result.publicStatusNote && (
            <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-1">
              <p className="text-xs font-bold text-[#0F332B]">رسالة من فريق {settings.agencyName}:</p>
              <p className="text-sm text-[#374B45] leading-relaxed">{result.publicStatusNote}</p>
            </div>
          )}

          {/* Booking Details Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#F0E9DC] text-sm">
            <div className="col-span-2">
              <p className="text-xs text-[#6B7A74]">الباقة السياحية</p>
              <p className="font-bold text-[#0F332B]">{result.packageTitle}</p>
              {result.busName && (
                <p className="text-xs font-semibold text-[#0E6E73] mt-0.5">
                  الحافلة / الفوج: {result.busName}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#6B7A74] inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                تاريخ الانطلاق
              </p>
              <p className="font-semibold text-[#142621]">{result.departureDate}</p>
            </div>
            <div>
              <p className="text-xs text-[#6B7A74] inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                المسافرون والإجمالي
              </p>
              <p className="font-semibold text-[#142621] tabular-nums">
                {result.travelersCount} مسافر · {result.totalPrice.toLocaleString('ar-SA')} {result.currency}
              </p>
            </div>
          </div>

          {typeof result.paidAmount === 'number' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm">
              <div>
                <p className="text-xs text-[#6B7A74]">حالة السداد</p>
                <p className="font-bold text-[#0F332B]">
                  {result.paymentStatus ? PAYMENT_STATUS_LABELS[result.paymentStatus] : 'غير مدفوع'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7A74]">المبلغ المدفوع</p>
                <p className="font-bold text-[#0E6E73] tabular-nums">
                  {result.paidAmount.toLocaleString('ar-SA')} {result.currency}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7A74]">المبلغ المتبقي</p>
                <p className="font-bold text-[#8C6D2E] tabular-nums">
                  {(result.remainingAmount ?? Math.max(0, result.totalPrice - result.paidAmount)).toLocaleString('ar-SA')}{' '}
                  {result.currency}
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#F0E9DC] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B7A74]">
            <span>آخر تحديث: {formatFirestoreDate(result.updatedAt)}</span>
            {settings.contacts?.[0] && (
              <a
                href={`tel:${settings.contacts[0].phone}`}
                className="inline-flex items-center gap-1.5 font-semibold text-[#0F332B] hover:text-[#0E6E73]"
              >
                <Phone className="w-3.5 h-3.5" />
                للاستفسار: {settings.contacts[0].label} ({settings.contacts[0].phone})
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
