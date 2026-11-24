import * as XLSX from 'xlsx';
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  type FormTemplate,
} from '../types';

export function formatFirestoreDate(val: unknown): string {
  if (!val) return '—';
  try {
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    const d = new Date(val as string | number | Date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function exportBookingsToExcel(bookings: Booking[], forms: FormTemplate[], fileName = 'حجوزات_راية_الفرات.xlsx') {
  const formMap = new Map<string, FormTemplate>();
  forms.forEach((f) => formMap.set(f.id, f));

  const summaryRows = bookings.map((b) => ({
    'الرقم المرجعي': b.bookingRef,
    'الباقة السياحية': b.packageTitle,
    'تاريخ الرحلة': b.departureDate,
    'اسم صاحب الحجز': b.customerName,
    'رقم الجوال': b.customerPhone,
    'البريد الإلكتروني': b.customerEmail || '—',
    'البالغين': b.adultsCount,
    'الأطفال': b.childrenCount,
    'الرضع': b.infantsCount,
    'إجمالي المسافرين': b.adultsCount + b.childrenCount + b.infantsCount,
    'السعر الإجمالي': `${b.totalPrice} ${b.currency}`,
    'حالة الحجز': BOOKING_STATUS_LABELS[b.status] || b.status,
    'ملاحظات العميل': b.customerNotes || '—',
    'ملاحظات داخلية للموظفين': b.internalNotes || '—',
    'تاريخ الحجز': formatFirestoreDate(b.createdAt),
  }));

  const travelerRows: Record<string, string | number>[] = [];
  bookings.forEach((b) => {
    const tmpl = formMap.get(b.formTemplateId);
    const fieldLabels = new Map<string, string>();
    tmpl?.fields.forEach((f) => fieldLabels.set(f.id, f.label));

    b.travelers.forEach((t, idx) => {
      const row: Record<string, string | number> = {
        'الرقم المرجعي': b.bookingRef,
        'الباقة': b.packageTitle,
        'تاريخ الرحلة': b.departureDate,
        'رقم المسافر': idx + 1,
        'فئة المسافر': t.label,
        'جوال صاحب الحجز': b.customerPhone,
        'حالة الحجز': BOOKING_STATUS_LABELS[b.status] || b.status,
      };
      Object.entries(t.answers || {}).forEach(([k, v]) => {
        const colName = fieldLabels.get(k) || k;
        row[colName] = Array.isArray(v) ? v.join('، ') : String(v ?? '');
      });
      travelerRows.push(row);
    });
  });

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ 'ملاحظة': 'لا توجد حجوزات' }]);
  const wsTravelers = XLSX.utils.json_to_sheet(travelerRows.length ? travelerRows : [{ 'ملاحظة': 'لا توجد بيانات مسافرين' }]);
  wsSummary['!views'] = [{ RTL: true }];
  wsTravelers['!views'] = [{ RTL: true }];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص الحجوزات');
  XLSX.utils.book_append_sheet(wb, wsTravelers, 'كشف المسافرين');
  XLSX.writeFile(wb, fileName);
}
