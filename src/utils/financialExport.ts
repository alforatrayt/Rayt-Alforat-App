import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { domToJpeg } from 'modern-screenshot';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type BookingPayment,
  type PaymentMethod,
  type PaymentStatus,
  type SiteSettings,
  type TravelPackage,
} from '../types';
import { computeBookingFinancialTotals } from '../services/firestoreService';

export type FinancialFilterMode = 'all' | 'package' | 'bus' | 'date_range' | 'individual';

export interface FinancialFilterParams {
  mode: FinancialFilterMode;
  packageId: string;
  busId: string; // '' | bus.id | '__unassigned__'
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  individualQuery: string;
  excludeCancelled: boolean;
}

export interface FinancialBookingRow {
  booking: Booking;
  travelersCount: number;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  paymentsCount: number;
  lastPaymentDate: string;
  lastPaymentMethodLabel: string;
}

export interface FinancialPaymentLogRow {
  payment: BookingPayment;
  booking: Booking;
}

export interface FinancialDataset {
  mode: FinancialFilterMode;
  scopeTitle: string;
  scopeSubtitle: string;
  currency: string;
  bookingsCount: number;
  travelersCount: number;
  totalRequired: number;
  totalCollected: number;
  totalRemaining: number;
  collectionRatePct: number;
  methodTotals: Record<PaymentMethod, number>;
  bookingRows: FinancialBookingRow[];
  paymentLogRows: FinancialPaymentLogRow[];
  busCapacity?: number;
  busOccupiedSeats?: number;
}

function getBookingTravelersCount(b: Booking): number {
  return Math.max(1, (b.adultsCount || 0) + (b.childrenCount || 0) + (b.infantsCount || 0));
}

function getEffectivePayments(b: Booking): BookingPayment[] {
  return Array.isArray(b.payments) ? b.payments.filter((p) => Number(p.amount) > 0) : [];
}

function bookingMatchesIndividualQuery(b: Booking, queryLower: string): boolean {
  if (!queryLower) return true;
  if (
    b.bookingRef.toLowerCase().includes(queryLower) ||
    b.customerName.toLowerCase().includes(queryLower) ||
    b.customerPhone.toLowerCase().includes(queryLower) ||
    b.packageTitle.toLowerCase().includes(queryLower) ||
    (b.busName || '').toLowerCase().includes(queryLower)
  ) {
    return true;
  }
  for (const t of b.travelers || []) {
    for (const val of Object.values(t.answers || {})) {
      const str = Array.isArray(val) ? val.join(' ') : String(val || '');
      if (str.toLowerCase().includes(queryLower)) return true;
    }
  }
  return false;
}

