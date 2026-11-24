import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import type { SeasonPoster } from '../../types';
import { ASSET_IMAGES, DEFAULT_SEASON_POSTERS } from '../../data/defaults';
import {
  deleteSeasonPosterById,
  saveSeasonPoster,
} from '../../services/firestoreService';
import { compressFileToDataUrl } from '../../utils/imageCompress';
import { useToast } from '../ToastProvider';

interface PostersManagerProps {
  posters: SeasonPoster[];
  onRefresh: () => Promise<void>;
}

const EMPTY_POSTER = (nextOrder: number): SeasonPoster => ({
  id: '',
  title: '',
  subtitle: '',
  imageUrl: '',
  active: true,
  order: nextOrder,
});

export const PostersManager: React.FC<PostersManagerProps> = ({
  posters,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const [editing, setEditing] = useState<SeasonPoster | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const openCreate = () => {
    setIsNew(true);
    setEditing(EMPTY_POSTER(posters.length + 1));
  };

  const openEdit = (poster: SeasonPoster) => {
    setIsNew(false);
    setEditing({ ...poster });
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file || !editing) return;
    setUploading(true);
    try {
      const res = await compressFileToDataUrl(file, 1100, 220000);
      setEditing({ ...editing, imageUrl: res.dataUrl });
      showToast('تم رفع وضغط صورة الإعلان بنجاح', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر معالجة الصورة المختارة', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() || editing.title.trim().length < 2) {
      showToast('يُرجى إدخال عنوان الإعلان (حرفين على الأقل).', 'error');
      return;
    }
    if (!editing.imageUrl.trim()) {
      showToast('يُرجى رفع صورة الإعلان أو إدخال رابط الصورة.', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveSeasonPoster(editing, isNew);
      showToast(isNew ? 'تمت إضافة الإعلان ونشره بنجاح' : 'تم حفظ تعديلات الإعلان بنجاح', 'success');
      setEditing(null);
      await onRefresh();
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ الإعلان، تأكد من حجم الصورة والمحاولة مجدداً.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (poster: SeasonPoster) => {
    try {
      await saveSeasonPoster({ ...poster, active: !poster.active }, false);
      showToast(poster.active ? 'تم إخفاء الإعلان من الواجهة' : 'تم إظهار الإعلان للعملاء', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر تحديث حالة الظهور.', 'error');
    }
  };

  const handleDelete = async (posterId: string) => {
    try {
      await deleteSeasonPosterById(posterId);
      setConfirmDeleteId(null);
      showToast('تم حذف الإعلان بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف الإعلان.', 'error');
    }
  };

  const handleRestoreOfficialPoster = async () => {
    setRestoring(true);
    try {
      const def = DEFAULT_SEASON_POSTERS[0];
      await saveSeasonPoster(
        {
          id: '',
          title: def.title,
          subtitle: def.subtitle,
          imageUrl: def.imageUrl,
          active: true,
          order: posters.length + 1,
        },
        true
      );
      showToast('تمت استعادة إعلان مكتب راية الفُرات الرسمي بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر استعادة الإعلان الافتراضي.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            إعلانات وعروض الموسم
          </h1>
          <p className="text-sm text-[#556660]">
            أضف بوسترات وإعلانات الرحلات الرسمية، عدّل صورها ونصوصها، أخفِها أو احذفها لتظهر فوراً في الصفحة الرئيسية للعملاء.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={restoring}
            onClick={handleRestoreOfficialPoster}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#0F332B] bg-white border border-[#E6DCCA] hover:bg-[#FAF7F0] whitespace-nowrap"
          >
            {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            استعادة الإعلان الرسمي
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Plus className="w-4 h-4" />
            إضافة إعلان جديد
          </button>
        </div>
      </div>

      {/* Posters Grid */}
      {posters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6DCCA] p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-center text-[#B88E3E]">
            <ImageIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-bold text-lg text-[#0F332B]">
              لا توجد إعلانات موسمية حالياً
            </h2>
            <p className="text-sm text-[#556660] max-w-md mx-auto">
              تم إخفاء قسم بوستر الإعلان من الصفحة الرئيسية تلقائياً. يمكنك إضافة بوستر جديد أو استعادة الإعلان الرسمي في أي وقت.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={openCreate}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              إضافة إعلان جديد
            </button>
            <button
              type="button"
              disabled={restoring}
              onClick={handleRestoreOfficialPoster}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0F332B] bg-[#FAF7F0] border border-[#E6DCCA]"
            >
              استعادة الإعلان الرسمي
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posters.map((poster) => (
            <article
              key={poster.id}
              className={`bg-white rounded-2xl border overflow-hidden flex flex-col ${
                poster.active ? 'border-[#E6DCCA]' : 'border-[#E6DCCA] opacity-75'
              }`}
            >
              <div className="relative bg-[#FAF7F0] aspect-[3/4] max-h-[340px] flex items-center justify-center overflow-hidden border-b border-[#F0E9DC]">
                <img
                  src={poster.imageUrl}
                  alt={poster.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-2"
                />
              </div>

              <div className="p-5 flex flex-col flex-1 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#6B7A74] tabular-nums">
                    ترتيب العرض: #{poster.order}
                  </span>
                  <span className={`font-bold ${poster.active ? 'text-[#0E6E73]' : 'text-[#6B7A74]'}`}>
                    {poster.active ? 'ظاهر للعملاء' : 'مخفي'}
                  </span>
                </div>

                <h3 className="font-display font-bold text-base text-[#0F332B] leading-snug">
                  {poster.title}
                </h3>

                {poster.subtitle && (
                  <p className="text-xs text-[#556660] leading-relaxed line-clamp-2">
                    {poster.subtitle}
                  </p>
                )}

                <div className="mt-auto pt-3 border-t border-[#F0E9DC] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(poster)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-bold text-[#0F332B]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(poster)}
                      className="p-2 rounded-xl text-[#556660] hover:bg-[#EFE7D8]"
                      title={poster.active ? 'إخفاء الإعلان' : 'إظهار الإعلان'}
                    >
                      {poster.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {confirmDeleteId === poster.id ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(poster.id)}
                      className="px-3 py-1.5 rounded-xl bg-red-700 text-white text-xs font-bold"
                    >
                      تأكيد الحذف
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(poster.id)}
                      className="p-2 rounded-xl text-red-700 hover:bg-red-50"
                      title="حذف الإعلان"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit Poster Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <form
            onSubmit={handleSave}
            className="bg-white w-full max-w-xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-6"
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <h2 className="font-display font-extrabold text-base text-[#0F332B]">
                {isNew ? 'إضافة إعلان موسمي جديد' : 'تعديل الإعلان الموسمي'}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Image Upload / Preview */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#0F332B]">
                  صورة البوستر / الإعلان *
                </label>

                {editing.imageUrl && (
                  <div className="relative rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] p-3 flex justify-center">
                    <img
                      src={editing.imageUrl}
                      alt="معاينة الإعلان"
                      referrerPolicy="no-referrer"
                      className="max-h-64 w-auto rounded-lg object-contain"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F332B] text-white text-xs font-bold cursor-pointer hover:opacity-90">
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {editing.imageUrl ? 'استبدال الصورة من جهازك' : 'رفع صورة من جهازك'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ ...editing, imageUrl: ASSET_IMAGES.officialPoster })
                    }
                    className="px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs font-semibold text-[#0F332B] hover:border-[#0E6E73]"
                  >
                    استخدام إعلان راية الفُرات الأصلي
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-[#6B7A74]">
                    أو أدخل رابط الصورة مباشرة (اختياري):
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editing.imageUrl.startsWith('data:') ? '' : editing.imageUrl}
                    onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                    placeholder="https://... أو /assets/..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-right"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0F332B]">عنوان الإعلان *</label>
                <input
                  type="text"
                  required
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="مثال: عروض رحلات العمرة — أكتوبر 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#0F332B]">
                  وصف مختصر يظهر مع الإعلان (اختياري)
                </label>
                <input
                  type="text"
                  value={editing.subtitle}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  placeholder="مثال: خصم خاص للحجز المبكر والعائلات"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-2">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#0F332B]">ترتيب الظهور</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={editing.order}
                    onChange={(e) =>
                      setEditing({ ...editing, order: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono"
                  />
                </div>

                <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#0F332B] pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="w-4 h-4 accent-[#0F332B]"
                  />
                  ظاهر للعملاء في الموقع
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6DCCA] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#556660]"
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
                {isNew ? 'إضافة ونشر الإعلان' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
