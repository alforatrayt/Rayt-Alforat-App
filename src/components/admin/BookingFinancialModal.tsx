import React, { useMemo, useState } from 'react';
import {
  Bus,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type AuditActor,
  type Booking,
  type BookingPayment,
  type PaymentMethod,
  type TravelPackage,
} from '../../types';
import {
  computeBookingFinancialTotals,
  logAuditEvent,
  saveBookingFinancials,
  updateBookingBusAssignment,
} from '../../services/firestoreService';
import { generateSafeId } from '../../utils/imageCompress';
import { useToast } from '../ToastProvider';

interface BookingFinancialModalProps {
  booking: Booking;
  allBookings: Booking[];
  pkg?: TravelPackage;
  currentUserEmail?: string;
  actor?: AuditActor;
  onUpdated: (updatedBooking: Booking) => void;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export const BookingFinancialModal: React.FC<BookingFinancialModalProps> = ({
  booking,
  allBookings,
  pkg,
  currentUserEmail,
  actor,
  onUpdated,
  onRefresh,
  onClose,
}) => {
  const { showToast } = useToast();

  const [localBooking, setLocalBooking] = useState<Booking>(booking);
  const [selectedBusId, setSelectedBusId] = useState(booking.busId || '');
  const [customBusName, setCustomBusName] = useState(booking.busName || '');
  const [savingBus, setSavingBus] = useState(false);

  const [amountInput, setAmountInput] = useState<string>('');
  const [methodInput, setMethodInput] = useState<PaymentMethod>('cash');
  const [dateInput, setDateInput] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [noteInput, setNoteInput] = useState<string>('');
  const [savingPayments, setSavingPayments] = useState(false);

  const packageBuses = pkg?.buses || [];

  const busOccupancyMap = useMemo(() => {
    const map = new Map<string, number>();
    allBookings.forEach((b) => {
      if (b.status === 'cancelled' || b.packageId !== localBooking.packageId) return;
      if (b.busId) {
        const count = b.adultsCount + b.childrenCount + b.infantsCount;
        map.set(b.busId, (map.get(b.busId) || 0) + count);
      }
    });
    return map;
  }, [allBookings, localBooking.packageId]);

  const payments = localBooking.payments || [];
  const financials = useMemo(
    () => computeBookingFinancialTotals(localBooking.totalPrice, payments),
    [localBooking.totalPrice, payments]
  );

  const handleBusSelectChange = (busId: string) => {
    setSelectedBusId(busId);
    const found = packageBuses.find((b) => b.id === busId);
    if (found) {
      setCustomBusName(found.name);
    } else if (!busId) {
      setCustomBusName('');
    }
  };

  const handleSaveBus = async () => {
    setSavingBus(true);
    try {
      const found = packageBuses.find((b) => b.id === selectedBusId);
      const finalBusId = found ? found.id : selectedBusId;
      const finalBusName = found ? found.name : customBusName.trim();

      const res = await updateBookingBusAssignment(localBooking, finalBusId, finalBusName);
      const next: Booking = {
        ...localBooking,
        busId: res.busId,
        busName: res.busName,
      };
      setLocalBooking(next);
      onUpdated(next);
      if (actor) {
        await logAuditEvent({
          action: 'bus_assigned',
          actor,
          targetType: 'booking',
          targetId: localBooking.bookingRef,
          summary: res.busName
            ? `تسكين الحجز ${localBooking.bookingRef} في الحافلة: ${res.busName}`
            : `إلغاء تعيين الحافلة للحجز ${localBooking.bookingRef}`,
          details: `العميل: ${localBooking.customerName}`,
        });
      }
      showToast(
        res.busName
          ? `تم تسكين الحجز في: ${res.busName}`
          : 'تم إلغاء تعيين الحافلة لهذا الحجز',
        'success'
      );
      await onRefresh();
    } catch {
      showToast('تعذر تحديث تسكين الحافلة.', 'error');
    } finally {
      setSavingBus(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amountInput);
    if (!numericAmount || numericAmount <= 0 || Number.isNaN(numericAmount)) {
      showToast('يُرجى إدخال مبلغ صحيح أكبر من صفر.', 'error');
      return;
    }
    if (!dateInput) {
      showToast('يُرجى تحديد تاريخ الدفعة.', 'error');
      return;
    }

    const newPayment: BookingPayment = {
      id: generateSafeId('pay'),
      amount: Math.round(numericAmount * 100) / 100,
      method: methodInput,
      date: dateInput,
      note: noteInput.trim() || undefined,
      recordedBy: currentUserEmail || undefined,
      createdAt: new Date().toISOString(),
    };

    const nextPayments = [...payments, newPayment];
    setSavingPayments(true);
    try {
      const saved = await saveBookingFinancials(localBooking, nextPayments, currentUserEmail);
      const next: Booking = {
        ...localBooking,
        payments: saved.payments,
        paidAmount: saved.paidAmount,
        remainingAmount: saved.remainingAmount,
        paymentStatus: saved.paymentStatus,
      };
      setLocalBooking(next);
      onUpdated(next);
      if (actor) {
        await logAuditEvent({
          action: 'payment_added',
          actor,
          targetType: 'booking',
          targetId: localBooking.bookingRef,
          summary: `تسجيل دفعة مالية (${newPayment.amount} ${localBooking.currency}) للحجز ${localBooking.bookingRef}`,
          details: `الوسيلة: ${PAYMENT_METHOD_LABELS[newPayment.method]} · العميل: ${localBooking.customerName}`,
        });
      }
      setAmountInput('');
      setNoteInput('');
      showToast('تم تسجيل الدفعة وتحديث السجل المالي بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حفظ الدفعة في قاعدة البيانات.', 'error');
    } finally {
      setSavingPayments(false);
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    const removedPayment = payments.find((p) => p.id === paymentId);
    const nextPayments = payments.filter((p) => p.id !== paymentId);
    setSavingPayments(true);
    try {
      const saved = await saveBookingFinancials(localBooking, nextPayments, currentUserEmail);
      const next: Booking = {
        ...localBooking,
        payments: saved.payments,
        paidAmount: saved.paidAmount,
        remainingAmount: saved.remainingAmount,
        paymentStatus: saved.paymentStatus,
      };
      setLocalBooking(next);
      onUpdated(next);
      if (actor) {
        await logAuditEvent({
          action: 'payment_removed',
          actor,
          targetType: 'booking',
          targetId: localBooking.bookingRef,
          summary: `حذف دفعة مالية (${removedPayment ? `${removedPayment.amount} ${localBooking.currency}` : ''}) من الحجز ${localBooking.bookingRef}`,
          details: `العميل: ${localBooking.customerName}`,
        });
      }
      showToast('تم حذف الدفعة وإعادة احتساب الرصيد', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف الدفعة.', 'error');
    } finally {
      setSavingPayments(false);
    }
  };

  const travelersCount =
    localBooking.adultsCount + localBooking.childrenCount + localBooking.infantsCount;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-6 no-print"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-lg text-[#0F332B] flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#0E6E73]" />
              الإدارة المالية وتسكين الحافلة —{' '}
              <span className="font-mono">{localBooking.bookingRef}</span>
            </h2>
            <p className="text-xs text-[#6B7A74] truncate mt-0.5">
              {localBooking.customerName} · {localBooking.packageTitle} · {travelersCount} مسافر
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Financial KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]">
              <p className="text-[11px] text-[#6B7A74]">المبلغ الإجمالي المطلوب</p>
              <p className="font-display text-lg font-extrabold text-[#0F332B] tabular-nums mt-0.5">
                {localBooking.totalPrice.toLocaleString('ar-SA')} {localBooking.currency}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#0E6E73]/30">
              <p className="text-[11px] text-[#6B7A74]">المبلغ المدفوع</p>
              <p className="font-display text-lg font-extrabold text-[#0E6E73] tabular-nums mt-0.5">
                {financials.paidAmount.toLocaleString('ar-SA')} {localBooking.currency}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#B88E3E]/40">
              <p className="text-[11px] text-[#6B7A74]">المبلغ المتبقي</p>
              <p className="font-display text-lg font-extrabold text-[#8C6D2E] tabular-nums mt-0.5">
                {financials.remainingAmount.toLocaleString('ar-SA')} {localBooking.currency}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]">
              <p className="text-[11px] text-[#6B7A74]">حالة الدفع</p>
              <p
                className={`font-display text-sm font-extrabold mt-1.5 flex items-center gap-1.5 ${
                  financials.paymentStatus === 'paid'
                    ? 'text-[#0E6E73]'
                    : financials.paymentStatus === 'partial'
                    ? 'text-[#8C6D2E]'
                    : 'text-red-700'
                }`}
              >
                {financials.paymentStatus === 'paid' && <CheckCircle2 className="w-4 h-4" />}
                {PAYMENT_STATUS_LABELS[financials.paymentStatus]}
              </p>
            </div>
          </div>

          {/* Bus / Group Allocation Box */}
          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm text-[#0F332B] flex items-center gap-2">
                <Bus className="w-4 h-4 text-[#0E6E73]" />
                تسكين المسافرين في الحافلة / الفوج
              </h3>
              {localBooking.busName && (
                <span className="text-xs font-bold text-[#0E6E73]">
                  الحالي: {localBooking.busName}
                </span>
              )}
            </div>

            {packageBuses.length > 0 ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedBusId}
                  onChange={(e) => handleBusSelectChange(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#E6DCCA] text-sm font-medium text-[#0F332B]"
                >
                  <option value="">غير مسكّن في حافلة بعد</option>
                  {packageBuses.map((bus) => {
                    const used = busOccupancyMap.get(bus.id) || 0;
                    return (
                      <option key={bus.id} value={bus.id}>
                        {bus.name} — المشغول {used} / {bus.capacity} راكب
                        {bus.notes ? ` (${bus.notes})` : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  disabled={savingBus}
                  onClick={handleSaveBus}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white whitespace-nowrap shrink-0 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  {savingBus ? 'جارٍ الحفظ...' : 'حفظ الحافلة'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#6B7A74]">
                  لم تُعرَّف حافلات مسبقة لهذه الباقة في صفحة الباقات. يمكنك كتابة اسم الحافلة/الفوج يدوياً أو إضافتها من إدارة الباقات:
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={customBusName}
                    onChange={(e) => {
                      setSelectedBusId('');
                      setCustomBusName(e.target.value);
                    }}
                    placeholder="مثال: باص رقم 1"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#E6DCCA] text-sm"
                  />
                  <button
                    type="button"
                    disabled={savingBus}
                    onClick={handleSaveBus}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap shrink-0 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {savingBus ? 'جارٍ الحفظ...' : 'حفظ الحافلة'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add New Payment Form */}
          <form
            onSubmit={handleAddPayment}
            className="p-5 rounded-2xl bg-white border border-[#E6DCCA] space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm text-[#0F332B] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#B88E3E]" />
                تسجيل دفعة مالية جديدة (عربون / دفعة / سداد كامل)
              </h3>
              {financials.remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountInput(String(financials.remainingAmount))}
                  className="text-xs font-bold text-[#0E6E73] hover:underline"
                >
                  تعبئة المتبقي بالكامل ({financials.remainingAmount.toLocaleString('ar-SA')})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">المبلغ ({localBooking.currency}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono tabular-nums"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">وسيلة الدفع *</label>
                <select
                  value={methodInput}
                  onChange={(e) => setMethodInput(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">تاريخ الدفعة *</label>
                <input
                  type="date"
                  required
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">ملاحظة (اختياري)</label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="عربون / دفعة ثانية"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPayments}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {savingPayments ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة الدفعة للسجل
              </button>
            </div>
          </form>

          {/* Recorded Payments History */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-sm text-[#0F332B]">
              سجل الدفعات المسجلة ({payments.length})
            </h3>
            {payments.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-[#6B7A74]">
                لم تُسجَّل أي دفعات مالية لهذا الحجز حتى الآن.
              </div>
            ) : (
              <div className="border border-[#E6DCCA] rounded-xl overflow-hidden">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#FAF7F0] text-[#556660] border-b border-[#E6DCCA]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">التاريخ</th>
                      <th className="py-2.5 px-3 font-semibold">المبلغ</th>
                      <th className="py-2.5 px-3 font-semibold">وسيلة الدفع</th>
                      <th className="py-2.5 px-3 font-semibold">ملاحظة</th>
                      <th className="py-2.5 px-3 font-semibold text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E9DC]">
                    {payments.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-[#FAF7F0]/60">
                        <td className="py-2.5 px-3 font-mono text-[#6B7A74]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{p.date}</td>
                        <td className="py-2.5 px-3 font-bold text-[#0E6E73] tabular-nums">
                          {p.amount.toLocaleString('ar-SA')} {localBooking.currency}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </td>
                        <td className="py-2.5 px-3 text-[#556660]">{p.note || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={savingPayments}
                            onClick={() => handleRemovePayment(p.id)}
                            className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-50"
                            title="حذف الدفعة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