export function buildFinancialDataset(
  allBookings: Booking[],
  packages: TravelPackage[],
  params: FinancialFilterParams
): FinancialDataset {
  const pkgMap = new Map<string, TravelPackage>();
  packages.forEach((p) => pkgMap.set(p.id, p));

  const baseBookings = params.excludeCancelled
    ? allBookings.filter((b) => b.status !== 'cancelled')
    : allBookings;

  const selectedPkg = params.packageId ? pkgMap.get(params.packageId) : undefined;
  let busCapacity: number | undefined;
  let scopeTitle = 'التقرير المالي العام لجميع الباقات';
  let scopeSubtitle = params.excludeCancelled ? 'باستثناء الحجوزات الملغاة' : 'شامل جميع الحجوزات';

  let scopedBookings = baseBookings;

  if (params.mode === 'package') {
    if (selectedPkg) {
      scopedBookings = baseBookings.filter((b) => b.packageId === selectedPkg.id);
      scopeTitle = `التقرير المالي لباقة: ${selectedPkg.title}`;
      scopeSubtitle = `${selectedPkg.destination} · ${selectedPkg.departureDate}`;
    } else {
      scopedBookings = [];
      scopeTitle = 'التقرير المالي حسب الباقة';
      scopeSubtitle = 'يرجى اختيار باقة لعرض بياناتها';
    }
  } else if (params.mode === 'bus') {
    if (selectedPkg) {
      if (params.busId === '__unassigned__') {
        scopedBookings = baseBookings.filter(
          (b) => b.packageId === selectedPkg.id && !b.busId && !b.busName
        );
        scopeTitle = `كشف مالي: مسافرون بدون حافلة — ${selectedPkg.title}`;
        scopeSubtitle = 'الحجوزات التي لم يتم تسكينها في حافلة محددة بعد';
      } else if (params.busId) {
        const busObj = (selectedPkg.buses || []).find((bus) => bus.id === params.busId);
        busCapacity = busObj?.capacity;
        scopedBookings = baseBookings.filter(
          (b) => b.packageId === selectedPkg.id && b.busId === params.busId
        );
        scopeTitle = `التقرير المالي للحافلة: ${busObj?.name || params.busId}`;
        scopeSubtitle = `الباقة: ${selectedPkg.title}${busObj?.capacity ? ` · السعة: ${busObj.capacity} مقعد` : ''}`;
      } else {
        scopedBookings = [];
        scopeTitle = `التقرير المالي حسب الحافلة — ${selectedPkg.title}`;
        scopeSubtitle = 'يرجى اختيار حافلة لعرض تفاصيلها';
      }
    } else {
      scopedBookings = [];
      scopeTitle = 'التقرير المالي حسب الحافلة';
      scopeSubtitle = 'يرجى اختيار الباقة ثم الحافلة';
    }
  } else if (params.mode === 'individual') {
    const q = params.individualQuery.trim().toLowerCase();
    scopedBookings = q
      ? baseBookings.filter((b) => bookingMatchesIndividualQuery(b, q))
      : baseBookings;
    scopeTitle = q
      ? `كشف حساب مالي للبحث: "${params.individualQuery.trim()}"`
      : 'كشف حساب الأفراد والحجوزات';
    scopeSubtitle = `${scopedBookings.length} حجز مطابق`;
  } else if (params.mode === 'date_range') {
    const from = params.fromDate || '0000-01-01';
    const to = params.toDate || '9999-12-31';
    scopeTitle = 'التقرير المالي حسب الفترة الزمنية للتحصيل';
    scopeSubtitle = `الدفعات المحصّلة من ${params.fromDate || 'البداية'} إلى ${params.toDate || 'الآن'}`;

    const paymentLogRows: FinancialPaymentLogRow[] = [];
    const matchedBookingIds = new Set<string>();
    const methodTotals: Record<PaymentMethod, number> = {
      cash: 0,
      bank_transfer: 0,
      pos_card: 0,
    };

    let periodCollected = 0;

    baseBookings.forEach((b) => {
      const payments = getEffectivePayments(b);
      payments.forEach((p) => {
        const pDate = (p.date || '').slice(0, 10);
        if (pDate >= from && pDate <= to) {
          paymentLogRows.push({ payment: p, booking: b });
          matchedBookingIds.add(b.id);
          const amt = Math.max(0, Number(p.amount) || 0);
          periodCollected += amt;
          if (p.method in methodTotals) {
            methodTotals[p.method] += amt;
          }
        }
      });
    });

    paymentLogRows.sort((a, b) => (b.payment.date || '').localeCompare(a.payment.date || ''));

    const matchedBookings = baseBookings.filter((b) => matchedBookingIds.has(b.id));
    let travelersCount = 0;
    let totalRequired = 0;
    let totalRemaining = 0;

    const bookingRows: FinancialBookingRow[] = matchedBookings.map((b) => {
      const payments = getEffectivePayments(b);
      const totals = computeBookingFinancialTotals(b.totalPrice, payments);
      const tCount = getBookingTravelersCount(b);
      travelersCount += tCount;
      totalRequired += b.totalPrice || 0;
      totalRemaining += totals.remainingAmount;
      const lastP = payments[payments.length - 1];
      return {
        booking: b,
        travelersCount: tCount,
        totalPrice: b.totalPrice || 0,
        paidAmount: totals.paidAmount,
        remainingAmount: totals.remainingAmount,
        paymentStatus: totals.paymentStatus,
        paymentsCount: payments.length,
        lastPaymentDate: lastP?.date || '—',
        lastPaymentMethodLabel: lastP ? PAYMENT_METHOD_LABELS[lastP.method] : '—',
      };
    });

    const roundedCollected = Math.round(periodCollected * 100) / 100;
    const roundedRequired = Math.round(totalRequired * 100) / 100;
    const roundedRemaining = Math.round(totalRemaining * 100) / 100;
    const currency = matchedBookings[0]?.currency || packages[0]?.currency || 'ريال';

    return {
      mode: params.mode,
      scopeTitle,
      scopeSubtitle,
      currency,
      bookingsCount: matchedBookings.length,
      travelersCount,
      totalRequired: roundedRequired,
      totalCollected: roundedCollected,
      totalRemaining: roundedRemaining,
      collectionRatePct:
        roundedRequired > 0 ? Math.min(100, Math.round((roundedCollected / roundedRequired) * 100)) : 0,
      methodTotals,
      bookingRows,
      paymentLogRows,
    };
  }

  // Standard aggregation for all | package | bus | individual
  const methodTotals: Record<PaymentMethod, number> = {
    cash: 0,
    bank_transfer: 0,
    pos_card: 0,
  };
  let travelersCount = 0;
  let totalRequired = 0;
  let totalCollected = 0;
  let totalRemaining = 0;
  const paymentLogRows: FinancialPaymentLogRow[] = [];

  const bookingRows: FinancialBookingRow[] = scopedBookings.map((b) => {
    const payments = getEffectivePayments(b);
    const totals = computeBookingFinancialTotals(b.totalPrice, payments);
    // Support legacy/unmigrated bookings that might have paidAmount without payments array
    const effectivePaid =
      payments.length > 0
        ? totals.paidAmount
        : typeof b.paidAmount === 'number'
        ? b.paidAmount
        : 0;
    const effectiveRemaining = Math.max(0, Math.round(((b.totalPrice || 0) - effectivePaid) * 100) / 100);
    const effectiveStatus: PaymentStatus =
      effectivePaid >= (b.totalPrice || 0) && (b.totalPrice || 0) > 0
        ? 'paid'
        : effectivePaid > 0
        ? 'partial'
        : 'unpaid';

    payments.forEach((p) => {
      paymentLogRows.push({ payment: p, booking: b });
      if (p.method in methodTotals) {
        methodTotals[p.method] += Math.max(0, Number(p.amount) || 0);
      }
    });

    const tCount = getBookingTravelersCount(b);
    travelersCount += tCount;
    totalRequired += b.totalPrice || 0;
    totalCollected += effectivePaid;
    totalRemaining += effectiveRemaining;

    const lastP = payments[payments.length - 1];
    return {
      booking: b,
      travelersCount: tCount,
      totalPrice: b.totalPrice || 0,
      paidAmount: effectivePaid,
      remainingAmount: effectiveRemaining,
      paymentStatus: effectiveStatus,
      paymentsCount: payments.length,
      lastPaymentDate: lastP?.date || '—',
      lastPaymentMethodLabel: lastP ? PAYMENT_METHOD_LABELS[lastP.method] : '—',
    };
  });

  paymentLogRows.sort((a, b) => (b.payment.date || '').localeCompare(a.payment.date || ''));

  const roundedReq = Math.round(totalRequired * 100) / 100;
  const roundedCol = Math.round(totalCollected * 100) / 100;
  const roundedRem = Math.round(totalRemaining * 100) / 100;
  const currency = scopedBookings[0]?.currency || selectedPkg?.currency || packages[0]?.currency || 'ريال';

  return {
    mode: params.mode,
    scopeTitle,
    scopeSubtitle,
    currency,
    bookingsCount: bookingRows.length,
    travelersCount,
    totalRequired: roundedReq,
    totalCollected: roundedCol,
    totalRemaining: roundedRem,
    collectionRatePct: roundedReq > 0 ? Math.min(100, Math.round((roundedCol / roundedReq) * 100)) : 0,
    methodTotals,
    bookingRows,
    paymentLogRows,
    busCapacity,
    busOccupiedSeats: params.mode === 'bus' ? travelersCount : undefined,
  };
}

