import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Palette,
} from 'lucide-react';
import type { SiteSettings } from '../../types';
import { DEFAULT_SITE_SETTINGS } from '../../data/defaults';
import { saveSiteSettings } from '../../services/firestoreService';
import { compressFileToDataUrl } from '../../utils/imageCompress';
import { BrandLogo } from '../BrandLogo';
import { useToast } from '../ToastProvider';

interface SettingsManagerProps {
  settings: SiteSettings;
  onSaved: (updated: SiteSettings) => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  settings,
  onSaved,
}) => {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<SiteSettings>({
    ...settings,
    contacts: (settings.contacts || []).map((c) => ({ ...c })),
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await compressFileToDataUrl(file, 420, 120000);
      setDraft((prev) => ({ ...prev, logoUrl: res.dataUrl }));
      showToast('تم رفع الشعار الجديد — اضغط "حفظ الإعدادات" لتطبيقه.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر معالجة صورة الشعار', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const resetBrandColors = () => {
    setDraft((prev) => ({
      ...prev,
      primaryColor: DEFAULT_SITE_SETTINGS.primaryColor,
      secondaryColor: DEFAULT_SITE_SETTINGS.secondaryColor,
      accentColor: DEFAULT_SITE_SETTINGS.accentColor,
      bgColor: DEFAULT_SITE_SETTINGS.bgColor,
    }));
    showToast('تمت استعادة ألوان الهوية الأصلية لمكتب راية الفُرات', 'info');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSiteSettings(draft);
      onSaved(draft);
      showToast('تم حفظ إعدادات الهوية والنظام وتحديث الموقع بالكامل', 'success');
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ الإعدادات.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            إعدادات الهوية والمحتوى (CMS)
          </h1>
          <p className="text-sm text-[#556660]">
            تحكم كامل في الشعار، ألوان الهوية البصرية، نصوص الواجهة، أرقام التواصل، والشروط والأحكام دون تعديل الكود.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0 disabled:opacity-60"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ جميع الإعدادات
        </button>
      </div>

      {/* 1. Brand Logo & Colors */}
      <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#F0E9DC]">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#B88E3E]" />
            <h2 className="font-display font-bold text-base text-[#0F332B]">
              الشعار الرسمي وألوان الهوية البصرية
            </h2>
          </div>
          <button
            type="button"
            onClick={resetBrandColors}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6E73] hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            استعادة ألوان إعلان راية الفُرات
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Logo Preview & Upload */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-4">
            <p className="text-xs font-bold text-[#556660]">معاينة الشعار الحالي:</p>
            <div className="py-2">
              <BrandLogo settings={draft} size="lg" showWordmark />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B] cursor-pointer">
                {uploadingLogo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                رفع شعار مخصص
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                />
              </label>
              {draft.logoUrl && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, logoUrl: '' })}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  استخدام الشعار الرسمي
                </button>
              )}
            </div>
          </div>

          {/* Color Pickers */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'primaryColor' as const, label: 'اللون الأساسي (الزمردي)' },
              { key: 'secondaryColor' as const, label: 'اللون الثانوي (الفيروزي)' },
              { key: 'accentColor' as const, label: 'لون التمييز (الذهبي)' },
              { key: 'bgColor' as const, label: 'لون الخلفية (الرملي)' },
            ].map((item) => (
              <div key={item.key} className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0F332B]">{item.label}</label>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA]">
                  <input
                    type="color"
                    value={draft[item.key]}
                    onChange={(e) => setDraft({ ...draft, [item.key]: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-xs text-[#374B45]" dir="ltr">
                    {draft[item.key]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Agency Copy & Hero Texts */}
      <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-[#0F332B] pb-3 border-b border-[#F0E9DC]">
          نصوص الموقع والصفحة الرئيسية
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">اسم المكتب</label>
            <input
              type="text"
              required
              value={draft.agencyName}
              onChange={(e) => setDraft({ ...draft, agencyName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">الوصف الملحق بالاسم</label>
            <input
              type="text"
              value={draft.agencySubtitle}
              onChange={(e) => setDraft({ ...draft, agencySubtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">الشعار اللفظي (Tagline)</label>
            <input
              type="text"
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">عبارة الترحيب بالفوتر</label>
            <input
              type="text"
              value={draft.welcomePhrase}
              onChange={(e) => setDraft({ ...draft, welcomePhrase: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">
              رقم الترخيص السياحي / السجل التجاري (يظهر في ترويسة الكشوفات الرسمية)
            </label>
            <input
              type="text"
              value={draft.licenseNumber || ''}
              onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })}
              placeholder="مثال: سجل تجاري 2031XXXXXX — ترخيص سياحي 7310XXXX"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">العنوان الرئيسي في الواجهة (Hero)</label>
            <input
              type="text"
              value={draft.heroTitle}
              onChange={(e) => setDraft({ ...draft, heroTitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">النص التعريفي في الواجهة</label>
            <textarea
              rows={2}
              value={draft.heroSubtitle}
              onChange={(e) => setDraft({ ...draft, heroSubtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
        </div>
      </section>

      {/* 3. Contacts & Social Links */}
      <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E9DC]">
          <h2 className="font-display font-bold text-base text-[#0F332B]">
            أرقام التواصل وروابط السوشيال ميديا
          </h2>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                contacts: [...draft.contacts, { label: 'رقم جديد', phone: '' }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0E6E73]"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة رقم تواصل
          </button>
        </div>

        <div className="space-y-3">
          {draft.contacts.map((contact, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <input
                type="text"
                value={contact.label}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contacts: draft.contacts.map((c, i) =>
                      i === idx ? { ...c, label: e.target.value } : c
                    ),
                  })
                }
                placeholder="الاسم أو القسم (مثل: بوغريب / المكتب)"
                className="sm:col-span-5 px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
              />
              <input
                type="tel"
                dir="ltr"
                value={contact.phone}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contacts: draft.contacts.map((c, i) =>
                      i === idx ? { ...c, phone: e.target.value } : c
                    ),
                  })
                }
                placeholder="05XXXXXXXX"
                className="sm:col-span-6 px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-right"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    contacts: draft.contacts.filter((_, i) => i !== idx),
                  })
                }
                className="sm:col-span-1 p-2 rounded-lg text-red-700 hover:bg-red-50 justify-self-end"
                aria-label="حذف الرقم"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#F0E9DC]">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">البريد الإلكتروني الرسمي</label>
            <input
              type="email"
              dir="ltr"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">العنوان</label>
            <input
              type="text"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">رابط إنستغرام</label>
            <input
              type="url"
              dir="ltr"
              value={draft.instagramUrl}
              onChange={(e) => setDraft({ ...draft, instagramUrl: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F332B]">رابط إكس (تويتر)</label>
            <input
              type="url"
              dir="ltr"
              value={draft.twitterUrl}
              onChange={(e) => setDraft({ ...draft, twitterUrl: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs text-right"
            />
          </div>
        </div>
      </section>

      {/* 4. Legal & Policies */}
      <section className="bg-white rounded-2xl border border-[#E6DCCA] p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-[#0F332B] pb-3 border-b border-[#F0E9DC]">
          الشروط والأحكام وسياسة الإلغاء الافتراضية
        </h2>
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#0F332B]">الشروط والأحكام (تظهر في نموذج الحجز)</label>
          <textarea
            rows={4}
            value={draft.termsAndConditions}
            onChange={(e) => setDraft({ ...draft, termsAndConditions: e.target.value })}
            className="w-full p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs leading-relaxed"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#0F332B]">سياسة الإلغاء الافتراضية</label>
          <textarea
            rows={3}
            value={draft.defaultCancellationPolicy}
            onChange={(e) => setDraft({ ...draft, defaultCancellationPolicy: e.target.value })}
            className="w-full p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs leading-relaxed"
          />
        </div>
      </section>
    </form>
  );
};
