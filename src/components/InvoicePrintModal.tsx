import React from 'react';
import { Printer, X } from 'lucide-react';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type FormTemplate,
  type SiteSettings,
} from '../types';
import { BrandLogo } from './BrandLogo';
import { formatFirestoreDate } from '../utils/exportUtils';

interface InvoicePrintModalProps {
  booking: Booking;
  formTemplate?: FormTemplate | null;
  settings: SiteSettings;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  booking,
  formTemplate,
  settings,
  onClose,
}) => {
  const fieldLabelMap = new Map<string, string>();
  formTemplate?.fields.forEach((f) => fieldLabelMap.set(f.id, f.label));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="bg-white w-full max-w-4xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-auto">
        {/* Toolbar (hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] no-print">
          <h3 className="font-display font-bold text-base text-[#0F332B]">
            فاتورة وكشف حجز — {booking.bookingRef}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <Printer className="w-4 h-4" />
              طباعة / حفظ كـ PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8] transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 space-y-8 text-[#142621]">
          {/* Letterhead with Official Agency Logo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b-2 border-[#0F332B]">
            <div className="space-y-1.5">
              <BrandLogo settings={settings} size="lg" showWordmark />
              <p className="text-xs font-medium text-[#8C6D2E] pr-1">{settings.agencySubtitle} — {settings.tagline}</p>
            </div>
            <div className="text-right sm:text-left space-y-1">
              <p className="text-xs text-[#556660]">الرقم المرجعي للحجز</p>
              <p className="font-mono text-xl font-bold text-[#0F332B] tabular-nums">{booking.bookingRef}</p>
              <p className="text-xs text-[#556660]">
                الحالة: <strong className="text-[#0E6E73]">{BOOKING_STATUS_LABELS[booking.status]}</strong>
              </p>
              <p className="text-xs text-[#556660]">
                تاريخ الطلب: {formatFirestoreDate(booking.createdAt)}
              </p>
            </div>
          </div>

          {/* Package & Customer Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2 p-5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]">
              <h4 className="font-display font-bold text-[#0F332B] mb-2">بيانات الباقة السياحية</h4>
              <p><span className="text-[#556660]">الباقة:</span> <strong>{booking.packageTitle}</strong></p>
              <p><span className="text-[#556660]">تاريخ الانطلاق:</span> <strong>{booking.departureDate}</strong></p>
              {booking.busName && (
                <p><span className="text-[#556660]">الحافلة / الفوج:</span> <strong>{booking.busName}</strong></p>
              )}
              <p className="tabular-nums">
                <span className="text-[#556660]">عدد المسافرين:</span>{' '}
                <strong>
                  {booking.adultsCount} بالغ
                  {booking.childrenCount > 0 ? ` · ${booking.childrenCount} طفل` : ''}
                  {booking.infantsCount > 0 ? ` · ${booking.infantsCount} رضيع` : ''}
                </strong>
              </p>
            </div>

            <div className="space-y-2 p-5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]">
              <h4 className="font-display font-bold text-[#0F332B] mb-2">بيانات صاحب الحجز</h4>
              <p><span className="text-[#556660]">الاسم:</span> <strong>{booking.customerName}</strong></p>
              <p>
                <span className="text-[#556660]">رقم الجوال:</span>{' '}
                <strong className="font-mono tabular-nums" dir="ltr">{booking.customerPhone}</strong>
              </p>
              {booking.customerEmail && (
                <p>
                  <span className="text-[#556660]">البريد الإلكتروني:</span>{' '}
                  <strong className="font-mono text-xs">{booking.customerEmail}</strong>
                </p>
              )}
              {booking.customerNotes && (
                <p><span className="text-[#556660]">ملاحظات العميل:</span> {booking.customerNotes}</p>
              )}
            </div>
          </div>

          {/* Travelers Manifest Table */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-base text-[#0F332B]">كشف بيانات المسافرين</h4>
            <div className="overflow-x-auto border border-[#E6DCCA] rounded-xl">
              <table className="w-full text-sm text-right border-collapse">
                <thead className="bg-[#0F332B] text-white text-xs">
                  <tr>
                    <th className="py-3 px-4 font-semibold">#</th>
                    <th className="py-3 px-4 font-semibold">الفئة</th>
                    <th className="py-3 px-4 font-semibold">البيانات المسجلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DCCA]">
                  {booking.travelers.map((t, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-3 px-4 font-mono tabular-nums text-[#556660]">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{t.label}</td>
                      <td className="py-3 px-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                          {Object.entries(t.answers || {}).map(([key, val]) => (
                            <div key={key}>
                              <span className="text-[#556660]">{fieldLabelMap.get(key) || key}: </span>
                              <span className="font-medium text-[#142621]">
                                {Array.isArray(val) ? val.join('، ') : String(val || '—')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Total Bar */}
          <div className="rounded-xl bg-[#0F332B] text-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-white/75">الإجمالي المطلوب للباقة</p>
                <p className="text-xs text-[#E8C97E] mt-0.5">
                  حالة السداد:{' '}
                  {booking.paymentStatus
                    ? PAYMENT_STATUS_LABELS[booking.paymentStatus]
                    : 'غير مدفوع'}
                </p>
              </div>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {booking.totalPrice.toLocaleString('ar-SA')} {booking.currency}
              </p>
            </div>

            {typeof booking.paidAmount === 'number' && (
              <div className="pt-3 border-t border-white/15 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-white/70 block">المبلغ المدفوع</span>
                  <strong className="text-sm font-bold text-[#E8C97E] tabular-nums">
                    {booking.paidAmount.toLocaleString('ar-SA')} {booking.currency}
                  </strong>
                </div>
                <div>
                  <span className="text-white/70 block">المبلغ المتبقي</span>
                  <strong className="text-sm font-bold text-white tabular-nums">
                    {(booking.remainingAmount ?? Math.max(0, booking.totalPrice - booking.paidAmount)).toLocaleString('ar-SA')}{' '}
                    {booking.currency}
                  </strong>
                </div>
                {booking.payments && booking.payments.length > 0 && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-white/70 block">آخر دفعة مسجلة</span>
                    <strong className="text-xs text-white/95">
                      {booking.payments[booking.payments.length - 1].date} ·{' '}
                      {PAYMENT_METHOD_LABELS[booking.payments[booking.payments.length - 1].method]}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agency Footer Contacts on Invoice */}
          <div className="pt-4 border-t border-[#E6DCCA] flex flex-wrap items-center justify-between gap-4 text-xs text-[#556660]">
            <div>
              <strong className="text-[#0F332B]">{settings.agencyName} {settings.agencySubtitle}</strong>
              {settings.address ? ` · ${settings.address}` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {(settings.contacts || []).map((c, idx) => (
                <span key={idx}>
                  {c.label}: <strong className="font-mono tabular-nums text-[#142621]" dir="ltr">{c.phone}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
