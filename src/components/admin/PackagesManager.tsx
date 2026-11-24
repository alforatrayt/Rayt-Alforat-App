import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Eye,
  EyeOff,
  Trash2,
  X,
  Upload,
  Loader2,
  FileSpreadsheet,
  Users,
  Bus,
  FolderKanban,
  Package,
} from 'lucide-react';
import {
  TRIP_TYPE_LABELS,
  type FormTemplate,
  type ItineraryDay,
  type PackageBus,
  type PackageCategory,
  type TravelPackage,
  type TripType,
} from '../../types';
import { ASSET_IMAGES, CURATED_PACKAGE_IMAGES } from '../../data/defaults';
import {
  deleteCategoryById,
  deletePackageById,
  saveCategory,
  savePackage,
} from '../../services/firestoreService';
import { compressFileToDataUrl, generateSafeId } from '../../utils/imageCompress';
import { useToast } from '../ToastProvider';

interface PackagesManagerProps {
  packages: TravelPackage[];
  categories: PackageCategory[];
  forms: FormTemplate[];
  onRefresh: () => Promise<void>;
  onExportManifest?: (pkg: TravelPackage) => void;
}

const EMPTY_PACKAGE = (defaultFormId: string, defaultCategoryId = ''): TravelPackage => ({
  id: '',
  title: '',
  subtitle: '',
  destination: '',
  tripType: 'umrah',
  categoryId: defaultCategoryId,
  durationDays: 3,
  durationNights: 2,
  durationLabel: '3 أيام',
  departureDate: '',
  price: 299,
  childPrice: 200,
  infantPrice: 50,
  currency: 'ريال',
  availableSeats: 30,
  buses: [],
  coverImage: ASSET_IMAGES.makkahMadinah,
  highlights: ['النقل والسكن', 'السكن الفندقي', 'الإرشاد الديني'],
  itinerary: [{ day: 1, title: 'يوم الانطلاق والوصول', description: '' }],
  inclusions: ['النقل بحافلات حديثة', 'السكن الفندقي'],
  exclusions: ['المصروفات الشخصية'],
  hotelInfo: '',
  transportInfo: '',
  cancellationPolicy: '',
  formTemplateId: defaultFormId,
  featured: false,
  visible: true,
});

const EMPTY_CATEGORY = (nextOrder: number): Omit<PackageCategory, 'createdAt' | 'updatedAt'> => ({
  id: '',
  name: '',
  description: '',
  order: nextOrder,
  active: true,
});

