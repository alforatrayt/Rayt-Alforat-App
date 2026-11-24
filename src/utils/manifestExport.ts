import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { domToJpeg } from 'modern-screenshot';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type Booking,
  type FormTemplate,
  type SiteSettings,
  type TravelerRecord,
} from '../types';
import { formatFirestoreDate } from './exportUtils';

export type ManifestColumnGroup = 'basic' | 'traveler';

export interface ManifestColumnDef {
  id: string;
  label: string;
  group: ManifestColumnGroup;
  hint?: string;
  isIdentifierOrPhone?: boolean;
  defaultSelected?: boolean;
}

export type ManifestStatusFilter =
  | 'all'
  | 'confirmed_only'
  | 'exclude_cancelled'
  | 'confirmed_and_awaiting';

export type ManifestCategoryFilter = 'all' | 'adult' | 'child' | 'infant';

export type ManifestOrientation = 'auto' | 'portrait' | 'landscape';

export interface ManifestExportOptions {
  reportTitle: string;
  footerNote: string;
  licenseNumber: string;
  statusFilter: ManifestStatusFilter;
  packageIdFilter: string;
  categoryFilter: ManifestCategoryFilter;
  selectedColumnIds: string[];
  orientation: ManifestOrientation;
}

export interface ManifestTravelerRow {
  serial: number;
  booking: Booking;
  traveler: TravelerRecord;
  values: Record<string, string>;
}

export interface ManifestDataset {
  rows: ManifestTravelerRow[];
  bookingsCount: number;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  totalTravelers: number;
}

const CANONICAL_FORM_FIELD_IDS = new Set([
  'full_name',
  'english_name',
  'passport_number',
  'national_id',
  'passport_expiry',
  'nationality',
]);

export const BASIC_MANIFEST_COLUMNS: ManifestColumnDef[] = [
  { id: 'bookingRef', label: 'رقم الحجز', group: 'basic', isIdentifierOrPhone: true, defaultSelected: true },
  { id: 'packageTitle', label: 'اسم الباقة', group: 'basic', defaultSelected: false },
  { id: 'departureDate', label: 'تاريخ السفر', group: 'basic', defaultSelected: false },
  { id: 'busName', label: 'الحافلة / الفوج', group: 'basic', defaultSelected: false },
  { id: 'bookingStatus', label: 'حالة الحجز', group: 'basic', defaultSelected: true },
  { id: 'paymentStatus', label: 'حالة الدفع', group: 'basic', defaultSelected: false },
  { id: 'paidAmount', label: 'المبلغ المدفوع', group: 'basic', defaultSelected: false },
  { id: 'remainingAmount', label: 'المبلغ المتبقي', group: 'basic', defaultSelected: false },
  { id: 'customerName', label: 'اسم صاحب الحجز', group: 'basic', defaultSelected: false },
  { id: 'customerEmail', label: 'البريد الإلكتروني', group: 'basic', isIdentifierOrPhone: true, defaultSelected: false },
  { id: 'bookingTotalPrice', label: 'إجمالي الحجز', group: 'basic', defaultSelected: false },
  { id: 'bookingCreatedAt', label: 'تاريخ التسجيل', group: 'basic', defaultSelected: false },
];

export const CORE_TRAVELER_MANIFEST_COLUMNS: ManifestColumnDef[] = [
  { id: 'traveler_full_name', label: 'الاسم الكامل', group: 'traveler', defaultSelected: true },
  {
    id: 'traveler_document_no',
    label: 'رقم الجواز / الهوية',
    group: 'traveler',
    isIdentifierOrPhone: true,
    defaultSelected: true,
  },
  {
    id: 'traveler_doc_expiry',
    label: 'تاريخ الانتهاء',
    group: 'traveler',
    isIdentifierOrPhone: true,
    defaultSelected: false,
  },
  { id: 'traveler_nationality', label: 'الجنسية', group: 'traveler', defaultSelected: false },
  {
    id: 'traveler_phone',
    label: 'رقم الجوال',
    group: 'traveler',
    isIdentifierOrPhone: true,
    defaultSelected: true,
  },
  { id: 'traveler_category', label: 'الفئة العمرية', group: 'traveler', defaultSelected: true },
];