// ==================== EXCEL (.XLSX) EXPORT ====================

function hexToArgb(hex: string | undefined, fallback = 'FF0F332B'): string {
  if (!hex) return fallback;
  const clean = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `FF${clean.toUpperCase()}`;
  }
  return fallback;
}

function formatArabicDateTimeNow(): string {
  return new Date().toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildFinancialFileName(mode: FinancialFilterMode, ext: 'xlsx' | 'pdf'): string {
  const today = new Date().toISOString().slice(0, 10);
  const modeMap: Record<FinancialFilterMode, string> = {
    all: 'التقرير_المالي_العام',
    package: 'التقرير_المالي_للباقة',
    bus: 'التقرير_المالي_للحافلة',
    date_range: 'تقرير_التحصيل_بالتاريخ',
    individual: 'كشف_حساب_مالي',
  };
  return `${modeMap[mode]}_${today}.${ext}`;
}

export async function exportFinancialReportToExcel(params: {
  dataset: FinancialDataset;
  settings: SiteSettings;
}): Promise<string> {
  const { dataset, settings } = params;
  const primaryArgb = hexToArgb(settings.primaryColor, 'FF0F332B');
  const accentArgb = hexToArgb(settings.accentColor, 'FFB88E3E');
  const isDateLogMode = dataset.mode === 'date_range';

  const headers = isDateLogMode
    ? [
        '#',
        'تاريخ الدفعة',
        'المرجع',
        'اسم العميل',
        'الجوال',
        'الباقة',
        'الحافلة',
        'وسيلة الدفع',
        `المبلغ المحصّل (${dataset.currency})`,
        'ملاحظة الدفعة',
      ]
    : [
        '#',
        'رقم الحجز',
        'اسم العميل',
        'الجوال',
        'الباقة',
        'الحافلة / الفوج',
        'المسافرون',
        'حالة الحجز',
        `الإجمالي المطلوب (${dataset.currency})`,
        `المدفوع (${dataset.currency})`,
        `المتبقي (${dataset.currency})`,
        'حالة السداد',
        'آخر دفعة',
      ];

  const totalCols = headers.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = settings.agencyName || 'راية الفُرات للسفر والسياحة';
  wb.created = new Date();

  const ws = wb.addWorksheet('التقرير المالي', {
    views: [{ rightToLeft: true }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Title Row
  const titleRow = ws.addRow([dataset.scopeTitle]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 34;
  titleRow.getCell(1).font = { name: 'Cairo', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Meta Row
  const metaParts = [
    `${settings.agencyName} ${settings.agencySubtitle || ''}`.trim(),
    settings.licenseNumber ? `الترخيص: ${settings.licenseNumber}` : '',
    dataset.scopeSubtitle,
    `تاريخ التصدير: ${formatArabicDateTimeNow()}`,
  ].filter(Boolean);
  const metaRow = ws.addRow([metaParts.join('  |  ')]);
  ws.mergeCells(2, 1, 2, totalCols);
  metaRow.height = 24;
  metaRow.getCell(1).font = { name: 'Tajawal', size: 10, bold: true, color: { argb: 'FF142621' } };
  metaRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F0' } };
  metaRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // KPI Summary Row
  const kpiText = isDateLogMode
    ? `إجمالي التحصيل خلال الفترة: ${dataset.totalCollected.toLocaleString('ar-SA')} ${dataset.currency}   |   كاش: ${dataset.methodTotals.cash.toLocaleString('ar-SA')}   |   تحويل بنكي: ${dataset.methodTotals.bank_transfer.toLocaleString('ar-SA')}   |   شبكة: ${dataset.methodTotals.pos_card.toLocaleString('ar-SA')}   |   عدد الحركات: ${dataset.paymentLogRows.length}`
    : `المطلوب: ${dataset.totalRequired.toLocaleString('ar-SA')} ${dataset.currency}   |   المحصّل فعلياً: ${dataset.totalCollected.toLocaleString('ar-SA')} ${dataset.currency}   |   المتبقي: ${dataset.totalRemaining.toLocaleString('ar-SA')} ${dataset.currency}   |   نسبة التحصيل: ${dataset.collectionRatePct}%   |   كاش: ${dataset.methodTotals.cash.toLocaleString('ar-SA')} · تحويل: ${dataset.methodTotals.bank_transfer.toLocaleString('ar-SA')} · شبكة: ${dataset.methodTotals.pos_card.toLocaleString('ar-SA')}`;
  const kpiRow = ws.addRow([kpiText]);
  ws.mergeCells(3, 1, 3, totalCols);
  kpiRow.height = 26;
  kpiRow.getCell(1).font = { name: 'Cairo', size: 10.5, bold: true, color: { argb: primaryArgb } };
  kpiRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3ECE0' } };
  kpiRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  kpiRow.getCell(1).border = { bottom: { style: 'medium', color: { argb: accentArgb } } };

  ws.addRow([]).height = 8;

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Cairo', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const colMaxLens: number[] = headers.map((h) => h.length);
  const textColIndices = isDateLogMode ? new Set([2, 3, 5]) : new Set([2, 4]);
  const numericColIndices = isDateLogMode ? new Set([9]) : new Set([7, 9, 10, 11]);

  if (isDateLogMode) {
    dataset.paymentLogRows.forEach((row, idx) => {
      const vals: (string | number)[] = [
        idx + 1,
        row.payment.date,
        row.booking.bookingRef,
        row.booking.customerName,
        row.booking.customerPhone,
        row.booking.packageTitle,
        row.booking.busName || 'غير مسكن',
        PAYMENT_METHOD_LABELS[row.payment.method],
        row.payment.amount,
        row.payment.note || '—',
      ];
      vals.forEach((v, i) => {
        const len = String(v).length;
        if (len > colMaxLens[i]) colMaxLens[i] = len;
      });
      const r = ws.addRow(vals);
      r.height = 22;
      const fill = idx % 2 === 1 ? 'FFFAF7F0' : 'FFFFFFFF';
      r.eachCell((cell, colNumber) => {
        if (textColIndices.has(colNumber)) {
          cell.value = String(cell.value ?? '');
          cell.numFmt = '@';
        }
        if (numericColIndices.has(colNumber)) {
          cell.numFmt = '#,##0.00';
        }
        cell.font = { name: 'Tajawal', size: 10, color: { argb: 'FF142621' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        cell.alignment = {
          horizontal: colNumber === 1 || textColIndices.has(colNumber) || numericColIndices.has(colNumber) ? 'center' : 'right',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE6DCCA' } },
          bottom: { style: 'thin', color: { argb: 'FFE6DCCA' } },
          left: { style: 'thin', color: { argb: 'FFE6DCCA' } },
          right: { style: 'thin', color: { argb: 'FFE6DCCA' } },
        };
      });
    });

    const totalRow = ws.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'الإجمالي المحصّل:',
      dataset.totalCollected,
      `${dataset.paymentLogRows.length} دفعة`,
    ]);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      if (colNumber === 9) cell.numFmt = '#,##0.00';
      cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: primaryArgb } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3ECE0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  } else {
    dataset.bookingRows.forEach((row, idx) => {
      const b = row.booking;
      const vals: (string | number)[] = [
        idx + 1,
        b.bookingRef,
        b.customerName,
        b.customerPhone,
        b.packageTitle,
        b.busName || 'غير مسكن',
        row.travelersCount,
        BOOKING_STATUS_LABELS[b.status],
        row.totalPrice,
        row.paidAmount,
        row.remainingAmount,
        PAYMENT_STATUS_LABELS[row.paymentStatus],
        row.lastPaymentDate !== '—' ? `${row.lastPaymentDate} (${row.lastPaymentMethodLabel})` : '—',
      ];
      vals.forEach((v, i) => {
        const len = String(v).length;
        if (len > colMaxLens[i]) colMaxLens[i] = len;
      });
      const r = ws.addRow(vals);
      r.height = 22;
      const fill = idx % 2 === 1 ? 'FFFAF7F0' : 'FFFFFFFF';
      r.eachCell((cell, colNumber) => {
        if (textColIndices.has(colNumber)) {
          cell.value = String(cell.value ?? '');
          cell.numFmt = '@';
        }
        if (colNumber >= 9 && colNumber <= 11) {
          cell.numFmt = '#,##0.00';
        }
        cell.font = { name: 'Tajawal', size: 10, color: { argb: 'FF142621' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        cell.alignment = {
          horizontal: colNumber === 1 || textColIndices.has(colNumber) || numericColIndices.has(colNumber) ? 'center' : 'right',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE6DCCA' } },
          bottom: { style: 'thin', color: { argb: 'FFE6DCCA' } },
          left: { style: 'thin', color: { argb: 'FFE6DCCA' } },
          right: { style: 'thin', color: { argb: 'FFE6DCCA' } },
        };
      });
    });

    const totalRow = ws.addRow([
      '',
      '',
      '',
      '',
      '',
      'الإجماليات:',
      dataset.travelersCount,
      `${dataset.bookingsCount} حجز`,
      dataset.totalRequired,
      dataset.totalCollected,
      dataset.totalRemaining,
      `${dataset.collectionRatePct}% محصّل`,
      '',
    ]);
    totalRow.height = 26;
    totalRow.eachCell((cell, colNumber) => {
      if (colNumber >= 9 && colNumber <= 11) cell.numFmt = '#,##0.00';
      cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: primaryArgb } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3ECE0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }

  ws.columns.forEach((col, idx) => {
    if (idx === 0) {
      col.width = 6;
    } else {
      col.width = Math.min(42, Math.max(12, Math.ceil((colMaxLens[idx] || 10) * 1.25) + 4));
    }
  });

  const fileName = buildFinancialFileName(dataset.mode, 'xlsx');
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}

// ==================== PDF OFFICIAL EXPORT ====================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLogoHtml(settings: SiteSettings): string {
  const primary = settings.primaryColor || '#0F332B';
  const secondary = settings.secondaryColor || '#0E6E73';
  const accent = settings.accentColor || '#B88E3E';
  if (settings.logoUrl) {
    return `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.agencyName)}" style="width:50px;height:50px;border-radius:9999px;object-fit:contain;background:#ffffff;border:1.5px solid ${accent};padding:2px;flex-shrink:0;" />`;
  }
  return `
    <svg viewBox="0 0 120 120" style="width:50px;height:50px;flex-shrink:0;" aria-hidden="true">
      <circle cx="60" cy="58" r="48" fill="#FDFBF7" stroke="${secondary}" stroke-width="3.5" />
      <text x="60" y="60" text-anchor="middle" fill="${primary}" style="font-family:Cairo,sans-serif;font-weight:800;font-size:18px;">الفرات</text>
      <path d="M22 72 Q60 95 98 63 L93 74 Q60 105 27 83 Z" fill="${secondary}" />
    </svg>
  `;
}

function buildPdfHeaderHtml(
  dataset: FinancialDataset,
  settings: SiteSettings,
  timestamp: string
): string {
  const primary = settings.primaryColor || '#0F332B';
  const accent = settings.accentColor || '#B88E3E';
  const license = (settings.licenseNumber || '').trim();
  const cur = escapeHtml(dataset.currency);

  return `
    <div style="border-bottom:2px solid ${primary};padding-bottom:10px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${buildLogoHtml(settings)}
          <div>
            <div style="font-family:'Cairo',sans-serif;font-weight:800;font-size:16px;color:${primary};">
              ${escapeHtml(settings.agencyName)} ${escapeHtml(settings.agencySubtitle || '')}
            </div>
            <div style="font-family:'Tajawal',sans-serif;font-size:10.5px;color:#8C6D2E;">
              ${escapeHtml(settings.tagline || '')}
            </div>
            ${license ? `<div style="font-size:10px;color:#374B45;font-weight:700;">${escapeHtml(license)}</div>` : ''}
          </div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Cairo',sans-serif;font-weight:800;font-size:15px;color:${primary};">
            ${escapeHtml(dataset.scopeTitle)}
          </div>
          <div style="font-family:'Tajawal',sans-serif;font-size:11px;color:#556660;margin-top:2px;">
            ${escapeHtml(dataset.scopeSubtitle)}
          </div>
        </div>
        <div style="text-align:left;min-width:165px;border-right:1px solid ${accent};padding-right:10px;">
          <div style="font-size:10px;color:#556660;">تاريخ الطباعة</div>
          <div style="font-size:11px;font-weight:700;color:#142621;">${escapeHtml(timestamp)}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;">
        <div style="flex:1;background:#FAF7F0;border:1px solid #E6DCCA;border-radius:8px;padding:7px 10px;">
          <div style="font-size:9.5px;color:#556660;">المبلغ المطلوب</div>
          <div style="font-family:'Cairo',sans-serif;font-size:13px;font-weight:800;color:${primary};">${dataset.totalRequired.toLocaleString('ar-SA')} ${cur}</div>
        </div>
        <div style="flex:1;background:#F2FAF9;border:1px solid #0E6E73;border-radius:8px;padding:7px 10px;">
          <div style="font-size:9.5px;color:#556660;">المحصّل فعلياً</div>
          <div style="font-family:'Cairo',sans-serif;font-size:13px;font-weight:800;color:#0E6E73;">${dataset.totalCollected.toLocaleString('ar-SA')} ${cur}</div>
        </div>
        <div style="flex:1;background:#FDF9F0;border:1px solid #B88E3E;border-radius:8px;padding:7px 10px;">
          <div style="font-size:9.5px;color:#556660;">المبلغ المتبقي</div>
          <div style="font-family:'Cairo',sans-serif;font-size:13px;font-weight:800;color:#8C6D2E;">${dataset.totalRemaining.toLocaleString('ar-SA')} ${cur}</div>
        </div>
        <div style="flex:1.2;background:#FAF7F0;border:1px solid #E6DCCA;border-radius:8px;padding:7px 10px;">
          <div style="font-size:9.5px;color:#556660;">توزيع وسائل الدفع</div>
          <div style="font-size:10px;font-weight:700;color:#142621;margin-top:2px;">
            كاش: ${dataset.methodTotals.cash.toLocaleString('ar-SA')} · تحويل: ${dataset.methodTotals.bank_transfer.toLocaleString('ar-SA')} · شبكة: ${dataset.methodTotals.pos_card.toLocaleString('ar-SA')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildPdfFooterHtml(
  dataset: FinancialDataset,
  settings: SiteSettings,
  pageNumber: number,
  totalPages: number
): string {
  const primary = settings.primaryColor || '#0F332B';
  const accent = settings.accentColor || '#B88E3E';
  return `
    <div style="margin-top:auto;padding-top:10px;border-top:1.5px solid #D8CBB3;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;font-family:'Tajawal',sans-serif;">
      <div style="font-size:10.5px;color:#142621;">
        <strong style="color:${primary};">ملخص النطاق:</strong>
        ${dataset.bookingsCount} حجز · ${dataset.travelersCount} مسافر · نسبة التحصيل ${dataset.collectionRatePct}%
      </div>
      <div style="text-align:center;min-width:200px;">
        <div style="font-size:10px;color:#556660;margin-bottom:12px;">اعتماد المحاسب / إدارة المكتب والختم</div>
        <div style="border-bottom:1px dashed ${accent};width:180px;margin:0 auto;"></div>
      </div>
      <div style="text-align:left;font-family:'Cairo',sans-serif;font-size:11px;font-weight:700;color:${primary};">
        صفحة ${pageNumber} من ${totalPages}
      </div>
    </div>
  `;
}

export async function exportFinancialReportToPdf(params: {
  dataset: FinancialDataset;
  settings: SiteSettings;
}): Promise<string> {
  const { dataset, settings } = params;
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // continue
    }
  }

  const widthPx = 1123;
  const heightPx = 794;
  const paddingPx = 28;
  const primary = settings.primaryColor || '#0F332B';
  const timestamp = formatArabicDateTimeNow();
  const isDateLogMode = dataset.mode === 'date_range';

  const thStyle = `padding:6px 7px;font-family:'Cairo',sans-serif;font-weight:700;font-size:10.5px;color:#ffffff;background:${primary};border:1px solid ${primary};text-align:center;white-space:nowrap;`;
  const theadHtml = isDateLogMode
    ? `<thead><tr>
        <th style="${thStyle}width:30px;">#</th>
        <th style="${thStyle}">تاريخ الدفعة</th>
        <th style="${thStyle}">المرجع</th>
        <th style="${thStyle}">العميل</th>
        <th style="${thStyle}">الباقة</th>
        <th style="${thStyle}">الحافلة</th>
        <th style="${thStyle}">وسيلة الدفع</th>
        <th style="${thStyle}">المبلغ المحصّل</th>
        <th style="${thStyle}">ملاحظة</th>
      </tr></thead>`
    : `<thead><tr>
        <th style="${thStyle}width:30px;">#</th>
        <th style="${thStyle}">المرجع</th>
        <th style="${thStyle}">العميل</th>
        <th style="${thStyle}">الباقة</th>
        <th style="${thStyle}">الحافلة</th>
        <th style="${thStyle}">المسافرون</th>
        <th style="${thStyle}">المطلوب</th>
        <th style="${thStyle}">المدفوع</th>
        <th style="${thStyle}">المتبقي</th>
        <th style="${thStyle}">حالة الدفع</th>
      </tr></thead>`;

  const rowHtmlList: string[] = isDateLogMode
    ? dataset.paymentLogRows.map((r, idx) => {
        const bg = idx % 2 === 1 ? '#FAF7F0' : '#FFFFFF';
        const td = `padding:5px 6px;font-size:10.5px;color:#142621;background:${bg};border:1px solid #E2D7C3;`;
        return `<tr>
          <td style="${td}text-align:center;">${idx + 1}</td>
          <td style="${td}text-align:center;font-family:'IBM Plex Mono',monospace;">${escapeHtml(r.payment.date)}</td>
          <td style="${td}text-align:center;font-family:'IBM Plex Mono',monospace;">${escapeHtml(r.booking.bookingRef)}</td>
          <td style="${td}">${escapeHtml(r.booking.customerName)}</td>
          <td style="${td}">${escapeHtml(r.booking.packageTitle)}</td>
          <td style="${td}">${escapeHtml(r.booking.busName || 'غير مسكن')}</td>
          <td style="${td}text-align:center;">${escapeHtml(PAYMENT_METHOD_LABELS[r.payment.method])}</td>
          <td style="${td}text-align:center;font-weight:700;color:#0E6E73;">${r.payment.amount.toLocaleString('ar-SA')} ${escapeHtml(r.booking.currency)}</td>
          <td style="${td}">${escapeHtml(r.payment.note || '—')}</td>
        </tr>`;
      })
    : dataset.bookingRows.map((r, idx) => {
        const bg = idx % 2 === 1 ? '#FAF7F0' : '#FFFFFF';
        const td = `padding:5px 6px;font-size:10.5px;color:#142621;background:${bg};border:1px solid #E2D7C3;`;
        return `<tr>
          <td style="${td}text-align:center;">${idx + 1}</td>
          <td style="${td}text-align:center;font-family:'IBM Plex Mono',monospace;">${escapeHtml(r.booking.bookingRef)}</td>
          <td style="${td}">${escapeHtml(r.booking.customerName)}</td>
          <td style="${td}">${escapeHtml(r.booking.packageTitle)}</td>
          <td style="${td}">${escapeHtml(r.booking.busName || 'غير مسكن')}</td>
          <td style="${td}text-align:center;">${r.travelersCount}</td>
          <td style="${td}text-align:center;font-weight:700;">${r.totalPrice.toLocaleString('ar-SA')}</td>
          <td style="${td}text-align:center;font-weight:700;color:#0E6E73;">${r.paidAmount.toLocaleString('ar-SA')}</td>
          <td style="${td}text-align:center;font-weight:700;color:#8C6D2E;">${r.remainingAmount.toLocaleString('ar-SA')}</td>
          <td style="${td}text-align:center;">${escapeHtml(PAYMENT_STATUS_LABELS[r.paymentStatus])}</td>
        </tr>`;
      });

  // Measure row heights offscreen for clean pagination
  const stage = document.createElement('div');
  stage.style.position = 'fixed';
  stage.style.left = '-99999px';
  stage.style.top = '0';
  stage.style.width = `${widthPx}px`;
  stage.style.padding = `${paddingPx}px`;
  stage.style.boxSizing = 'border-box';
  stage.style.background = '#FFFFFF';
  stage.style.direction = 'rtl';
  stage.innerHTML = `
    <div id="__f_hdr">${buildPdfHeaderHtml(dataset, settings, timestamp)}</div>
    <table id="__f_tbl" style="width:100%;border-collapse:collapse;">
      ${theadHtml}
      <tbody id="__f_tbody">${rowHtmlList.join('')}</tbody>
    </table>
    <div id="__f_ftr">${buildPdfFooterHtml(dataset, settings, 1, 1)}</div>
  `;
  document.body.appendChild(stage);

  let pageBuckets: string[][] = [];
  try {
    const hH = (stage.querySelector('#__f_hdr') as HTMLElement)?.offsetHeight || 130;
    const fH = (stage.querySelector('#__f_ftr') as HTMLElement)?.offsetHeight || 60;
    const tH = (stage.querySelector('#__f_tbl thead') as HTMLElement)?.offsetHeight || 32;
    const avail = heightPx - paddingPx * 2 - hH - fH - tH - 22;
    const trEls = Array.from(stage.querySelectorAll('#__f_tbody tr')) as HTMLElement[];

    let curr: string[] = [];
    let acc = 0;
    rowHtmlList.forEach((html, i) => {
      const rh = trEls[i]?.offsetHeight || 28;
      if (curr.length > 0 && acc + rh > avail) {
        pageBuckets.push(curr);
        curr = [html];
        acc = rh;
      } else {
        curr.push(html);
        acc += rh;
      }
    });
    if (curr.length > 0 || pageBuckets.length === 0) pageBuckets.push(curr);
  } finally {
    document.body.removeChild(stage);
  }

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  document.body.appendChild(host);

  try {
    for (let i = 0; i < pageBuckets.length; i++) {
      const pageEl = document.createElement('div');
      pageEl.setAttribute('dir', 'rtl');
      pageEl.style.width = `${widthPx}px`;
      pageEl.style.height = `${heightPx}px`;
      pageEl.style.padding = `${paddingPx}px`;
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#FFFFFF';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.direction = 'rtl';
      pageEl.style.fontFamily = "'Tajawal', 'Cairo', sans-serif";

      const bodyRows =
        pageBuckets[i].length > 0
          ? pageBuckets[i].join('')
          : `<tr><td colspan="${isDateLogMode ? 9 : 10}" style="padding:20px;text-align:center;color:#556660;border:1px solid #E2D7C3;">لا توجد سجلات مالية مطابقة لمعايير التصفية.</td></tr>`;

      pageEl.innerHTML = `
        ${buildPdfHeaderHtml(dataset, settings, timestamp)}
        <div style="flex:1;">
          <table style="width:100%;border-collapse:collapse;">
            ${theadHtml}
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        ${buildPdfFooterHtml(dataset, settings, i + 1, pageBuckets.length)}
      `;
      host.innerHTML = '';
      host.appendChild(pageEl);
      await new Promise((r) => setTimeout(r, 40));
      const dataUrl = await domToJpeg(pageEl, { scale: 2, quality: 0.95, backgroundColor: '#FFFFFF' });
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    }

    const fileName = buildFinancialFileName(dataset.mode, 'pdf');
    pdf.save(fileName);
    return fileName;
  } finally {
    document.body.removeChild(host);
  }
}
