import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Printer,
  Eye,
  X,
  FileCheck,
  Loader2,
  Save,
  Trash2,
  FileSpreadsheet,
  Wallet,
  Bus,
} from 'lucide-react';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type BookingAttachment,
  type BookingStatus,
  type FormTemplate,
  type SiteSettings,
  type TravelPackage,
} from '../../types';
import {
  computeBookingFinancialTotals,
  deleteBookingAdmin,
  fetchBookingAttachmentsAdmin,
  updateBookingStatusAndNotes,
} from '../../services/firestoreService';
import {
  exportBookingsToExcel,
  formatFirestoreDate,
} from '../../utils/exportUtils';
import { useToast } from '../ToastProvider';
import { InvoicePrintModal } from '../InvoicePrintModal';
import { ManifestExportModal } from './ManifestExportModal';
import { BookingFinancialModal } from './BookingFinancialModal';

interface BookingsManagerProps {
  bookings: Booking[];
  packages: TravelPackage[];
  forms: FormTemplate[];
  settings: SiteSettings;
  isSuperAdmin: boolean;
  currentUserEmail?: string;
  onRefresh: () => Promise<void>;
}

const STATUS_FILTERS: Array<{ value: 'all' | BookingStatus; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'pending_review', label: 'قيد المراجعة' },
  { value: 'awaiting_payment', label: 'بانتظار الدفع' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'cancelled', label: 'ملغي' },
];

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  bookings,
  packages,
  forms,
  settings,
  isSuperAdmin,
  currentUserEmail,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [packageFilter, setPackageFilter] = useState('all');

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [attachments, setAttachments] = useState<BookingAttachment[]>([]);
  const [loadingAtts, setLoadingAtts] = useState(false);

  const [editStatus, setEditStatus] = useState<BookingStatus>('pending_review');
  const [editInternalNotes, setEditInternalNotes] = useState('');
  const [editPublicNote, setEditPublicNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [financialBooking, setFinancialBooking] = useState<Booking | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);

  const packageMap = useMemo(() => {
    const map = new Map<string, TravelPackage>();
    packages.forEach((p) => map.set(p.id, p));
    return map;
  }, [packages]);

  const formMap = useMemo(() => {
    const map = new Map<string, FormTemplate>();
    forms.forEach((f) => map.set(f.id, f));
    return map;
  }, [forms]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (packageFilter !== 'all' && b.packageId !== packageFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${b.bookingRef} ${b.customerName} ${b.customerPhone} ${b.packageTitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, packageFilter, search]);

  const selectedBookings = useMemo(
    () => bookings.filter((b) => selectedIds.includes(b.id)),
    [bookings, selectedIds]
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((b) => selectedIds.includes(b.id));

  const toggleSelectBooking = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filtered.map((b) => b.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((b) => next.add(b.id));
      setSelectedIds(Array.from(next));
    }
  };

  const openDetail = async (b: Booking) => {
    setSelectedBooking(b);
    setEditStatus(b.status);
    setEditInternalNotes(b.internalNotes || '');
    setEditPublicNote(b.publicStatusNote || '');
    setConfirmDelete(false);
    setAttachments([]);
    setLoadingAtts(true);
    try {
      const atts = await fetchBookingAttachmentsAdmin(b.id);
      setAttachments(atts);
    } catch {
      setAttachments([]);
    } finally {
      setLoadingAtts(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!selectedBooking) return;
    setSaving(true);
    try {
      await updateBookingStatusAndNotes(
        selectedBooking,
        editStatus,
        editInternalNotes,
        editPublicNote
      );
      showToast('تم تحديث حالة الحجز ومزامنة صفحة متابعة العميل بنجاح', 'success');
      setSelectedBooking({
        ...selectedBooking,
        status: editStatus,
        internalNotes: editInternalNotes,
        publicStatusNote: editPublicNote,
      });
      await onRefresh();
    } catch {
      showToast('تعذر حفظ التحديث. قد يكون الحجز ملغياً ولا يملك تعديله إلا المدير العام.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    try {
      await deleteBookingAdmin(selectedBooking);
      setSelectedBooking(null);
      showToast('تم حذف الحجز نهائياً', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف الحجز.', 'error');
    }
  };

  const downloadAttachment = (att: BookingAttachment) => {
    const link = document.createElement('a');
    link.href = att.dataUrl;
    link.download = att.fileName || `attachment_${att.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedForm = selectedBooking ? formMap.get(selectedBooking.formTemplateId) : null;
  const selectedFieldLabels = new Map<string, string>();
  selectedForm?.fields.forEach((f) => selectedFieldLabels.set(f.id, f.label));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            إدارة الحجوزات والعملاء
          </h1>
          <p className="text-sm text-[#556660]">
            استعرض بيانات المسافرين ومرفقات الجوازات، غيّر حالة الطلبات، وخصّص كشوفات المسافرين الرسمية بصيغة PDF أو Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {selectedBookings.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white border border-[#E6DCCA] text-[#556660] hover:text-[#0F332B] whitespace-nowrap"
            >
              إلغاء التحديد ({selectedBookings.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setManifestModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#E8C97E]" />
            {selectedBookings.length > 0
              ? `تصدير كشف المسافرين للمختارة (${selectedBookings.length})`
              : `تصدير كشف المسافرين (${filtered.length})`}
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] p-4 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] overflow-x-auto">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === st.value
                    ? 'bg-[#0F332B] text-white'
                    : 'text-[#556660] hover:text-[#0F332B]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
            <div className="relative min-w-[220px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-[#6B7A74] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالمرجع أو الاسم أو الجوال..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
              />
            </div>

            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
            >
              <option value="all">جميع الباقات</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bookings CRM Table */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden no-print">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#556660]">
            لا توجد حجوزات مطابقة لمعايير التصفية الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                <tr>
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="تحديد جميع الحجوزات الظاهرة"
                      className="w-4 h-4 accent-[#0F332B] cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4 font-semibold">المرجع</th>
                  <th className="py-3.5 px-4 font-semibold">صاحب الحجز</th>
                  <th className="py-3.5 px-4 font-semibold">الباقة والحافلة</th>
                  <th className="py-3.5 px-4 font-semibold">المسافرون</th>
                  <th className="py-3.5 px-4 font-semibold">المالية والسداد</th>
                  <th className="py-3.5 px-4 font-semibold">الحالة</th>
                  <th className="py-3.5 px-4 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DC]">
                {filtered.map((b) => {
                  const isChecked = selectedIds.includes(b.id);
                  const fin = computeBookingFinancialTotals(b.totalPrice, b.payments || []);
                  const effectivePaid = typeof b.paidAmount === 'number' ? b.paidAmount : fin.paidAmount;
                  const effectiveStatus = b.paymentStatus || fin.paymentStatus;
                  return (
                  <tr
                    key={b.id}
                    className={`transition-colors ${
                      isChecked ? 'bg-[#0F332B]/5' : 'hover:bg-[#FAF7F0]/60'
                    }`}
                  >
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectBooking(b.id)}
                        aria-label={`تحديد الحجز ${b.bookingRef}`}
                        className="w-4 h-4 accent-[#0F332B] cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#0F332B] tabular-nums">
                      {b.bookingRef}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-[#142621]">{b.customerName}</p>
                      <p className="text-xs font-mono text-[#6B7A74] tabular-nums" dir="ltr">
                        {b.customerPhone}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-[#0F332B]">{b.packageTitle}</p>
                      <p className="text-xs text-[#6B7A74]">{b.departureDate}</p>
                      {b.busName && (
                        <p className="text-[11px] font-semibold text-[#0E6E73] inline-flex items-center gap-1 mt-0.5">
                          <Bus className="w-3 h-3" />
                          {b.busName}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs tabular-nums">
                      {b.adultsCount + b.childrenCount + b.infantsCount} مسافر
                    </td>
                    <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                      <p className="font-bold text-[#0F332B]">
                        {b.totalPrice.toLocaleString('ar-SA')} {b.currency}
                      </p>
                      <p className="text-[11px] text-[#556660]">
                        مدفوع: <strong className="text-[#0E6E73]">{effectivePaid.toLocaleString('ar-SA')}</strong> ·{' '}
                        <span
                          className={
                            effectiveStatus === 'paid'
                              ? 'text-[#0E6E73] font-bold'
                              : effectiveStatus === 'partial'
                              ? 'text-[#8C6D2E] font-bold'
                              : 'text-red-700 font-semibold'
                          }
                        >
                          {PAYMENT_STATUS_LABELS[effectiveStatus]}
                        </span>
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold">
                      <span
                        className={
                          b.status === 'confirmed'
                            ? 'text-[#0E6E73]'
                            : b.status === 'cancelled'
                            ? 'text-red-700'
                            : 'text-[#8C6D2E]'
                        }
                      >
                        {BOOKING_STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFinancialBooking(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0E6E73] whitespace-nowrap"
                          title="إدارة المدفوعات وتسكين الحافلة"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          المالية والحافلة
                        </button>
                        <button
                          type="button"
                          onClick={() => openDetail(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          التفاصيل
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintBooking(b)}
                          className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
                          title="طباعة الفاتورة والكشف PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Detail & Attachments Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-6 no-print">
          <div className="bg-white w-full max-w-4xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-6">
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-extrabold text-lg text-[#0F332B]">
                  تفاصيل الحجز — <span className="font-mono">{selectedBooking.bookingRef}</span>
                </h2>
                <p className="text-xs text-[#6B7A74]">
                  تاريخ التسجيل: {formatFirestoreDate(selectedBooking.createdAt)} · {selectedBooking.packageTitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFinancialBooking(selectedBooking)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#0F332B] text-white hover:opacity-90"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#E8C97E]" />
                  المدفوعات والحافلة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportBookingsToExcel(
                      [selectedBooking],
                      forms,
                      `كشف_حجز_${selectedBooking.bookingRef}.xlsx`
                    );
                    showToast('تم تصدير كشف المسافرين إلى Excel', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-[#E6DCCA] text-[#0F332B] hover:bg-[#EFE7D8]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => setPrintBooking(selectedBooking)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-[#E6DCCA] text-[#0F332B] hover:bg-[#EFE7D8]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
              {/* Status Update & Notes Panel */}
              <div className="p-5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0F332B]">حالة الحجز</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as BookingStatus)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E6DCCA] text-sm font-bold text-[#0F332B]"
                    >
                      {Object.entries(BOOKING_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-[#0F332B]">
                      رسالة للعميل (تظهر له في صفحة متابعة الحجز)
                    </label>
                    <input
                      type="text"
                      value={editPublicNote}
                      onChange={(e) => setEditPublicNote(e.target.value)}
                      placeholder="مثال: يرجى تحويل مبلغ الباقة على حساب المكتب وإرسال الإيصال"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E6DCCA] text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    ملاحظات داخلية للموظفين فقط (لا تظهر للعميل)
                  </label>
                  <textarea
                    rows={2}
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                    placeholder="سجّل ملاحظات التذاكر أو الفندق أو متابعة الدفع..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E6DCCA] text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {isSuperAdmin ? (
                    confirmDelete ? (
                      <button
                        type="button"
                        onClick={handleDeleteBooking}
                        className="px-3.5 py-2 rounded-xl bg-red-700 text-white text-xs font-bold"
                      >
                        تأكيد حذف الحجز نهائياً
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف الحجز
                      </button>
                    )
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveStatus}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    حفظ الحالة والملاحظات
                  </button>
                </div>
              </div>

              {/* Customer Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-xl border border-[#E6DCCA]">
                  <p className="text-xs text-[#6B7A74]">صاحب الحجز</p>
                  <p className="font-bold text-[#0F332B]">{selectedBooking.customerName}</p>
                  <p className="font-mono text-xs text-[#374B45]" dir="ltr">
                    {selectedBooking.customerPhone}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[#E6DCCA]">
                  <p className="text-xs text-[#6B7A74]">المسافرون</p>
                  <p className="font-bold text-[#0F332B] tabular-nums">
                    {selectedBooking.adultsCount} بالغ · {selectedBooking.childrenCount} طفل ·{' '}
                    {selectedBooking.infantsCount} رضيع
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[#E6DCCA]">
                  <p className="text-xs text-[#6B7A74]">المبلغ الإجمالي</p>
                  <p className="font-display text-lg font-extrabold text-[#0F332B] tabular-nums">
                    {selectedBooking.totalPrice.toLocaleString('ar-SA')} {selectedBooking.currency}
                  </p>
                </div>
              </div>

              {/* Travelers Dynamic Responses */}
              <div className="space-y-3">
                <h3 className="font-display font-bold text-base text-[#0F332B]">
                  بيانات المسافرين ({selectedBooking.travelers.length})
                </h3>
                <div className="space-y-3">
                  {selectedBooking.travelers.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#E6DCCA] bg-white space-y-2"
                    >
                      <p className="font-display font-bold text-sm text-[#0E6E73]">{t.label}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        {Object.entries(t.answers || {}).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-[#6B7A74]">
                              {selectedFieldLabels.get(k) || k}:{' '}
                            </span>
                            <span className="font-semibold text-[#142621]">
                              {Array.isArray(v) ? v.join('، ') : String(v || '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uploaded Passport / ID Attachments */}
              <div className="space-y-3">
                <h3 className="font-display font-bold text-base text-[#0F332B]">
                  المرفقات والوثائق المرفوعة (الجوازات / الهويات)
                </h3>
                {loadingAtts ? (
                  <div className="flex items-center gap-2 text-xs text-[#6B7A74]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ تحميل المرفقات...
                  </div>
                ) : attachments.length === 0 ? (
                  <p className="text-xs text-[#6B7A74]">لا توجد مرفقات مرفوعة مع هذا الحجز.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3.5 rounded-xl border border-[#E6DCCA] bg-[#FAF7F0] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {att.mimeType.startsWith('image/') ? (
                            <img
                              src={att.dataUrl}
                              alt={att.fileName}
                              className="w-14 h-14 rounded-lg object-cover border border-[#E6DCCA] shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-white border border-[#E6DCCA] flex items-center justify-center text-[#0F332B] shrink-0">
                              <FileCheck className="w-6 h-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0F332B] truncate">
                              مسافر #{att.travelerIndex + 1} · {att.fieldLabel}
                            </p>
                            <p className="text-[11px] text-[#6B7A74] truncate">{att.fileName}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => downloadAttachment(att)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F332B] text-white text-xs font-semibold shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          تحميل
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {printBooking && (
        <InvoicePrintModal
          booking={printBooking}
          formTemplate={formMap.get(printBooking.formTemplateId) || null}
          settings={settings}
          onClose={() => setPrintBooking(null)}
        />
      )}

      {manifestModalOpen && (
        <ManifestExportModal
          allBookings={bookings}
          filteredBookings={filtered}
          selectedBookings={selectedBookings}
          packages={packages}
          forms={forms}
          settings={settings}
          initialPackageId={packageFilter}
          onClose={() => setManifestModalOpen(false)}
        />
      )}

      {financialBooking && (
        <BookingFinancialModal
          booking={financialBooking}
          allBookings={bookings}
          pkg={packageMap.get(financialBooking.packageId)}
          currentUserEmail={currentUserEmail}
          onUpdated={(updated) => {
            setFinancialBooking(updated);
            if (selectedBooking && selectedBooking.id === updated.id) {
              setSelectedBooking(updated);
            }
          }}
          onRefresh={onRefresh}
          onClose={() => setFinancialBooking(null)}
        />
      )}
    </div>
  );
};