export function collectAvailableManifestColumns(
  bookings: Booking[],
  forms: FormTemplate[]
): ManifestColumnDef[] {
  const columns: ManifestColumnDef[] = [
    ...BASIC_MANIFEST_COLUMNS,
    ...CORE_TRAVELER_MANIFEST_COLUMNS,
  ];

  const seenDynamicIds = new Set<string>();
  const usedFormIds = new Set(bookings.map((b) => b.formTemplateId));

  // Prioritize forms used in the target bookings, then remaining forms
  const orderedForms = [
    ...forms.filter((f) => usedFormIds.has(f.id)),
    ...forms.filter((f) => !usedFormIds.has(f.id)),
  ];

  for (const tmpl of orderedForms) {
    for (const fld of tmpl.fields || []) {
      if (fld.type === 'file') continue;
      if (CANONICAL_FORM_FIELD_IDS.has(fld.id)) continue;
      const colId = `dyn:${fld.id}`;
      if (seenDynamicIds.has(colId)) continue;
      seenDynamicIds.add(colId);
      columns.push({
        id: colId,
        label: fld.label,
        group: 'traveler',
        hint: tmpl.name,
        isIdentifierOrPhone:
          fld.type === 'number' ||
          fld.type === 'date' ||
          /جوال|هاتف|جواز|هوية|passport|phone|id/i.test(fld.label),
      });
    }
  }

  // Also include any orphaned answer keys present in bookings' travelers
  for (const b of bookings) {
    for (const t of b.travelers || []) {
      for (const key of Object.keys(t.answers || {})) {
        if (CANONICAL_FORM_FIELD_IDS.has(key)) continue;
        const colId = `dyn:${key}`;
        if (seenDynamicIds.has(colId)) continue;
        seenDynamicIds.add(colId);
        columns.push({
          id: colId,
          label: key,
          group: 'traveler',
          hint: 'حقل مخصص',
        });
      }
    }
  }

  return columns;
}

function formatAnswerValue(val: string | string[] | undefined): string {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return val.filter(Boolean).join('، ');
  return String(val).trim();
}

function getBookingPaymentLabel(booking: Booking): string {
  if (booking.paymentStatus && PAYMENT_STATUS_LABELS[booking.paymentStatus]) {
    return PAYMENT_STATUS_LABELS[booking.paymentStatus];
  }
  const paid = typeof booking.paidAmount === 'number' ? booking.paidAmount : 0;
  if (paid >= booking.totalPrice && booking.totalPrice > 0) return PAYMENT_STATUS_LABELS.paid;
  if (paid > 0) return PAYMENT_STATUS_LABELS.partial;
  return PAYMENT_STATUS_LABELS.unpaid;
}

function getCategoryArabic(cat: TravelerRecord['category'], fallbackLabel: string): string {
  if (cat === 'adult') return 'بالغ';
  if (cat === 'child') return 'طفل';
  if (cat === 'infant') return 'رضيع';
  return fallbackLabel || 'مسافر';
}

function findAnswerByKeywords(
  answers: Record<string, string | string[]>,
  form: FormTemplate | undefined,
  exactKeys: string[],
  labelKeywords: RegExp
): string {
  for (const key of exactKeys) {
    const formatted = formatAnswerValue(answers[key]);
    if (formatted) return formatted;
  }

  if (form) {
    for (const fld of form.fields || []) {
      if (fld.type === 'file') continue;
      if (labelKeywords.test(fld.label) || labelKeywords.test(fld.id)) {
        const formatted = formatAnswerValue(answers[fld.id]);
        if (formatted) return formatted;
      }
    }
  }

  for (const [k, v] of Object.entries(answers)) {
    if (labelKeywords.test(k)) {
      const formatted = formatAnswerValue(v);
      if (formatted) return formatted;
    }
  }

  return '';
}

