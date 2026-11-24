import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Loader2,
  Printer,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import type { Booking, FormTemplate, SiteSettings, TravelPackage } from '../../types';
import {
  buildManifestDataset,
  collectAvailableManifestColumns,
  exportManifestToExcel,
  exportManifestToPdf,
  type ManifestCategoryFilter,
  type ManifestColumnDef,
  type ManifestExportOptions,
  type ManifestOrientation,
  type ManifestStatusFilter,
} from '../../utils/manifestExport';
import { BrandLogo } from '../BrandLogo';
import { useToast } from '../ToastProvider';

export type ManifestSourceScope = 'selected' | 'filtered' | 'all';

interface ManifestExportModalProps {
  allBookings: Booking[];
  filteredBookings: Booking[];
  selectedBookings: Booking[];
  packages: TravelPackage[];
  forms: FormTemplate[];
  settings: SiteSettings;
  initialPackageId?: string;
  onClose: () => void;
}

export const ManifestExportModal: React.FC<ManifestExportModalProps> = ({
  allBookings,
  filteredBookings,
  selectedBookings,
  packages,
  forms,
  settings,
  initialPackageId = 'all',
  onClose,
}) => {
  const { showToast } = useToast();

  const [sourceScope, setSourceScope] = useState<ManifestSourceScope>(
    selectedBookings.length > 0 ? 'selected' : 'filtered'
  );
  const [packageIdFilter, setPackageIdFilter] = useState<string>(initialPackageId);
  const [statusFilter, setStatusFilter] = useState<ManifestStatusFilter>('exclude_cancelled');
  const [categoryFilter, setCategoryFilter] = useState<ManifestCategoryFilter>('all');
  const [orientation, setOrientation] = useState<ManifestOrientation>('auto');

  const sourceBookings = useMemo(() => {
    if (sourceScope === 'selected' && selectedBookings.length > 0) return selectedBookings;
    if (sourceScope === 'filtered') return filteredBookings;
    return allBookings;
  }, [sourceScope, selectedBookings, filteredBookings, allBookings]);

  const availableColumns = useMemo(
    () => collectAvailableManifestColumns(allBookings, forms),
    [allBookings, forms]
  );

  const basicColumns = useMemo(
    () => availableColumns.filter((c) => c.group === 'basic'),
    [availableColumns]
  );

  const travelerColumns = useMemo(
    () => availableColumns.filter((c) => c.group === 'traveler'),
    [availableColumns]
  );

  const defaultColumnIds = useMemo(
    () => availableColumns.filter((c) => c.defaultSelected).map((c) => c.id),
    [availableColumns]
  );

  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() =>
    availableColumns.filter((c) => c.defaultSelected).map((c) => c.id)
  );

  const selectedPackageObj = useMemo(
    () => packages.find((p) => p.id === packageIdFilter) || null,
    [packages, packageIdFilter]
  );

  const packageLabel = useMemo(() => {
    if (selectedPackageObj) return selectedPackageObj.title;
    const uniqueTitles = Array.from(new Set(sourceBookings.map((b) => b.packageTitle))).filter(Boolean);
    if (uniqueTitles.length === 1) return uniqueTitles[0];
    return 'جميع الباقات';
  }, [selectedPackageObj, sourceBookings]);

  const [reportTitle, setReportTitle] = useState<string>(() =>
    packageLabel !== 'جميع الباقات'
      ? `كشف مسافرين — ${packageLabel}`
      : `كشف المسافرين الرسمي — ${settings.agencyName}`
  );
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  useEffect(() => {
    if (!titleManuallyEdited) {
      setReportTitle(
        packageLabel !== 'جميع الباقات'
          ? `كشف مسافرين — ${packageLabel}`
          : `كشف المسافرين الرسمي — ${settings.agencyName}`
      );
    }
  }, [packageLabel, settings.agencyName, titleManuallyEdited]);

  const [licenseNumber, setLicenseNumber] = useState<string>(settings.licenseNumber || '');
  const [footerNote, setFooterNote] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [exportingType, setExportingType] = useState<'pdf' | 'excel' | null>(null);
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);

  const columnMap = useMemo(() => {
    const map = new Map<string, ManifestColumnDef>();
    availableColumns.forEach((c) => map.set(c.id, c));
    return map;
  }, [availableColumns]);

  const orderedSelectedColumns = useMemo(
    () =>
      selectedColumnIds
        .map((id) => columnMap.get(id))
        .filter((c): c is ManifestColumnDef => Boolean(c)),
    [selectedColumnIds, columnMap]
  );

  const dataset = useMemo(
    () =>
      buildManifestDataset(sourceBookings, forms, {
        statusFilter,
        packageIdFilter,
        categoryFilter,
        selectedColumnIds,
      }),
    [sourceBookings, forms, statusFilter, packageIdFilter, categoryFilter, selectedColumnIds]
  );

  const exportOptions: ManifestExportOptions = {
    reportTitle,
    footerNote,
    licenseNumber,
    statusFilter,
    packageIdFilter,
    categoryFilter,
    selectedColumnIds,
    orientation,
  };

  const toggleColumn = (colId: string) => {
    setSelectedColumnIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const selectGroup = (groupCols: ManifestColumnDef[]) => {
    const ids = groupCols.map((c) => c.id);
    setSelectedColumnIds((prev) => {
      const next = [...prev];
      ids.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  };

  const deselectGroup = (groupCols: ManifestColumnDef[]) => {
    const groupSet = new Set(groupCols.map((c) => c.id));
    setSelectedColumnIds((prev) => prev.filter((id) => !groupSet.has(id)));
  };

  const moveSelectedColumn = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= selectedColumnIds.length || fromIdx === toIdx) return;
    setSelectedColumnIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleExportExcel = async () => {
    if (orderedSelectedColumns.length === 0) {
      showToast('يُرجى اختيار حقل واحد على الأقل للتصدير.', 'error');
      return;
    }
    if (dataset.rows.length === 0) {
      showToast('لا توجد بيانات مسافرين مطابقة لمعايير التصفية الحالية.', 'error');
      return;
    }
    setExportingType('excel');
    try {
      const fileName = await exportManifestToExcel({
        dataset,
        columns: orderedSelectedColumns,
        options: exportOptions,
        settings,
        packageLabel,
      });
      showToast(`تم تنزيل ملف Excel بنجاح: ${fileName}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء إنشاء ملف Excel.', 'error');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPdf = async () => {
    if (orderedSelectedColumns.length === 0) {
      showToast('يُرجى اختيار حقل واحد على الأقل للتصدير.', 'error');
      return;
    }
    if (dataset.rows.length === 0) {
      showToast('لا توجد بيانات مسافرين مطابقة لمعايير التصفية الحالية.', 'error');
      return;
    }
    setExportingType('pdf');
    try {
      const fileName = await exportManifestToPdf({
        dataset,
        columns: orderedSelectedColumns,
        options: exportOptions,
        settings,
        packageLabel,
      });
      showToast(`تم تنزيل ملف PDF بنجاح: ${fileName}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تجهيز ملف PDF. يمكنك استخدام خيار الطباعة المباشرة أيضاً.', 'error');
    } finally {
      setExportingType(null);
    }
  };

  const printDateTimeLabel = useMemo(
    () =>
      new Date().toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="bg-white w-full max-w-6xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-4 shadow-2xl">
        {/* Modal Header (Hidden on print) */}
        <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex flex-wrap items-center justify-between gap-4 no-print">
          <div>
            <h2 className="font-display font-extrabold text-lg text-[#0F332B]">
              تصدير وطباعة كشف المسافرين الرسمي
            </h2>
            <p className="text-xs text-[#6B7A74]">
              خصّص الأعمدة، رتّب ظهورها، وحدد التصفية قبل التنزيل بصيغة PDF أو Excel (.xlsx)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                showPreview
                  ? 'bg-[#0F332B] text-white border-[#0F332B]'
                  : 'bg-white text-[#0F332B] border-[#E6DCCA] hover:bg-[#EFE7D8]'
              }`}
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'العودة لتخصيص الحقول' : 'معاينة الكشف قبل التصدير'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#556660] hover:bg-[#EFE7D8]"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {showPreview ? (
          /* Clean Official Print Preview */
          <div className="p-4 sm:p-8 bg-[#F5F2EB] max-h-[75vh] overflow-y-auto">
            <div className="bg-white border border-[#E6DCCA] rounded-xl p-6 sm:p-8 max-w-5xl mx-auto space-y-6 text-[#142621]">
              {/* Official Header */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2"
                style={{ borderColor: settings.primaryColor || '#0F332B' }}
              >
                <div className="flex items-center gap-3">
                  <BrandLogo settings={settings} size="md" showWordmark={false} />
                  <div>
                    <p
                      className="font-display font-extrabold text-base"
                      style={{ color: settings.primaryColor || '#0F332B' }}
                    >
                      {settings.agencyName} {settings.agencySubtitle}
                    </p>
                    <p className="text-[11px] text-[#8C6D2E]">{settings.tagline}</p>
                    {licenseNumber.trim() && (
                      <p className="text-[11px] font-bold text-[#374B45] mt-0.5">
                        {licenseNumber.trim()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-center flex-1">
                  <h3
                    className="font-display font-extrabold text-lg"
                    style={{ color: settings.primaryColor || '#0F332B' }}
                  >
                    {reportTitle.trim() || 'كشف المسافرين الرسمي'}
                  </h3>
                  <p className="text-xs text-[#556660] mt-0.5">
                    النطاق: <strong className="text-[#142621]">{packageLabel}</strong> · إجمالي
                    المسافرين: <strong className="tabular-nums">{dataset.totalTravelers}</strong>
                  </p>
                </div>

                <div className="text-right sm:text-left text-xs text-[#556660] sm:border-r sm:border-[#B88E3E] sm:pr-4">
                  <p>تاريخ ووقت الطباعة</p>
                  <p className="font-bold text-[#142621] mt-0.5">{printDateTimeLabel}</p>
                  {settings.contacts?.[0]?.phone && (
                    <p className="mt-0.5">
                      هاتف:{' '}
                      <span className="font-mono tabular-nums text-[#142621]" dir="ltr">
                        {settings.contacts[0].phone}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Dynamic Columns Manifest Table */}
              {orderedSelectedColumns.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#556660] border border-dashed border-[#D8CBB3] rounded-xl">
                  لم يتم تحديد أي أعمدة للعرض. عُد إلى التخصيص واختر الأعمدة المطلوبة.
                </div>
              ) : dataset.rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#556660] border border-dashed border-[#D8CBB3] rounded-xl">
                  لا توجد بيانات مسافرين مطابقة لمعايير التصفية المختارة.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E2D7C3] rounded-lg">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr
                        className="text-white"
                        style={{ backgroundColor: settings.primaryColor || '#0F332B' }}
                      >
                        <th className="py-2.5 px-2.5 font-display font-bold text-center border border-white/15 w-10">
                          #
                        </th>
                        {orderedSelectedColumns.map((col) => (
                          <th
                            key={col.id}
                            className="py-2.5 px-3 font-display font-bold text-center border border-white/15 whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.rows.map((row, rIdx) => (
                        <tr
                          key={`${row.booking.id}_${row.traveler.index}_${rIdx}`}
                          className={rIdx % 2 === 1 ? 'bg-[#FAF7F0]' : 'bg-white'}
                        >
                          <td className="py-2 px-2.5 text-center font-mono tabular-nums text-[#556660] border border-[#E2D7C3]">
                            {row.serial}
                          </td>
                          {orderedSelectedColumns.map((col) => (
                            <td
                              key={col.id}
                              className={`py-2 px-3 border border-[#E2D7C3] ${
                                col.isIdentifierOrPhone
                                  ? 'text-center font-mono tabular-nums text-[11px]'
                                  : 'text-right'
                              }`}
                            >
                              {col.isIdentifierOrPhone ? (
                                <span dir="ltr">{row.values[col.id] ?? '—'}</span>
                              ) : (
                                row.values[col.id] ?? '—'
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Official Footer */}
              <div className="pt-4 border-t border-[#D8CBB3] space-y-3">
                {footerNote.trim() && (
                  <div className="p-3 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-[#374B45]">
                    <strong className="text-[#0F332B]">ملاحظة:</strong> {footerNote.trim()}
                  </div>
                )}

                <div className="flex flex-wrap items-end justify-between gap-4 text-xs">
                  <div>
                    <p
                      className="font-display font-bold"
                      style={{ color: settings.primaryColor || '#0F332B' }}
                    >
                      إجمالي عدد المسافرين: <span className="tabular-nums">{dataset.totalTravelers}</span> مسافر
                    </p>
                    <p className="text-[#556660] mt-0.5 tabular-nums">
                      بالغين: <strong className="text-[#142621]">{dataset.adultsCount}</strong> · أطفال:{' '}
                      <strong className="text-[#142621]">{dataset.childrenCount}</strong> · رضع:{' '}
                      <strong className="text-[#142621]">{dataset.infantsCount}</strong> · الحجوزات:{' '}
                      <strong className="text-[#142621]">{dataset.bookingsCount}</strong>
                    </p>
                  </div>

                  <div className="text-center min-w-[200px]">
                    <p className="text-[11px] text-[#556660] mb-5">
                      توقيع وختم المكتب / مندوب الرحلة
                    </p>
                    <div className="border-b border-dashed border-[#B88E3E] w-48 mx-auto" />
                  </div>

                  <div className="text-left text-[11px] text-[#6B7A74]">
                    <p className="font-display font-bold text-[#0F332B]">صفحة 1 من 1 (معاينة)</p>
                    <p>يتم ترقيم الصفحات تلقائياً عند التصدير PDF</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Customization Controls Body */
          <div className="p-6 space-y-6 max-h-[73vh] overflow-y-auto no-print">
            {/* 1. Scope & Pre-Export Filters */}
            <section className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display font-bold text-sm text-[#0F332B]">
                  1. نطاق البيانات وخيارات التصفية قبل التصدير
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#556660] tabular-nums">
                  <span>
                    الحجوزات المشمولة: <strong className="text-[#0F332B]">{dataset.bookingsCount}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    المسافرون: <strong className="text-[#0E6E73]">{dataset.totalTravelers}</strong>
                    {' '}({dataset.adultsCount} بالغ · {dataset.childrenCount} طفل · {dataset.infantsCount} رضيع)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#556660]">مصدر الحجوزات</label>
                  <select
                    value={sourceScope}
                    onChange={(e) => setSourceScope(e.target.value as ManifestSourceScope)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    {selectedBookings.length > 0 && (
                      <option value="selected">
                        الحجوزات المختارة ({selectedBookings.length})
                      </option>
                    )}
                    <option value="filtered">
                      حسب الفلتر الحالي ({filteredBookings.length})
                    </option>
                    <option value="all">جميع الحجوزات ({allBookings.length})</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#556660]">الباقة / الرحلة</label>
                  <select
                    value={packageIdFilter}
                    onChange={(e) => setPackageIdFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    <option value="all">جميع الباقات ضمن النطاق</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#556660]">تصفية حالة الحجز</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ManifestStatusFilter)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    <option value="exclude_cancelled">استبعاد الحجوزات الملغاة</option>
                    <option value="confirmed_only">الحجوزات المؤكدة فقط</option>
                    <option value="confirmed_and_awaiting">المؤكدة وبانتظار الدفع</option>
                    <option value="all">جميع الحالات (بما فيها الملغاة)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#556660]">الفئة العمرية للمسافرين</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as ManifestCategoryFilter)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    <option value="all">جميع الفئات (بالغين / أطفال / رضع)</option>
                    <option value="adult">البالغين فقط</option>
                    <option value="child">الأطفال فقط</option>
                    <option value="infant">الرضع فقط</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 2. Dynamic Column Selector & Ordering */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Available Fields Selection */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-sm text-[#0F332B]">
                    2. اختيار الحقول المطلوبة في الكشف ({selectedColumnIds.length} حقل محدد)
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedColumnIds(availableColumns.map((c) => c.id))}
                      className="px-2.5 py-1 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] font-semibold text-[#0F332B]"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedColumnIds([])}
                      className="px-2.5 py-1 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-red-300 font-semibold text-[#556660]"
                    >
                      إلغاء الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedColumnIds(defaultColumnIds)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] font-semibold text-[#0E6E73]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      الافتراضي
                    </button>
                  </div>
                </div>

                {/* Group A: Basic Fields */}
                <div className="p-4 rounded-2xl border border-[#E6DCCA] bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-[#0F332B]">
                      أ. الحقول الأساسية للحجز
                    </p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => selectGroup(basicColumns)}
                        className="text-[#0E6E73] font-semibold hover:underline"
                      >
                        تحديد المجموعة
                      </button>
                      <span className="text-[#D8CBB3]">|</span>
                      <button
                        type="button"
                        onClick={() => deselectGroup(basicColumns)}
                        className="text-[#6B7A74] hover:underline"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {basicColumns.map((col) => {
                      const checked = selectedColumnIds.includes(col.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleColumn(col.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-right transition-colors ${
                            checked
                              ? 'bg-[#0F332B]/5 border-[#0F332B] font-bold text-[#0F332B]'
                              : 'bg-[#FAF7F0]/60 border-[#E6DCCA] text-[#556660] hover:border-[#0E6E73]'
                          }`}
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-[#0F332B] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-[#A09684] shrink-0" />
                          )}
                          <span className="truncate">{col.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group B: Dynamic Traveler Fields */}
                <div className="p-4 rounded-2xl border border-[#E6DCCA] bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-[#0F332B]">
                      ب. الحقول الديناميكية للمسافر وحقول منشئ الاستمارات
                    </p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => selectGroup(travelerColumns)}
                        className="text-[#0E6E73] font-semibold hover:underline"
                      >
                        تحديد المجموعة
                      </button>
                      <span className="text-[#D8CBB3]">|</span>
                      <button
                        type="button"
                        onClick={() => deselectGroup(travelerColumns)}
                        className="text-[#6B7A74] hover:underline"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {travelerColumns.map((col) => {
                      const checked = selectedColumnIds.includes(col.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleColumn(col.id)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs text-right transition-colors ${
                            checked
                              ? 'bg-[#0E6E73]/10 border-[#0E6E73] font-bold text-[#0F332B]'
                              : 'bg-[#FAF7F0]/60 border-[#E6DCCA] text-[#556660] hover:border-[#0E6E73]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 min-w-0">
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-[#0E6E73] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-[#A09684] shrink-0" />
                            )}
                            <span className="truncate">{col.label}</span>
                          </span>
                          {col.hint && (
                            <span className="text-[10px] text-[#8C6D2E] shrink-0 truncate max-w-[110px]">
                              {col.hint}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Column Ordering Panel */}
              <div className="lg:col-span-5 p-4 rounded-2xl border border-[#E6DCCA] bg-[#FAF7F0] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-xs text-[#0F332B]">
                    ترتيب ظهور الأعمدة في الكشف
                  </h4>
                  <span className="text-[11px] text-[#6B7A74]">اسحب أو استخدم الأسهم</span>
                </div>

                {orderedSelectedColumns.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#6B7A74] bg-white rounded-xl border border-dashed border-[#D8CBB3]">
                    اختر حقلاً واحداً على الأقل من القائمة لتحديد ترتيبه هنا.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto pl-1">
                    {orderedSelectedColumns.map((col, idx) => (
                      <div
                        key={col.id}
                        draggable
                        onDragStart={() => setDragColIdx(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverColIdx(idx);
                        }}
                        onDragLeave={() => setDragOverColIdx(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragColIdx !== null && dragColIdx !== idx) {
                            moveSelectedColumn(dragColIdx, idx);
                          }
                          setDragColIdx(null);
                          setDragOverColIdx(null);
                        }}
                        onDragEnd={() => {
                          setDragColIdx(null);
                          setDragOverColIdx(null);
                        }}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-white text-xs transition-colors ${
                          dragOverColIdx === idx && dragColIdx !== idx
                            ? 'border-[#0E6E73] bg-[#0E6E73]/5'
                            : 'border-[#E6DCCA]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-3.5 h-3.5 text-[#B88E3E] shrink-0" />
                          <span className="font-mono text-[11px] font-bold text-[#6B7A74] tabular-nums w-5">
                            {idx + 1}.
                          </span>
                          <span className="font-semibold text-[#0F332B] truncate">
                            {col.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveSelectedColumn(idx, idx - 1)}
                            className="p-1 rounded-md hover:bg-[#EFE7D8] disabled:opacity-30"
                            title="تقديم العمود"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === orderedSelectedColumns.length - 1}
                            onClick={() => moveSelectedColumn(idx, idx + 1)}
                            className="p-1 rounded-md hover:bg-[#EFE7D8] disabled:opacity-30"
                            title="تأخير العمود"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleColumn(col.id)}
                            className="p-1 rounded-md text-red-700 hover:bg-red-50"
                            title="إزالة من الكشف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 3. Report Title, Official Header Details & Footer Notes */}
            <section className="p-4 sm:p-5 rounded-2xl border border-[#E6DCCA] bg-white space-y-4">
              <h3 className="font-display font-bold text-sm text-[#0F332B]">
                3. عنوان الكشف والترويسة وملاحظات التذييل
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">عنوان الكشف المخصص</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => {
                      setTitleManuallyEdited(true);
                      setReportTitle(e.target.value);
                    }}
                    placeholder="مثال: كشف مسافرين رحلة إسطنبول - فوج رقم 1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-semibold text-[#0F332B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">اتجاه صفحة PDF</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as ManifestOrientation)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
                  >
                    <option value="auto">
                      تلقائي ({orderedSelectedColumns.length > 6 ? 'أفقي' : 'عمودي'})
                    </option>
                    <option value="portrait">عمودي (Portrait)</option>
                    <option value="landscape">أفقي (Landscape)</option>
                  </select>
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    رقم الترخيص / السجل التجاري (في الترويسة الرسمية)
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="مثال: سجل تجاري 2031XXXXXX — ترخيص وزارة السياحة 7310XXXX"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    ملاحظات التذييل أسفل الكشف (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={footerNote}
                    onChange={(e) => setFooterNote(e.target.value)}
                    placeholder="مثال: يُرجى التواجد قبل موعد الإقلاع بـ 3 ساعات · مسؤول الفوج: أ. محمد السالم"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer Actions Bar */}
        <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6DCCA] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="text-xs text-[#556660] tabular-nums">
            جاهز للتصدير: <strong className="text-[#0F332B]">{dataset.totalTravelers}</strong> مسافر
            من <strong className="text-[#0F332B]">{dataset.bookingsCount}</strong> حجز ·{' '}
            <strong className="text-[#0E6E73]">{orderedSelectedColumns.length}</strong> عمود
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {showPreview && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-[#E6DCCA] text-[#0F332B] hover:bg-[#EFE7D8]"
              >
                <Printer className="w-4 h-4" />
                طباعة مباشرة
              </button>
            )}

            <button
              type="button"
              disabled={exportingType !== null || orderedSelectedColumns.length === 0 || dataset.rows.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: 'var(--brand-secondary)' }}
            >
              {exportingType === 'excel' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {exportingType === 'excel' ? 'جارٍ تجهيز Excel...' : 'تصدير Excel (.xlsx)'}
            </button>

            <button
              type="button"
              disabled={exportingType !== null || orderedSelectedColumns.length === 0 || dataset.rows.length === 0}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {exportingType === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-[#E8C97E]" />
              )}
              {exportingType === 'pdf' ? 'جارٍ توليد PDF...' : 'تصدير PDF رسمي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
