import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Plus,
  Minus,
  Upload,
  CheckCircle2,
  Copy,
  Printer,
  FileCheck,
  Loader2,
  Trash2,
} from 'lucide-react';
import type {
  Booking,
  FormTemplate,
  SiteSettings,
  TravelerRecord,
  TravelPackage,
} from '../types';
import {
  compressFileToDataUrl,
  generateBookingRef,
  normalizePhone,
} from '../utils/imageCompress';
import {
  submitCustomerBooking,
  type PendingAttachmentUpload,
} from '../services/firestoreService';
import { useToast } from './ToastProvider';
import { InvoicePrintModal } from './InvoicePrintModal';

interface DynamicBookingViewProps {
  pkg: TravelPackage;
  formTemplate: FormTemplate;
  settings: SiteSettings;
  isLiveInDb: boolean;
  onBack: () => void;
  onGoToTrack: (prefillRef?: string, prefillPhone?: string) => void;
  onOpenAdmin: () => void;
}

interface TravelerSlot {
  index: number;
  category: 'adult' | 'child' | 'infant';
  label: string;
}

export const DynamicBookingView: React.FC<DynamicBookingViewProps> = ({
  pkg,
  formTemplate,
  settings,
  isLiveInDb,
  onBack,
  onGoToTrack,
  onOpenAdmin,
}) => {
  const { showToast } = useToast();

  // Primary contact info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Traveler counts
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [selectedBusId, setSelectedBusId] = useState('');

  // Dynamic field values keyed by travelerIndex -> fieldId -> string | string[]
  const [answersByTraveler, setAnswersByTraveler] = useState<
    Record<number, Record<string, string | string[]>>
  >({});

  // Uploaded file attachments keyed by `${travelerIndex}_${fieldId}`
  const [attachmentsMap, setAttachmentsMap] = useState<
    Record<string, PendingAttachmentUpload>
  >({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const availableBuses = pkg.buses || [];
  const selectedBus = availableBuses.find((b) => b.id === selectedBusId) || null;

  const travelerSlots = useMemo<TravelerSlot[]>(() => {
    const slots: TravelerSlot[] = [];
    for (let i = 0; i < adultsCount; i++) {
      slots.push({
        index: slots.length,
        category: 'adult',
        label: `المسافر ${slots.length + 1} — بالغ`,
      });
    }
    for (let i = 0; i < childrenCount; i++) {
      slots.push({
        index: slots.length,
        category: 'child',
        label: `المسافر ${slots.length + 1} — طفل`,
      });
    }
    for (let i = 0; i < infantsCount; i++) {
      slots.push({
        index: slots.length,
        category: 'infant',
        label: `المسافر ${slots.length + 1} — رضيع`,
      });
    }
    return slots;
  }, [adultsCount, childrenCount, infantsCount]);

  const totalPrice = useMemo(() => {
    return (
      adultsCount * pkg.price +
      childrenCount * pkg.childPrice +
      infantsCount * pkg.infantPrice
    );
  }, [adultsCount, childrenCount, infantsCount, pkg]);

  const setFieldValue = (travelerIndex: number, fieldId: string, value: string | string[]) => {
    setAnswersByTraveler((prev) => ({
      ...prev,
      [travelerIndex]: {
        ...(prev[travelerIndex] || {}),
        [fieldId]: value,
      },
    }));
  };

  const toggleMultiselectOption = (travelerIndex: number, fieldId: string, option: string) => {
    const current = answersByTraveler[travelerIndex]?.[fieldId];
    const list = Array.isArray(current) ? current : [];
    const next = list.includes(option) ? list.filter((o) => o !== option) : [...list, option];
    setFieldValue(travelerIndex, fieldId, next);
  };

  const handleFileUpload = async (
    travelerIndex: number,
    fieldId: string,
    fieldLabel: string,
    file: File | null
  ) => {
    if (!file) return;
    const key = `${travelerIndex}_${fieldId}`;
    setUploadingKey(key);
    try {
      const compressed = await compressFileToDataUrl(file);
      setAttachmentsMap((prev) => ({
        ...prev,
        [key]: {
          travelerIndex,
          fieldId,
          fieldLabel,
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          dataUrl: compressed.dataUrl,
        },
      }));
      setFieldValue(travelerIndex, fieldId, compressed.fileName);
      showToast(`تم تجهيز المرفق (${compressed.fileName}) بنجاح`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر معالجة الملف المرفوع', 'error');
    } finally {
      setUploadingKey(null);
    }
  };

  const removeAttachment = (travelerIndex: number, fieldId: string) => {
    const key = `${travelerIndex}_${fieldId}`;
    setAttachmentsMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setFieldValue(travelerIndex, fieldId, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || customerName.trim().length < 2) {
      showToast('يُرجى إدخال اسم صاحب الحجز بشكل صحيح.', 'error');
      return;
    }

    const cleanPhone = normalizePhone(customerPhone);
    if (cleanPhone.length < 8) {
      showToast('يُرجى إدخال رقم جوال صحيح (8 أرقام على الأقل).', 'error');
      return;
    }

    if (!agreedTerms) {
      showToast('يُرجى الموافقة على الشروط والأحكام لإتمام الحجز.', 'error');
      return;
    }

    // Validate dynamic required fields for every traveler
    for (const slot of travelerSlots) {
      const answers = answersByTraveler[slot.index] || {};
      for (const field of formTemplate.fields) {
        if (!field.required) continue;
        const val = answers[field.id];
        if (field.type === 'file') {
          if (!attachmentsMap[`${slot.index}_${field.id}`]) {
            showToast(`يُرجى رفع "${field.label}" لـ (${slot.label}).`, 'error');
            return;
          }
        } else if (field.type === 'multiselect') {
          if (!Array.isArray(val) || val.length === 0) {
            showToast(`يُرجى اختيار "${field.label}" لـ (${slot.label}).`, 'error');
            return;
          }
        } else if (!val || String(val).trim() === '') {
          showToast(`يُرجى تعبئة الحقل الإجباري "${field.label}" لـ (${slot.label}).`, 'error');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const bookingRef = generateBookingRef();
      const travelers: TravelerRecord[] = travelerSlots.map((slot) => ({
        index: slot.index,
        category: slot.category,
        label: slot.label,
        answers: answersByTraveler[slot.index] || {},
      }));

      // Only include attachments belonging to currently active traveler slots
      const activeAttachments = Object.values(attachmentsMap).filter(
        (att) => att.travelerIndex < travelerSlots.length
      );

      if (!isLiveInDb) {
        showToast(
          'قاعدة البيانات بانتظار التهيئة الأولى من بوابة الإدارة. يُرجى تسجيل الدخول كمشرف لتهيئة الباقات أولاً.',
          'error'
        );
        setSubmitting(false);
        return;
      }

      const result = await submitCustomerBooking(
        {
          bookingRef,
          packageId: pkg.id,
          packageTitle: pkg.title,
          departureDate: pkg.departureDate,
          formTemplateId: formTemplate.id,
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          customerEmail: customerEmail.trim(),
          adultsCount,
          childrenCount,
          infantsCount,
          totalPrice,
          currency: pkg.currency,
          busId: selectedBus?.id || '',
          busName: selectedBus?.name || '',
          travelers,
          customerNotes: customerNotes.trim(),
        },
        activeAttachments
      );

      setConfirmedBooking({
        id: result.bookingId,
        bookingRef: result.bookingRef,
        trackerId: result.trackerId,
        packageId: pkg.id,
        packageTitle: pkg.title,
        departureDate: pkg.departureDate,
        formTemplateId: formTemplate.id,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim(),
        adultsCount,
        childrenCount,
        infantsCount,
        totalPrice,
        currency: pkg.currency,
        busId: selectedBus?.id || '',
        busName: selectedBus?.name || '',
        paidAmount: 0,
        remainingAmount: totalPrice,
        paymentStatus: 'unpaid',
        payments: [],
        travelers,
        customerNotes: customerNotes.trim(),
        internalNotes: '',
        publicStatusNote: '',
        status: 'pending_review',
        createdAt: new Date(),
      });

      showToast(`تم تسجيل حجزك بنجاح! الرقم المرجعي: ${result.bookingRef}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('تعذر إرسال الحجز حالياً، يُرجى التحقق من البيانات والمحاولة مرة أخرى.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmed Booking Receipt Screen
  if (confirmedBooking) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-[#E6DCCA] p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#0F332B] text-[#E8C97E] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F332B]">
              تم استلام طلب حجزك بنجاح
            </h1>
            <p className="text-sm sm:text-base text-[#556660] max-w-lg mx-auto leading-relaxed">
              شكراً لاختيارك {settings.agencyName} {settings.agencySubtitle}. احتفظ بالرقم المرجعي أدناه لمتابعة حالة طلبك في أي وقت.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] inline-flex flex-col items-center gap-2 min-w-[260px]">
            <span className="text-xs text-[#6B7A74]">الرقم المرجعي للحجز</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-bold text-[#0F332B] tabular-nums tracking-wider">
                {confirmedBooking.bookingRef}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(confirmedBooking.bookingRef);
                  showToast('تم نسخ الرقم المرجعي', 'info');
                }}
                className="p-2 rounded-lg bg-white border border-[#E6DCCA] text-[#0F332B] hover:bg-[#EFE7D8]"
                title="نسخ الرقم المرجعي"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs text-[#0E6E73] font-medium">
              الحالة الحالية: قيد المراجعة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-right text-sm pt-2 border-t border-[#F0E9DC]">
            <div>
              <p className="text-xs text-[#6B7A74]">الباقة</p>
              <p className="font-bold text-[#0F332B]">{confirmedBooking.packageTitle}</p>
              {confirmedBooking.busName && (
                <p className="text-xs text-[#0E6E73] font-medium mt-0.5">
                  الحافلة / الفوج: {confirmedBooking.busName}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#6B7A74]">عدد المسافرين</p>
              <p className="font-bold text-[#0F332B] tabular-nums">
                {confirmedBooking.adultsCount + confirmedBooking.childrenCount + confirmedBooking.infantsCount} مسافر
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7A74]">الإجمالي</p>
              <p className="font-bold text-[#0F332B] tabular-nums">
                {confirmedBooking.totalPrice.toLocaleString('ar-SA')} {confirmedBooking.currency}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() =>
                onGoToTrack(confirmedBooking.bookingRef, confirmedBooking.customerPhone)
              }
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              متابعة حالة الحجز الآن
            </button>
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[#0F332B] bg-[#FAF7F0] border border-[#E6DCCA] hover:bg-[#EFE7D8]"
            >
              <Printer className="w-4 h-4" />
              طباعة الفاتورة / PDF
            </button>
          </div>
        </div>

        {showInvoiceModal && (
          <InvoicePrintModal
            booking={confirmedBooking}
            formTemplate={formTemplate}
            settings={settings}
            onClose={() => setShowInvoiceModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#374B45] hover:text-[#0F332B] mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى تفاصيل الباقة
      </button>

      <div className="mb-8 space-y-1.5">
        <p className="text-xs font-semibold text-[#8C6D2E]">
          نموذج الحجز الإلكتروني · {formTemplate.name}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F332B]">
          إتمام حجز: {pkg.title}
        </h1>
      </div>

      {!isLiveInDb && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FAF7F0] border border-[#B88E3E]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <p className="text-[#0F332B]">
            <strong>تهيئة قاعدة البيانات لأول مرة:</strong> سجّل الدخول مرة واحدة إلى بوابة الإدارة لتفعيل حفظ الباقات والحجوزات الحية تلقائياً في Firestore.
          </p>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            فتح بوابة الإدارة
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Body */}
        <div className="lg:col-span-8 space-y-8">
          {/* Step 1: Primary Contact & Traveler Count */}
          <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-6">
            <h2 className="font-display text-lg font-extrabold text-[#0F332B]">
              1. بيانات التواصل وعدد المسافرين
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#142621]">
                  اسم صاحب الحجز <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="الاسم الثلاثي أو الرباعي"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm focus:border-[var(--brand-secondary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#142621]">
                  رقم الجوال (للتواصل ومتابعة الحجز) <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-right font-mono focus:border-[var(--brand-secondary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-sm font-medium text-[#142621]">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-right focus:border-[var(--brand-secondary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Traveler Counters */}
            <div className="pt-4 border-t border-[#F0E9DC]">
              <p className="text-sm font-bold text-[#0F332B] mb-4">
                حدد عدد المسافرين (سيتم تكرار الحقول المطلوبة تلقائياً لكل مسافر)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    title: 'بالغين',
                    sub: `${pkg.price} ${pkg.currency}`,
                    count: adultsCount,
                    min: 1,
                    max: 15,
                    set: setAdultsCount,
                  },
                  {
                    title: 'أطفال (2–11 سنة)',
                    sub: `${pkg.childPrice} ${pkg.currency}`,
                    count: childrenCount,
                    min: 0,
                    max: 15,
                    set: setChildrenCount,
                  },
                  {
                    title: 'رضع (أقل من سنتين)',
                    sub: `${pkg.infantPrice} ${pkg.currency}`,
                    count: infantsCount,
                    min: 0,
                    max: 10,
                    set: setInfantsCount,
                  },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#0F332B]">{c.title}</p>
                      <p className="text-xs text-[#6B7A74] tabular-nums">{c.sub}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => c.set(Math.max(c.min, c.count - 1))}
                        disabled={c.count <= c.min}
                        className="w-8 h-8 rounded-lg bg-white border border-[#E6DCCA] flex items-center justify-center text-[#0F332B] disabled:opacity-40"
                        aria-label={`تقليل ${c.title}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-sm tabular-nums">
                        {c.count}
                      </span>
                      <button
                        type="button"
                        onClick={() => c.set(Math.min(c.max, c.count + 1))}
                        disabled={c.count >= c.max}
                        className="w-8 h-8 rounded-lg bg-white border border-[#E6DCCA] flex items-center justify-center text-[#0F332B] disabled:opacity-40"
                        aria-label={`زيادة ${c.title}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {availableBuses.length > 0 && (
              <div className="pt-4 border-t border-[#F0E9DC] space-y-2">
                <label className="block text-sm font-bold text-[#0F332B]">
                  اختيار الحافلة / الفوج (اختياري)
                </label>
                <select
                  value={selectedBusId}
                  onChange={(e) => setSelectedBusId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-[#142621] focus:border-[var(--brand-secondary)] focus:outline-none"
                >
                  <option value="">تسكين تلقائي بواسطة إدارة المكتب</option>
                  {availableBuses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.name} (سعة {bus.capacity} راكب){bus.notes ? ` — ${bus.notes}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* Step 2: Dynamic Repeated Traveler Forms */}
          <div className="space-y-6">
            {travelerSlots.map((slot) => {
              const answers = answersByTraveler[slot.index] || {};
              return (
                <section
                  key={slot.index}
                  className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E9DC]">
                    <h3 className="font-display text-base font-extrabold text-[#0F332B]">
                      {slot.label}
                    </h3>
                    <span className="text-xs text-[#6B7A74]">
                      {formTemplate.fields.length} حقول مطلوبة / اختيارية
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {formTemplate.fields.map((field) => {
                      const val = answers[field.id];
                      const attKey = `${slot.index}_${field.id}`;
                      const uploaded = attachmentsMap[attKey];
                      const isWide = field.type === 'file' || field.type === 'multiselect';

                      return (
                        <div key={field.id} className={`space-y-1.5 ${isWide ? 'sm:col-span-2' : ''}`}>
                          <label className="block text-sm font-medium text-[#142621]">
                            {field.label}
                            {field.required && <span className="text-red-600 mr-1">*</span>}
                          </label>

                          {field.type === 'text' && (
                            <input
                              type="text"
                              required={field.required}
                              value={typeof val === 'string' ? val : ''}
                              onChange={(e) => setFieldValue(slot.index, field.id, e.target.value)}
                              placeholder={field.placeholder || ''}
                              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm focus:border-[var(--brand-secondary)] focus:outline-none"
                            />
                          )}

                          {field.type === 'number' && (
                            <input
                              type="text"
                              inputMode="numeric"
                              required={field.required}
                              value={typeof val === 'string' ? val : ''}
                              onChange={(e) => setFieldValue(slot.index, field.id, e.target.value)}
                              placeholder={field.placeholder || ''}
                              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono tabular-nums focus:border-[var(--brand-secondary)] focus:outline-none"
                            />
                          )}

                          {field.type === 'date' && (
                            <input
                              type="date"
                              required={field.required}
                              value={typeof val === 'string' ? val : ''}
                              onChange={(e) => setFieldValue(slot.index, field.id, e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm focus:border-[var(--brand-secondary)] focus:outline-none"
                            />
                          )}

                          {field.type === 'select' && (
                            <select
                              required={field.required}
                              value={typeof val === 'string' ? val : ''}
                              onChange={(e) => setFieldValue(slot.index, field.id, e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm focus:border-[var(--brand-secondary)] focus:outline-none"
                            >
                              <option value="">اختر من القائمة...</option>
                              {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}

                          {field.type === 'radio' && (
                            <div className="flex flex-wrap gap-3 pt-1">
                              {(field.options || []).map((opt) => {
                                const selected = val === opt;
                                return (
                                  <label
                                    key={opt}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                                      selected
                                        ? 'bg-[#0F332B] text-white border-[#0F332B]'
                                        : 'bg-[#FAF7F0] text-[#142621] border-[#E6DCCA] hover:border-[#0E6E73]'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`radio_${slot.index}_${field.id}`}
                                      checked={selected}
                                      onChange={() => setFieldValue(slot.index, field.id, opt)}
                                      className="sr-only"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {field.type === 'multiselect' && (
                            <div className="flex flex-wrap gap-2.5 pt-1">
                              {(field.options || []).map((opt) => {
                                const arr = Array.isArray(val) ? val : [];
                                const checked = arr.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => toggleMultiselectOption(slot.index, field.id, opt)}
                                    className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors ${
                                      checked
                                        ? 'bg-[#0E6E73] text-white border-[#0E6E73]'
                                        : 'bg-[#FAF7F0] text-[#374B45] border-[#E6DCCA] hover:border-[#0E6E73]'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {field.type === 'file' && (
                            <div className="pt-1">
                              {uploaded ? (
                                <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#FAF7F0] border border-[#0E6E73]/40">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {uploaded.mimeType.startsWith('image/') ? (
                                      <img
                                        src={uploaded.dataUrl}
                                        alt={uploaded.fileName}
                                        className="w-12 h-12 rounded-lg object-cover border border-[#E6DCCA] shrink-0"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-[#0F332B]/10 flex items-center justify-center text-[#0F332B] shrink-0">
                                        <FileCheck className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-[#0F332B] truncate">
                                        {uploaded.fileName}
                                      </p>
                                      <p className="text-xs text-[#0E6E73]">تم تجهيز المرفق بنجاح</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(slot.index, field.id)}
                                    className="p-2 rounded-lg text-red-700 hover:bg-red-50 transition-colors"
                                    aria-label="حذف الملف"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#D8CBB3] bg-[#FAF7F0] hover:border-[#0E6E73] cursor-pointer transition-colors text-center">
                                  {uploadingKey === attKey ? (
                                    <Loader2 className="w-5 h-5 text-[#0E6E73] animate-spin" />
                                  ) : (
                                    <Upload className="w-5 h-5 text-[#0E6E73]" />
                                  )}
                                  <span className="text-sm font-medium text-[#0F332B]">
                                    {uploadingKey === attKey
                                      ? 'جارٍ ضغط وتجهيز الملف...'
                                      : 'اضغط لاختيار صورة الجواز / الهوية أو ملف PDF'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={(e) =>
                                      handleFileUpload(
                                        slot.index,
                                        field.id,
                                        field.label,
                                        e.target.files?.[0] || null
                                      )
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          )}

                          {field.helpText && (
                            <p className="text-xs text-[#6B7A74]">{field.helpText}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Step 3: Additional Notes & Terms */}
          <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-lg font-extrabold text-[#0F332B]">
              ملاحظات إضافية والشروط والأحكام
            </h2>
            <textarea
              rows={3}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="هل لديك طلبات إضافية مثل غرف متجاورة أو نقطة ركوب محددة؟"
              className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm focus:border-[var(--brand-secondary)] focus:outline-none"
            />
            <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-[#556660] whitespace-pre-line max-h-36 overflow-y-auto leading-relaxed">
              {settings.termsAndConditions}
            </div>
            <label className="flex items-center gap-3 text-sm text-[#142621] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="w-4 h-4 rounded accent-[#0F332B]"
              />
              <span>أقر بصحة جميع بيانات المسافرين وأوافق على شروط وأحكام {settings.agencyName}.</span>
            </label>
          </section>
        </div>

        {/* Sticky Live Summary Sidebar */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-[#E6DCCA] p-6 space-y-5">
            <h3 className="font-display text-lg font-extrabold text-[#0F332B] pb-3 border-b border-[#F0E9DC]">
              ملخص الحجز والسعر
            </h3>

            <div className="space-y-2 text-sm">
              <p className="font-bold text-[#0F332B]">{pkg.title}</p>
              <p className="text-xs text-[#6B7A74]">
                {pkg.destination} · {pkg.durationLabel} · {pkg.departureDate}
              </p>
              {selectedBus && (
                <p className="text-xs font-semibold text-[#0E6E73]">
                  الحافلة / الفوج المختار: {selectedBus.name}
                </p>
              )}
            </div>

            <div className="space-y-2.5 pt-3 border-t border-[#F0E9DC] text-sm">
              <div className="flex justify-between">
                <span className="text-[#556660]">
                  بالغين ({adultsCount} × {pkg.price.toLocaleString('ar-SA')})
                </span>
                <span className="font-semibold tabular-nums">
                  {(adultsCount * pkg.price).toLocaleString('ar-SA')} {pkg.currency}
                </span>
              </div>
              {childrenCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#556660]">
                    أطفال ({childrenCount} × {pkg.childPrice.toLocaleString('ar-SA')})
                  </span>
                  <span className="font-semibold tabular-nums">
                    {(childrenCount * pkg.childPrice).toLocaleString('ar-SA')} {pkg.currency}
                  </span>
                </div>
              )}
              {infantsCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#556660]">
                    رضع ({infantsCount} × {pkg.infantPrice.toLocaleString('ar-SA')})
                  </span>
                  <span className="font-semibold tabular-nums">
                    {(infantsCount * pkg.infantPrice).toLocaleString('ar-SA')} {pkg.currency}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E6DCCA] flex items-center justify-between">
              <span className="font-display font-bold text-base text-[#0F332B]">الإجمالي الكلي</span>
              <span className="font-display text-2xl font-extrabold text-[#0F332B] tabular-nums">
                {totalPrice.toLocaleString('ar-SA')}{' '}
                <span className="text-sm text-[#8C6D2E]">{pkg.currency}</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-5 rounded-xl font-display font-bold text-base text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جارٍ تسجيل الحجز...
                </>
              ) : (
                'تأكيد وإرسال طلب الحجز'
              )}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
};