export function resolveManifestCellValue(
  colId: string,
  booking: Booking,
  traveler: TravelerRecord,
  travelerIndexInBooking: number,
  form: FormTemplate | undefined
): string {
  const answers = traveler.answers || {};

  switch (colId) {
    case 'bookingRef':
      return booking.bookingRef || '—';
    case 'packageTitle':
      return booking.packageTitle || '—';
    case 'departureDate':
      return booking.departureDate || '—';
    case 'busName':
      return booking.busName || 'غير مسكن';
    case 'bookingStatus':
      return BOOKING_STATUS_LABELS[booking.status] || booking.status;
    case 'paymentStatus':
      return getBookingPaymentLabel(booking);
    case 'paidAmount':
      return `${(booking.paidAmount ?? 0).toLocaleString('ar-SA')} ${booking.currency}`;
    case 'remainingAmount': {
      const paid = booking.paidAmount ?? 0;
      const rem = booking.remainingAmount ?? Math.max(0, booking.totalPrice - paid);
      return `${rem.toLocaleString('ar-SA')} ${booking.currency}`;
    }
    case 'customerName':
      return booking.customerName || '—';
    case 'customerEmail':
      return booking.customerEmail || '—';
    case 'bookingTotalPrice':
      return `${booking.totalPrice.toLocaleString('ar-SA')} ${booking.currency}`;
    case 'bookingCreatedAt':
      return formatFirestoreDate(booking.createdAt);

    case 'traveler_full_name': {
      const found = findAnswerByKeywords(
        answers,
        form,
        ['full_name', 'english_name', 'fullName', 'name'],
        /الاسم|الرباعي|اسم المسافر|full.?name|english.?name/i
      );
      if (found) return found;
      return travelerIndexInBooking === 0 && booking.customerName
        ? booking.customerName
        : traveler.label || '—';
    }

    case 'traveler_document_no': {
      const found = findAnswerByKeywords(
        answers,
        form,
        ['passport_number', 'national_id', 'passportNo', 'idNumber'],
        /رقم الجواز|جواز السفر|الهوية|الإقامة|passport.?num|national.?id/i
      );
      return found || '—';
    }

    case 'traveler_doc_expiry': {
      const found = findAnswerByKeywords(
        answers,
        form,
        ['passport_expiry', 'expiry_date', 'id_expiry'],
        /انتهاء|الصلاحية|expiry/i
      );
      return found || '—';
    }

    case 'traveler_nationality': {
      const found = findAnswerByKeywords(
        answers,
        form,
        ['nationality', 'country'],
        /الجنسية|جنسية|nationality/i
      );
      return found || '—';
    }

    case 'traveler_phone': {
      const found = findAnswerByKeywords(
        answers,
        form,
        ['phone', 'mobile', 'traveler_phone', 'whatsapp'],
        /جوال|هاتف|موبايل|phone|mobile/i
      );
      return found || booking.customerPhone || '—';
    }

    case 'traveler_category':
      return getCategoryArabic(traveler.category, traveler.label);

    default: {
      if (colId.startsWith('dyn:')) {
        const key = colId.slice(4);
        const raw = formatAnswerValue(answers[key]);
        return raw || '—';
      }
      return '—';
    }
  }
}

export function buildManifestDataset(
  sourceBookings: Booking[],
  forms: FormTemplate[],
  options: Pick<
    ManifestExportOptions,
    'statusFilter' | 'packageIdFilter' | 'categoryFilter' | 'selectedColumnIds'
  >
): ManifestDataset {
  const formMap = new Map<string, FormTemplate>();
  forms.forEach((f) => formMap.set(f.id, f));

  const filteredBookings = sourceBookings.filter((b) => {
    if (options.packageIdFilter !== 'all' && b.packageId !== options.packageIdFilter) {
      return false;
    }
    if (options.statusFilter === 'confirmed_only' && b.status !== 'confirmed') {
      return false;
    }
    if (options.statusFilter === 'exclude_cancelled' && b.status === 'cancelled') {
      return false;
    }
    if (
      options.statusFilter === 'confirmed_and_awaiting' &&
      b.status !== 'confirmed' &&
      b.status !== 'awaiting_payment'
    ) {
      return false;
    }
    return true;
  });

  const rows: ManifestTravelerRow[] = [];
  let adultsCount = 0;
  let childrenCount = 0;
  let infantsCount = 0;
  const matchedBookingIds = new Set<string>();

  filteredBookings.forEach((booking) => {
    const form = formMap.get(booking.formTemplateId);
    const travelers = booking.travelers || [];

    travelers.forEach((traveler, tIdx) => {
      if (options.categoryFilter !== 'all' && traveler.category !== options.categoryFilter) {
        return;
      }
      matchedBookingIds.add(booking.id);
      if (traveler.category === 'adult') adultsCount += 1;
      else if (traveler.category === 'child') childrenCount += 1;
      else if (traveler.category === 'infant') infantsCount += 1;

      const values: Record<string, string> = {};
      options.selectedColumnIds.forEach((colId) => {
        values[colId] = resolveManifestCellValue(colId, booking, traveler, tIdx, form);
      });

      rows.push({
        serial: rows.length + 1,
        booking,
        traveler,
        values,
      });
    });
  });

  return {
    rows,
    bookingsCount: matchedBookingIds.size,
    adultsCount,
    childrenCount,
    infantsCount,
    totalTravelers: rows.length,
  };
}