export const PackagesManager: React.FC<PackagesManagerProps> = ({
  packages,
  categories,
  forms,
  onRefresh,
  onExportManifest,
}) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'packages' | 'categories'>('packages');

  // Package state
  const [editingPkg, setEditingPkg] = useState<TravelPackage | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Category state
  const [editingCat, setEditingCat] = useState<Omit<PackageCategory, 'createdAt' | 'updatedAt'> | null>(null);
  const [isNewCat, setIsNewCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);

  const defaultFormId = forms.find((f) => f.isDefault)?.id || forms[0]?.id || 'form_umrah_domestic';
  const formNameMap = new Map<string, string>();
  forms.forEach((f) => formNameMap.set(f.id, f.name));

  const categoryMap = new Map<string, PackageCategory>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  const openCreate = () => {
    setIsNew(true);
    const firstActiveCat = categories.find((c) => c.active)?.id || categories[0]?.id || '';
    setEditingPkg(EMPTY_PACKAGE(defaultFormId, firstActiveCat));
  };

  const openEdit = (pkg: TravelPackage) => {
    setIsNew(false);
    setEditingPkg({
      ...pkg,
      categoryId: pkg.categoryId || '',
      buses: (pkg.buses || []).map((b) => ({ ...b })),
      highlights: [...(pkg.highlights || [])],
      inclusions: [...(pkg.inclusions || [])],
      exclusions: [...(pkg.exclusions || [])],
      itinerary: (pkg.itinerary || []).map((d) => ({ ...d })),
    });
  };

  const handleToggleVisible = async (pkg: TravelPackage) => {
    try {
      await savePackage({ ...pkg, visible: !pkg.visible }, false);
      showToast(pkg.visible ? 'تم إخفاء الباقة عن العملاء' : 'تم إظهار الباقة للعملاء', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر تحديث حالة الباقة', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePackageById(id);
      setConfirmDeleteId(null);
      showToast('تم حذف الباقة بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف الباقة', 'error');
    }
  };

  const handleCoverFile = async (file: File | null) => {
    if (!file || !editingPkg) return;
    setUploadingCover(true);
    try {
      const res = await compressFileToDataUrl(file, 1000, 180000);
      setEditingPkg({ ...editingPkg, coverImage: res.dataUrl });
      showToast('تم رفع وضغط صورة الغلاف بنجاح', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر معالجة الصورة', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPkg) return;
    if (!editingPkg.title.trim() || !editingPkg.destination.trim()) {
      showToast('يُرجى إدخال عنوان الباقة والوجهة.', 'error');
      return;
    }

    setSaving(true);
    try {
      await savePackage(editingPkg, isNew);
      showToast(isNew ? 'تمت إضافة الباقة بنجاح' : 'تم حفظ تعديلات الباقة بنجاح', 'success');
      setEditingPkg(null);
      await onRefresh();
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ الباقة.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateItineraryDay = (idx: number, patch: Partial<ItineraryDay>) => {
    if (!editingPkg) return;
    const next = editingPkg.itinerary.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    setEditingPkg({ ...editingPkg, itinerary: next });
  };

  const addBusToPkg = () => {
    if (!editingPkg) return;
    const nextIdx = (editingPkg.buses || []).length + 1;
    const newBus: PackageBus = {
      id: generateSafeId('bus'),
      name: `باص رقم ${nextIdx}`,
      capacity: 45,
      notes: '',
    };
    setEditingPkg({
      ...editingPkg,
      buses: [...(editingPkg.buses || []), newBus],
    });
  };

  const updateBusInPkg = (idx: number, patch: Partial<PackageBus>) => {
    if (!editingPkg) return;
    const next = (editingPkg.buses || []).map((b, i) => (i === idx ? { ...b, ...patch } : b));
    setEditingPkg({ ...editingPkg, buses: next });
  };

  const removeBusFromPkg = (idx: number) => {
    if (!editingPkg) return;
    setEditingPkg({
      ...editingPkg,
      buses: (editingPkg.buses || []).filter((_, i) => i !== idx),
    });
  };

  // Category CRUD Handlers
  const openCreateCategory = () => {
    setIsNewCat(true);
    setEditingCat(EMPTY_CATEGORY(categories.length + 1));
  };

  const openEditCategory = (cat: PackageCategory) => {
    setIsNewCat(false);
    setEditingCat({
      id: cat.id,
      name: cat.name,
      description: cat.description || '',
      order: cat.order ?? 1,
      active: Boolean(cat.active),
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editingCat.name.trim()) {
      showToast('يُرجى إدخال اسم التصنيف.', 'error');
      return;
    }
    setSavingCat(true);
    try {
      await saveCategory(editingCat, isNewCat);
      showToast(isNewCat ? 'تمت إضافة التصنيف بنجاح' : 'تم تحديث التصنيف بنجاح', 'success');
      setEditingCat(null);
      await onRefresh();
    } catch {
      showToast('تعذر حفظ التصنيف.', 'error');
    } finally {
      setSavingCat(false);
    }
  };

  const handleToggleCategoryActive = async (cat: PackageCategory) => {
    try {
      await saveCategory({ ...cat, active: !cat.active }, false);
      showToast(cat.active ? 'تم تعطيل التصنيف' : 'تم تفعيل التصنيف', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر تحديث حالة التصنيف.', 'error');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      await deleteCategoryById(catId);
      setConfirmDeleteCatId(null);
      showToast('تم حذف التصنيف بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف التصنيف.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            إدارة الباقات والتصنيفات
          </h1>
          <p className="text-sm text-[#556660]">
            أنشئ تصنيفات الرحلات، أضف الباقات واربطها بالتصنيف والحافلات والاستمارات المناسبة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E6DCCA]">
            <button
              type="button"
              onClick={() => setSubTab('packages')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                subTab === 'packages'
                  ? 'bg-[#0F332B] text-white'
                  : 'text-[#556660] hover:text-[#0F332B]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              الباقات ({packages.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('categories')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                subTab === 'categories'
                  ? 'bg-[#0F332B] text-white'
                  : 'text-[#556660] hover:text-[#0F332B]'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              التصنيفات ({categories.length})
            </button>
          </div>

          {subTab === 'packages' ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <Plus className="w-4 h-4" />
              إضافة باقة جديدة
            </button>
          ) : (
            <button
              type="button"
              onClick={openCreateCategory}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              <Plus className="w-4 h-4" />
              إضافة تصنيف جديد
            </button>
          )}
        </div>
      </div>

      {/* Categories Sub-Tab */}
      {subTab === 'categories' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-[#374B45] leading-relaxed">
            <strong>قاعدة العرض التلقائي:</strong> لن يظهر أي عنوان تصنيف في الصفحة الرئيسية للعملاء إلا إذا كان التصنيف مُفعَّلاً ويحتوي على باقة واحدة ظاهرة على الأقل.
          </div>

          <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
            {categories.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FolderKanban className="w-10 h-10 text-[#B88E3E] mx-auto" />
                <p className="text-sm font-bold text-[#0F332B]">لا توجد تصنيفات مضافة حالياً.</p>
                <p className="text-xs text-[#556660]">
                  أنشئ تصنيفات مثل: باقات العمرة، رحلات داخلية، رحلات دولية، عروض خاصة لترتيب باقات الموقع.
                </p>
                <button
                  type="button"
                  onClick={openCreateCategory}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  إضافة أول تصنيف
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">الترتيب</th>
                      <th className="py-3.5 px-4 font-semibold">اسم التصنيف</th>
                      <th className="py-3.5 px-4 font-semibold">الوصف</th>
                      <th className="py-3.5 px-4 font-semibold">عدد الباقات</th>
                      <th className="py-3.5 px-4 font-semibold">الحالة</th>
                      <th className="py-3.5 px-4 font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E9DC]">
                    {categories.map((cat) => {
                      const linkedCount = packages.filter((p) => p.categoryId === cat.id).length;
                      const visibleLinkedCount = packages.filter(
                        (p) => p.categoryId === cat.id && p.visible
                      ).length;
                      return (
                        <tr key={cat.id} className="hover:bg-[#FAF7F0]/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#0F332B] tabular-nums">
                            {cat.order}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#0F332B]">{cat.name}</td>
                          <td className="py-3.5 px-4 text-xs text-[#556660] max-w-xs truncate">
                            {cat.description || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-xs tabular-nums">
                            <span className="font-bold text-[#0F332B]">{visibleLinkedCount} ظاهرة</span>
                            <span className="text-[#6B7A74]"> / {linkedCount} إجمالي</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            {cat.active ? (
                              <span className="text-[#0E6E73]">مُفعَّل</span>
                            ) : (
                              <span className="text-[#6B7A74]">معطّل</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditCategory(cat)}
                                className="p-2 rounded-lg text-[#0F332B] hover:bg-[#EFE7D8]"
                                title="تعديل"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleCategoryActive(cat)}
                                className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
                                title={cat.active ? 'تعطيل التصنيف' : 'تفعيل التصنيف'}
                              >
                                {cat.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              {confirmDeleteCatId === cat.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="px-2.5 py-1 rounded-lg bg-red-700 text-white text-xs font-bold"
                                >
                                  تأكيد الحذف
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCatId(cat.id)}
                                  className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                                  title="حذف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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
        </div>
      )}

      {/* Packages Table */}
      {subTab === 'packages' && (
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
        {packages.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-[#556660]">لا توجد باقات مسجلة حالياً.</p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              إضافة أول باقة
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">الباقة</th>
                  <th className="py-3.5 px-4 font-semibold">التصنيف والمدة</th>
                  <th className="py-3.5 px-4 font-semibold">السعر</th>
                  <th className="py-3.5 px-4 font-semibold">الحافلات والمقاعد</th>
                  <th className="py-3.5 px-4 font-semibold">الاستمارة المرتبطة</th>
                  <th className="py-3.5 px-4 font-semibold">الظهور</th>
                  <th className="py-3.5 px-4 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DC]">
                {packages.map((pkg) => {
                  const catObj = pkg.categoryId ? categoryMap.get(pkg.categoryId) : undefined;
                  const busCount = pkg.buses?.length || 0;
                  return (
                  <tr key={pkg.id} className="hover:bg-[#FAF7F0]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={pkg.coverImage || ASSET_IMAGES.makkahUmrah}
                          alt={pkg.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-10 rounded-lg object-cover border border-[#E6DCCA] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-[#0F332B] truncate max-w-[220px]">
                            {pkg.title}
                          </p>
                          <p className="text-xs text-[#6B7A74] truncate max-w-[220px]">
                            {pkg.destination} · {pkg.departureDate}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#374B45]">
                      <p className="font-semibold text-[#0E6E73]">
                        {catObj ? catObj.name : TRIP_TYPE_LABELS[pkg.tripType]}
                      </p>
                      <p>{pkg.durationLabel}</p>
                    </td>
                    <td className="py-3.5 px-4 font-bold tabular-nums whitespace-nowrap">
                      {pkg.price.toLocaleString('ar-SA')} {pkg.currency}
                    </td>
                    <td className="py-3.5 px-4 text-xs tabular-nums">
                      <p className="font-bold text-[#0F332B]">{pkg.availableSeats} مقعد</p>
                      <p className="text-[#6B7A74]">
                        {busCount > 0 ? `${busCount} حافلات / أفواج` : 'بدون حافلات محددة'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#374B45]">
                      <span className="inline-flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#B88E3E]" />
                        {formNameMap.get(pkg.formTemplateId) || 'الاستمارة الافتراضية'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      {pkg.visible ? (
                        <span className="text-[#0E6E73]">ظاهرة</span>
                      ) : (
                        <span className="text-[#6B7A74]">مخفية</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {onExportManifest && (
                          <button
                            type="button"
                            onClick={() => onExportManifest(pkg)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B] whitespace-nowrap"
                            title="تصدير كشف مسافرين هذه الباقة"
                          >
                            <Users className="w-3.5 h-3.5 text-[#0E6E73]" />
                            كشف المسافرين
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(pkg)}
                          className="p-2 rounded-lg text-[#0F332B] hover:bg-[#EFE7D8]"
                          title="تعديل"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleVisible(pkg)}
                          className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
                          title={pkg.visible ? 'إخفاء عن العملاء' : 'إظهار للعملاء'}
                        >
                          {pkg.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {confirmDeleteId === pkg.id ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(pkg.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-700 text-white text-xs font-bold"
                          >
                            تأكيد الحذف
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(pkg.id)}
                            className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
      )}

      {/* Create / Edit Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <form
            onSubmit={handleSave}
            className="bg-white w-full max-w-4xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-6"
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <h2 className="font-display font-extrabold text-lg text-[#0F332B]">
                {isNew ? 'إضافة باقة سياحية جديدة' : `تعديل الباقة: ${editingPkg.title}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditingPkg(null)}
                className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">عنوان الباقة *</label>
                  <input
                    type="text"
                    required
                    value={editingPkg.title}
                    onChange={(e) => setEditingPkg({ ...editingPkg, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">الوجهة *</label>
                  <input
                    type="text"
                    required
                    value={editingPkg.destination}
                    onChange={(e) => setEditingPkg({ ...editingPkg, destination: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">الوصف المختصر</label>
                  <input
                    type="text"
                    value={editingPkg.subtitle}
                    onChange={(e) => setEditingPkg({ ...editingPkg, subtitle: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">تصنيف الباقة (القسم في الرئيسية)</label>
                  <select
                    value={editingPkg.categoryId || ''}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, categoryId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#0E6E73] text-sm font-medium"
                  >
                    <option value="">بدون تصنيف محدد (عام)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {!cat.active ? '(معطّل)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">نوع الرحلة</label>
                  <select
                    value={editingPkg.tripType}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, tripType: e.target.value as TripType })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  >
                    {Object.entries(TRIP_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    الاستمارة الديناميكية المرتبطة بهذه الباقة
                  </label>
                  <select
                    value={editingPkg.formTemplateId}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, formTemplateId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#0E6E73] text-sm font-medium"
                  >
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.fields.length} حقول)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buses / Groups Editor */}
              <div className="space-y-3 pt-4 border-t border-[#F0E9DC]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-[#0F332B] inline-flex items-center gap-1.5">
                      <Bus className="w-4 h-4 text-[#0E6E73]" />
                      إدارة الحافلات / الأفواج لهذه الباقة
                    </label>
                    <p className="text-[11px] text-[#6B7A74]">
                      أضف الحافلات أو الأفواج وسعة كل منها ليتم تسكين المسافرين وفرز التقارير المالية حسب الحافلة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addBusToPkg}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-bold text-[#0E6E73] shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة حافلة / فوج
                  </button>
                </div>

                {(editingPkg.buses || []).length === 0 ? (
                  <p className="text-xs text-[#6B7A74] p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]">
                    لم تُضف حافلات أو أفواج لهذه الباقة بعد.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {(editingPkg.buses || []).map((bus, idx) => (
                      <div
                        key={bus.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] items-center"
                      >
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            required
                            value={bus.name}
                            onChange={(e) => updateBusInPkg(idx, { name: e.target.value })}
                            placeholder="اسم الحافلة / الفوج (مثال: باص رقم 1)"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs font-bold text-[#0F332B]"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={bus.capacity}
                            onChange={(e) =>
                              updateBusInPkg(idx, { capacity: Number(e.target.value) || 45 })
                            }
                            placeholder="السعة"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs font-mono text-center"
                            title="السعة الاستيعابية للمقاعد"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            value={bus.notes || ''}
                            onChange={(e) => updateBusInPkg(idx, { notes: e.target.value })}
                            placeholder="ملاحظة (مثال: انطلاق الدمام 4 عصراً)"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeBusFromPkg(idx)}
                            className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                            title="حذف الحافلة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dates, Duration, Pricing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#F0E9DC]">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-[#0F332B]">تاريخ الانطلاق *</label>
                  <input
                    type="text"
                    required
                    value={editingPkg.departureDate}
                    onChange={(e) => setEditingPkg({ ...editingPkg, departureDate: e.target.value })}
                    placeholder="الأربعاء 14 أكتوبر 2026"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">عدد الأيام</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={editingPkg.durationDays}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, durationDays: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">عدد الليالي</label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={editingPkg.durationNights}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, durationNights: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">تسمية المدة</label>
                  <input
                    type="text"
                    value={editingPkg.durationLabel}
                    onChange={(e) => setEditingPkg({ ...editingPkg, durationLabel: e.target.value })}
                    placeholder="3 أيام / ليلتان"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">سعر البالغ</label>
                  <input
                    type="number"
                    min={0}
                    value={editingPkg.price}
                    onChange={(e) => setEditingPkg({ ...editingPkg, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">سعر الطفل</label>
                  <input
                    type="number"
                    min={0}
                    value={editingPkg.childPrice}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, childPrice: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">سعر الرضيع</label>
                  <input
                    type="number"
                    min={0}
                    value={editingPkg.infantPrice}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, infantPrice: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">العملة</label>
                  <input
                    type="text"
                    value={editingPkg.currency}
                    onChange={(e) => setEditingPkg({ ...editingPkg, currency: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">المقاعد المتاحة</label>
                  <input
                    type="number"
                    min={0}
                    value={editingPkg.availableSeats}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, availableSeats: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-6 pt-5">
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPkg.visible}
                      onChange={(e) => setEditingPkg({ ...editingPkg, visible: e.target.checked })}
                      className="w-4 h-4 accent-[#0F332B]"
                    />
                    ظاهرة للعملاء
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPkg.featured}
                      onChange={(e) => setEditingPkg({ ...editingPkg, featured: e.target.checked })}
                      className="w-4 h-4 accent-[#0F332B]"
                    />
                    باقة مميزة
                  </label>
                </div>
              </div>

              {/* Cover Image Selection / Upload */}
              <div className="space-y-3 pt-4 border-t border-[#F0E9DC]">
                <label className="text-xs font-bold text-[#0F332B] block">صورة غلاف الباقة</label>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={
                      CURATED_PACKAGE_IMAGES.some((i) => i.url === editingPkg.coverImage)
                        ? editingPkg.coverImage
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) {
                        setEditingPkg({ ...editingPkg, coverImage: e.target.value });
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  >
                    <option value="">اختر من مكتبة الصور...</option>
                    {CURATED_PACKAGE_IMAGES.map((img) => (
                      <option key={img.url} value={img.url}>
                        {img.label}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B] cursor-pointer">
                    {uploadingCover ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    رفع صورة من جهازك
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleCoverFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                {editingPkg.coverImage && (
                  <img
                    src={editingPkg.coverImage}
                    alt="معاينة الغلاف"
                    referrerPolicy="no-referrer"
                    className="h-32 w-52 object-cover rounded-xl border border-[#E6DCCA]"
                  />
                )}
              </div>

              {/* Highlights, Inclusions, Exclusions (one per line) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#F0E9DC]">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    أبرز المميزات (سطر لكل ميزة)
                  </label>
                  <textarea
                    rows={4}
                    value={(editingPkg.highlights || []).join('\n')}
                    onChange={(e) =>
                      setEditingPkg({
                        ...editingPkg,
                        highlights: e.target.value.split('\n'),
                      })
                    }
                    className="w-full p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs leading-relaxed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    ما تشمله الباقة (سطر لكل بند)
                  </label>
                  <textarea
                    rows={4}
                    value={(editingPkg.inclusions || []).join('\n')}
                    onChange={(e) =>
                      setEditingPkg({
                        ...editingPkg,
                        inclusions: e.target.value.split('\n'),
                      })
                    }
                    className="w-full p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs leading-relaxed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">
                    ما لا تشمله الباقة (سطر لكل بند)
                  </label>
                  <textarea
                    rows={4}
                    value={(editingPkg.exclusions || []).join('\n')}
                    onChange={(e) =>
                      setEditingPkg({
                        ...editingPkg,
                        exclusions: e.target.value.split('\n'),
                      })
                    }
                    className="w-full p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs leading-relaxed"
                  />
                </div>
              </div>

              {/* Day-by-Day Itinerary */}
              <div className="space-y-3 pt-4 border-t border-[#F0E9DC]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0F332B]">البرنامج السياحي اليومي</label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingPkg({
                        ...editingPkg,
                        itinerary: [
                          ...editingPkg.itinerary,
                          {
                            day: editingPkg.itinerary.length + 1,
                            title: '',
                            description: '',
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0E6E73]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة يوم
                  </button>
                </div>

                <div className="space-y-3">
                  {editingPkg.itinerary.map((day, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-[#0F332B]">اليوم {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingPkg({
                              ...editingPkg,
                              itinerary: editingPkg.itinerary
                                .filter((_, i) => i !== idx)
                                .map((d, n) => ({ ...d, day: n + 1 })),
                            })
                          }
                          className="text-xs text-red-700 hover:underline"
                        >
                          حذف اليوم
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="عنوان اليوم"
                        value={day.title}
                        onChange={(e) => updateItineraryDay(idx, { title: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-sm"
                      />
                      <textarea
                        rows={2}
                        placeholder="تفاصيل أنشطة اليوم..."
                        value={day.description}
                        onChange={(e) => updateItineraryDay(idx, { description: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Hotel, Transport, Cancellation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#F0E9DC]">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">معلومات الفنادق</label>
                  <textarea
                    rows={3}
                    value={editingPkg.hotelInfo}
                    onChange={(e) => setEditingPkg({ ...editingPkg, hotelInfo: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">معلومات النقل والطيران</label>
                  <textarea
                    rows={3}
                    value={editingPkg.transportInfo}
                    onChange={(e) => setEditingPkg({ ...editingPkg, transportInfo: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">شروط الإلغاء للباقة</label>
                  <textarea
                    rows={2}
                    value={editingPkg.cancellationPolicy}
                    onChange={(e) =>
                      setEditingPkg({ ...editingPkg, cancellationPolicy: e.target.value })
                    }
                    className="w-full p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6DCCA] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPkg(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#556660] hover:bg-[#EFE7D8]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isNew ? 'نشر الباقة' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Category Modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCategory}
            className="bg-white w-full max-w-lg rounded-2xl border border-[#E6DCCA] overflow-hidden"
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <h2 className="font-display font-extrabold text-lg text-[#0F332B]">
                {isNewCat ? 'إضافة تصنيف جديد' : `تعديل التصنيف: ${editingCat.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="p-2 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">اسم التصنيف *</label>
                <input
                  type="text"
                  required
                  value={editingCat.name}
                  onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                  placeholder="مثال: باقات العمرة / رحلات داخلية / رحلات دولية / عروض خاصة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">وصف مختصر (اختياري)</label>
                <textarea
                  rows={2}
                  value={editingCat.description}
                  onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })}
                  placeholder="يظهر أسفل عنوان التصنيف في الصفحة الرئيسية"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">ترتيب الظهور</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={editingCat.order}
                    onChange={(e) =>
                      setEditingCat({ ...editingCat, order: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer pt-5">
                  <input
                    type="checkbox"
                    checked={editingCat.active}
                    onChange={(e) => setEditingCat({ ...editingCat, active: e.target.checked })}
                    className="w-4 h-4 accent-[#0F332B]"
                  />
                  تصنيف مُفعَّل
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6DCCA] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#556660] hover:bg-[#EFE7D8]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingCat}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {savingCat && <Loader2 className="w-4 h-4 animate-spin" />}
                {isNewCat ? 'إضافة التصنيف' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