export function buildManifestFileName(packageLabel: string, ext: 'pdf' | 'xlsx'): string {
  const today = new Date().toISOString().slice(0, 10);
  const cleanedPkg = packageLabel
    .trim()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 45);
  const pkgPart = cleanedPkg || 'جميع_الباقات';
  return `كشف_مسافرين_${pkgPart}_${today}.${ext}`;
}

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

// ==================== EXCEL (.XLSX) OFFICIAL EXPORT ====================

export async function exportManifestToExcel(params: {
  dataset: ManifestDataset;
  columns: ManifestColumnDef[];
  options: ManifestExportOptions;
  settings: SiteSettings;
  packageLabel: string;
}): Promise<string> {
  const { dataset, columns, options, settings, packageLabel } = params;
  const primaryArgb = hexToArgb(settings.primaryColor, 'FF0F332B');
  const accentArgb = hexToArgb(settings.accentColor, 'FFB88E3E');
  const headerTextArgb = 'FFFFFFFF';
  const totalCols = columns.length + 1; // +1 for serial '#'

  const wb = new ExcelJS.Workbook();
  wb.creator = settings.agencyName || 'راية الفُرات للسفر والسياحة';
  wb.created = new Date();

  const ws = wb.addWorksheet('كشف المسافرين', {
    views: [{ rightToLeft: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: columns.length > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const exportDateStr = formatArabicDateTimeNow();

  // Row 1: Official Report Title
  const titleRow = ws.addRow([options.reportTitle.trim() || 'كشف المسافرين الرسمي']);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 34;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: 'Cairo', size: 15, bold: true, color: { argb: headerTextArgb } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Row 2: Agency Name, License & Export Timestamp
  const agencyMetaParts = [
    `${settings.agencyName} ${settings.agencySubtitle || ''}`.trim(),
    options.licenseNumber?.trim() ? `الترخيص / السجل التجاري: ${options.licenseNumber.trim()}` : '',
    `تاريخ التصدير: ${exportDateStr}`,
  ].filter(Boolean);
  const metaRow = ws.addRow([agencyMetaParts.join('  |  ')]);
  ws.mergeCells(2, 1, 2, totalCols);
  metaRow.height = 24;
  const metaCell = metaRow.getCell(1);
  metaCell.font = { name: 'Tajawal', size: 10, bold: true, color: { argb: 'FF142621' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F0' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  metaCell.border = {
    bottom: { style: 'medium', color: { argb: accentArgb } },
  };

  // Row 3: Blank spacer
  const spacerRow = ws.addRow([]);
  spacerRow.height = 10;

  // Row 4: Table Headers
  const headerLabels = ['#', ...columns.map((c) => c.label)];
  const headerRow = ws.addRow(headerLabels);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: headerTextArgb } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: primaryArgb } },
      bottom: { style: 'medium', color: { argb: accentArgb } },
      left: { style: 'thin', color: { argb: 'FFD8CBB3' } },
      right: { style: 'thin', color: { argb: 'FFD8CBB3' } },
    };
  });

  // Track max lengths for auto-width
  const colMaxLens: number[] = headerLabels.map((h) => h.length);

  // Data Rows
  dataset.rows.forEach((r, idx) => {
    const rowValues: (string | number)[] = [r.serial];
    columns.forEach((col, cIdx) => {
      const val = r.values[col.id] ?? '—';
      rowValues.push(String(val));
      const lines = String(val).split('\n');
      const maxLine = Math.max(...lines.map((l) => l.length), 2);
      if (maxLine > colMaxLens[cIdx + 1]) {
        colMaxLens[cIdx + 1] = maxLine;
      }
    });

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 23;
    const isAlt = idx % 2 === 1;
    const rowFillArgb = isAlt ? 'FFFAF7F0' : 'FFFFFFFF';

    dataRow.eachCell((cell, colNumber) => {
      const isSerial = colNumber === 1;
      const colDef = isSerial ? null : columns[colNumber - 2];

      if (!isSerial && colDef?.isIdentifierOrPhone) {
        // Enforce plain text format so Excel never formats passports/phones scientifically
        cell.value = String(cell.value ?? '');
        cell.numFmt = '@';
      }

      cell.font = {
        name: colDef?.isIdentifierOrPhone || isSerial ? 'Calibri' : 'Tajawal',
        size: 10.5,
        color: { argb: 'FF142621' },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillArgb } };
      cell.alignment = {
        horizontal: isSerial || colDef?.isIdentifierOrPhone ? 'center' : 'right',
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

  // Totals Summary Row
  const summaryText = `إجمالي عدد المسافرين: ${dataset.totalTravelers}  (بالغين: ${dataset.adultsCount} · أطفال: ${dataset.childrenCount} · رضع: ${dataset.infantsCount})  —  عدد الحجوزات: ${dataset.bookingsCount}`;
  const totalRow = ws.addRow([summaryText]);
  const totalRowIdx = totalRow.number;
  ws.mergeCells(totalRowIdx, 1, totalRowIdx, totalCols);
  totalRow.height = 28;
  const totalCell = totalRow.getCell(1);
  totalCell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: primaryArgb } };
  totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3ECE0' } };
  totalCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  totalCell.border = {
    top: { style: 'medium', color: { argb: accentArgb } },
    bottom: { style: 'medium', color: { argb: primaryArgb } },
    left: { style: 'thin', color: { argb: 'FFD8CBB3' } },
    right: { style: 'thin', color: { argb: 'FFD8CBB3' } },
  };

  // Optional Footer Note Row
  if (options.footerNote.trim()) {
    const noteRow = ws.addRow([`ملاحظات: ${options.footerNote.trim()}`]);
    const noteIdx = noteRow.number;
    ws.mergeCells(noteIdx, 1, noteIdx, totalCols);
    noteRow.height = 24;
    const noteCell = noteRow.getCell(1);
    noteCell.font = { name: 'Tajawal', size: 10, color: { argb: 'FF556660' } };
    noteCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
  }

  // Apply Auto-Width
  ws.columns.forEach((col, idx) => {
    if (idx === 0) {
      col.width = 7;
    } else {
      const maxLen = colMaxLens[idx] || 10;
      col.width = Math.min(48, Math.max(13, Math.ceil(maxLen * 1.28) + 4));
    }
  });

  const fileName = buildManifestFileName(packageLabel, 'xlsx');
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

// ==================== PDF & PRINT OFFICIAL EXPORT ====================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAgencyLogoHtml(settings: SiteSettings): string {
  const primary = settings.primaryColor || '#0F332B';
  const secondary = settings.secondaryColor || '#0E6E73';
  const accent = settings.accentColor || '#B88E3E';

  if (settings.logoUrl) {
    return `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(
      settings.agencyName
    )}" style="width:54px;height:54px;border-radius:9999px;object-fit:contain;background:#ffffff;border:1.5px solid ${accent};padding:2px;flex-shrink:0;" />`;
  }

  return `
    <svg viewBox="0 0 120 120" style="width:54px;height:54px;flex-shrink:0;" aria-hidden="true">
      <circle cx="60" cy="58" r="48" fill="#FDFBF7" stroke="${secondary}" stroke-width="3.5" />
      <circle cx="60" cy="58" r="43" fill="none" stroke="${accent}" stroke-width="1.2" stroke-opacity="0.65" />
      <path d="M36 48 C42 28, 72 24, 83 41 C89 51, 80 62, 65 62 C52 62, 46 53, 52 43 C56 37, 67 36, 72 44" fill="none" stroke="${accent}" stroke-width="4.5" stroke-linecap="round" />
      <circle cx="62" cy="30" r="2.6" fill="${accent}" />
      <circle cx="71" cy="28" r="2.2" fill="${accent}" />
      <text x="60" y="59" text-anchor="middle" fill="${primary}" style="font-family:Cairo,sans-serif;font-weight:800;font-size:18px;">الفرات</text>
      <path d="M22 72 Q60 95 98 63 L93 74 Q60 105 27 83 Z" fill="${secondary}" />
      <path d="M14 88 Q52 108 92 78 Q54 98 19 82 Z" fill="${accent}" />
      <text x="60" y="84" text-anchor="middle" fill="#FFFFFF" style="font-family:Tajawal,sans-serif;font-weight:700;font-size:9px;">للسفر والسياحة</text>
    </svg>
  `;
}

function resolvePageDimensions(orientation: ManifestOrientation, colCount: number) {
  const isLandscape =
    orientation === 'landscape' || (orientation === 'auto' && colCount > 6);
  // A4 at 96dpi: 794x1123 portrait, 1123x794 landscape
  return {
    isLandscape,
    widthPx: isLandscape ? 1123 : 794,
    heightPx: isLandscape ? 794 : 1123,
  };
}

function buildOfficialHeaderHtml(params: {
  settings: SiteSettings;
  options: ManifestExportOptions;
  printTimestamp: string;
  packageLabel: string;
  totalTravelers: number;
}): string {
  const { settings, options, printTimestamp, packageLabel, totalTravelers } = params;
  const primary = settings.primaryColor || '#0F332B';
  const accent = settings.accentColor || '#B88E3E';
  const license = options.licenseNumber.trim();

  return `
    <div style="border-bottom:2px solid ${primary};padding-bottom:12px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${buildAgencyLogoHtml(settings)}
        <div>
          <div style="font-family:'Cairo',sans-serif;font-weight:800;font-size:17px;color:${primary};line-height:1.2;">
            ${escapeHtml(settings.agencyName)} ${escapeHtml(settings.agencySubtitle || '')}
          </div>
          <div style="font-family:'Tajawal',sans-serif;font-size:11px;color:#8C6D2E;margin-top:2px;">
            ${escapeHtml(settings.tagline || '')}
          </div>
          ${
            license
              ? `<div style="font-family:'Tajawal',sans-serif;font-size:10.5px;color:#374B45;margin-top:2px;font-weight:700;">${escapeHtml(
                  license
                )}</div>`
              : ''
          }
        </div>
      </div>

      <div style="text-align:center;flex:1;padding:0 10px;">
        <div style="font-family:'Cairo',sans-serif;font-weight:800;font-size:16px;color:${primary};line-height:1.3;">
          ${escapeHtml(options.reportTitle.trim() || 'كشف المسافرين الرسمي')}
        </div>
        <div style="font-family:'Tajawal',sans-serif;font-size:11px;color:#556660;margin-top:3px;">
          النطاق: <strong style="color:#142621;">${escapeHtml(packageLabel)}</strong> · إجمالي المسافرين: <strong style="color:${primary};">${totalTravelers}</strong>
        </div>
      </div>

      <div style="text-align:left;min-width:170px;border-right:1px solid ${accent};padding-right:12px;">
        <div style="font-family:'Tajawal',sans-serif;font-size:10px;color:#556660;">تاريخ ووقت الطباعة</div>
        <div style="font-family:'Tajawal',sans-serif;font-size:11px;font-weight:700;color:#142621;margin-top:2px;">
          ${escapeHtml(printTimestamp)}
        </div>
        ${
          settings.contacts?.[0]?.phone
            ? `<div style="font-family:'Tajawal',sans-serif;font-size:10px;color:#556660;margin-top:3px;">هاتف المكتب: <span dir="ltr" style="font-family:'IBM Plex Mono',monospace;color:#142621;font-weight:600;">${escapeHtml(
                settings.contacts[0].phone
              )}</span></div>`
            : ''
        }
      </div>
    </div>
  `;
}

function buildOfficialFooterHtml(params: {
  dataset: ManifestDataset;
  options: ManifestExportOptions;
  settings: SiteSettings;
  pageNumber: number;
  totalPages: number;
}): string {
  const { dataset, options, settings, pageNumber, totalPages } = params;
  const primary = settings.primaryColor || '#0F332B';
  const accent = settings.accentColor || '#B88E3E';
  const footerNote = options.footerNote.trim();

  return `
    <div style="margin-top:auto;padding-top:10px;border-top:1.5px solid #D8CBB3;font-family:'Tajawal',sans-serif;">
      ${
        footerNote
          ? `<div style="background:#FAF7F0;border:1px solid #E6DCCA;border-radius:6px;padding:6px 10px;font-size:10.5px;color:#374B45;margin-bottom:8px;">
              <strong style="color:${primary};">ملاحظة:</strong> ${escapeHtml(footerNote)}
            </div>`
          : ''
      }
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;">
        <div style="font-size:11px;color:#142621;">
          <div style="font-family:'Cairo',sans-serif;font-weight:700;color:${primary};">
            إجمالي المسافرين: ${dataset.totalTravelers} مسافر
          </div>
          <div style="font-size:10.5px;color:#556660;margin-top:2px;">
            بالغين: <strong style="color:#142621;">${dataset.adultsCount}</strong> ·
            أطفال: <strong style="color:#142621;">${dataset.childrenCount}</strong> ·
            رضع: <strong style="color:#142621;">${dataset.infantsCount}</strong> ·
            عدد الحجوزات: <strong style="color:#142621;">${dataset.bookingsCount}</strong>
          </div>
        </div>

        <div style="text-align:center;min-width:210px;">
          <div style="font-size:10px;color:#556660;margin-bottom:14px;">توقيع وختم المكتب / مندوب الرحلة</div>
          <div style="border-bottom:1px dashed ${accent};width:190px;margin:0 auto;"></div>
        </div>

        <div style="text-align:left;min-width:110px;">
          <div style="font-family:'Cairo',sans-serif;font-size:11px;font-weight:700;color:${primary};">
            صفحة ${pageNumber} من ${totalPages}
          </div>
          <div style="font-size:9.5px;color:#6B7A74;margin-top:2px;">
            ${escapeHtml(settings.agencyName)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildTableHeadHtml(columns: ManifestColumnDef[], primary: string, compact: boolean): string {
  const thPad = compact ? '6px 6px' : '8px 8px';
  const fontSize = compact ? '10.5px' : '11.5px';
  const thStyle = `padding:${thPad};font-family:'Cairo',sans-serif;font-weight:700;font-size:${fontSize};color:#ffffff;background:${primary};border:1px solid ${primary};text-align:center;white-space:nowrap;`;
  return `
    <thead>
      <tr>
        <th style="${thStyle}width:34px;">#</th>
        ${columns
          .map((c) => `<th style="${thStyle}">${escapeHtml(c.label)}</th>`)
          .join('')}
      </tr>
    </thead>
  `;
}

function buildTableRowHtml(
  row: ManifestTravelerRow,
  columns: ManifestColumnDef[],
  rowIdx: number,
  compact: boolean
): string {
  const bg = rowIdx % 2 === 1 ? '#FAF7F0' : '#FFFFFF';
  const pad = compact ? '5px 6px' : '7px 8px';
  const fontSize = compact ? '10.5px' : '11.5px';
  const baseTd = `padding:${pad};font-family:'Tajawal',sans-serif;font-size:${fontSize};color:#142621;background:${bg};border:1px solid #E2D7C3;vertical-align:middle;word-break:break-word;`;

  const cells = columns
    .map((col) => {
      const val = row.values[col.id] ?? '—';
      if (col.isIdentifierOrPhone) {
        return `<td style="${baseTd}text-align:center;font-family:'IBM Plex Mono','Tajawal',monospace;font-size:${
          compact ? '10px' : '10.5px'
        };"><span dir="ltr">${escapeHtml(val)}</span></td>`;
      }
      return `<td style="${baseTd}text-align:right;">${escapeHtml(val)}</td>`;
    })
    .join('');

  return `
    <tr>
      <td style="${baseTd}text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:600;color:#556660;width:34px;">${row.serial}</td>
      ${cells}
    </tr>
  `;
}

function paginateRowsByMeasuredHeight(params: {
  dataset: ManifestDataset;
  columns: ManifestColumnDef[];
  options: ManifestExportOptions;
  settings: SiteSettings;
  packageLabel: string;
  printTimestamp: string;
}): {
  pages: ManifestTravelerRow[][];
  widthPx: number;
  heightPx: number;
  isLandscape: boolean;
  compact: boolean;
} {
  const { dataset, columns, options, settings, packageLabel, printTimestamp } = params;
  const { isLandscape, widthPx, heightPx } = resolvePageDimensions(
    options.orientation,
    columns.length
  );
  const compact = columns.length >= 7;
  const primary = settings.primaryColor || '#0F332B';
  const pagePaddingPx = 32; // 32px all around

  // Create offscreen staging container to measure exact rendered heights
  const stage = document.createElement('div');
  stage.style.position = 'fixed';
  stage.style.left = '-99999px';
  stage.style.top = '0';
  stage.style.width = `${widthPx}px`;
  stage.style.padding = `${pagePaddingPx}px`;
  stage.style.boxSizing = 'border-box';
  stage.style.background = '#FFFFFF';
  stage.style.direction = 'rtl';
  stage.setAttribute('dir', 'rtl');

  const headerHtml = buildOfficialHeaderHtml({
    settings,
    options,
    printTimestamp,
    packageLabel,
    totalTravelers: dataset.totalTravelers,
  });

  const footerHtml = buildOfficialFooterHtml({
    dataset,
    options,
    settings,
    pageNumber: 1,
    totalPages: 1,
  });

  stage.innerHTML = `
    <div id="__measure_header">${headerHtml}</div>
    <table id="__measure_table" style="width:100%;border-collapse:collapse;table-layout:auto;">
      ${buildTableHeadHtml(columns, primary, compact)}
      <tbody id="__measure_tbody">
        ${dataset.rows
          .map((r, i) => buildTableRowHtml(r, columns, i, compact))
          .join('')}
      </tbody>
    </table>
    <div id="__measure_footer">${footerHtml}</div>
  `;

  document.body.appendChild(stage);

  try {
    const headerHeight =
      (stage.querySelector('#__measure_header') as HTMLElement)?.offsetHeight || 90;
    const footerHeight =
      (stage.querySelector('#__measure_footer') as HTMLElement)?.offsetHeight || 75;
    const theadHeight =
      (stage.querySelector('#__measure_table thead') as HTMLElement)?.offsetHeight || 34;

    const availableBodyHeight =
      heightPx - pagePaddingPx * 2 - headerHeight - footerHeight - theadHeight - 24;

    const rowEls = Array.from(
      stage.querySelectorAll('#__measure_tbody tr')
    ) as HTMLElement[];

    const pages: ManifestTravelerRow[][] = [];
    let currentPage: ManifestTravelerRow[] = [];
    let accHeight = 0;

    dataset.rows.forEach((row, idx) => {
      const rHeight = rowEls[idx]?.offsetHeight || 30;
      if (currentPage.length > 0 && accHeight + rHeight > availableBodyHeight) {
        pages.push(currentPage);
        currentPage = [row];
        accHeight = rHeight;
      } else {
        currentPage.push(row);
        accHeight += rHeight;
      }
    });

    if (currentPage.length > 0 || pages.length === 0) {
      pages.push(currentPage);
    }

    return { pages, widthPx, heightPx, isLandscape, compact };
  } finally {
    document.body.removeChild(stage);
  }
}

export async function exportManifestToPdf(params: {
  dataset: ManifestDataset;
  columns: ManifestColumnDef[];
  options: ManifestExportOptions;
  settings: SiteSettings;
  packageLabel: string;
}): Promise<string> {
  const { dataset, columns, options, settings, packageLabel } = params;

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // proceed with loaded fonts
    }
  }

  const printTimestamp = formatArabicDateTimeNow();
  const primary = settings.primaryColor || '#0F332B';

  const { pages, widthPx, heightPx, isLandscape, compact } =
    paginateRowsByMeasuredHeight({
      dataset,
      columns,
      options,
      settings,
      packageLabel,
      printTimestamp,
    });

  const totalPages = pages.length;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pdfWidthMm = pdf.internal.pageSize.getWidth();
  const pdfHeightMm = pdf.internal.pageSize.getHeight();

  const renderHost = document.createElement('div');
  renderHost.style.position = 'fixed';
  renderHost.style.left = '-99999px';
  renderHost.style.top = '0';
  renderHost.style.background = '#FFFFFF';
  document.body.appendChild(renderHost);

  try {
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageRows = pages[pIdx];
      const pageEl = document.createElement('div');
      pageEl.setAttribute('dir', 'rtl');
      pageEl.style.width = `${widthPx}px`;
      pageEl.style.height = `${heightPx}px`;
      pageEl.style.padding = '32px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#FFFFFF';
      pageEl.style.color = '#142621';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.direction = 'rtl';
      pageEl.style.fontFamily = "'Tajawal', 'Cairo', sans-serif";

      const headerHtml = buildOfficialHeaderHtml({
        settings,
        options,
        printTimestamp,
        packageLabel,
        totalTravelers: dataset.totalTravelers,
      });

      const bodyRowsHtml =
        pageRows.length > 0
          ? pageRows
              .map((row, idx) => buildTableRowHtml(row, columns, idx, compact))
              .join('')
          : `<tr><td colspan="${columns.length + 1}" style="padding:24px;text-align:center;font-size:13px;color:#556660;border:1px solid #E2D7C3;">لا توجد بيانات مسافرين مطابقة لمعايير التصفية.</td></tr>`;

      const footerHtml = buildOfficialFooterHtml({
        dataset,
        options,
        settings,
        pageNumber: pIdx + 1,
        totalPages,
      });

      pageEl.innerHTML = `
        ${headerHtml}
        <div style="flex:1;">
          <table style="width:100%;border-collapse:collapse;table-layout:auto;">
            ${buildTableHeadHtml(columns, primary, compact)}
            <tbody>${bodyRowsHtml}</tbody>
          </table>
        </div>
        ${footerHtml}
      `;

      renderHost.innerHTML = '';
      renderHost.appendChild(pageEl);

      // Allow browser layout to settle before rasterizing
      await new Promise((r) => setTimeout(r, 40));

      const dataUrl = await domToJpeg(pageEl, {
        scale: 2,
        quality: 0.95,
        backgroundColor: '#FFFFFF',
      });

      if (pIdx > 0) {
        pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
      }
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
    }

    const fileName = buildManifestFileName(packageLabel, 'pdf');
    pdf.save(fileName);
    return fileName;
  } finally {
    document.body.removeChild(renderHost);
  }
}
