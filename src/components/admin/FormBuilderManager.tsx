import React, { useEffect, useState } from 'react';
import {
  Plus,
  GripVertical,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Eye,
  Loader2,
  Star,
} from 'lucide-react';
import {
  FIELD_TYPE_LABELS,
  type FieldType,
  type FormField,
  type FormTemplate,
  type TravelPackage,
} from '../../types';
import {
  deleteFormTemplateById,
  saveFormTemplate,
} from '../../services/firestoreService';
import { generateSafeId } from '../../utils/imageCompress';
import { useToast } from '../ToastProvider';

interface FormBuilderManagerProps {
  forms: FormTemplate[];
  packages: TravelPackage[];
  onRefresh: () => Promise<void>;
}

const FIELD_TYPES: FieldType[] = [
  'text',
  'number',
  'select',
  'radio',
  'multiselect',
  'date',
  'file',
];

export const FormBuilderManager: React.FC<FormBuilderManagerProps> = ({
  forms,
  packages,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const [selectedId, setSelectedId] = useState<string>(forms[0]?.id || '');
  const [draft, setDraft] = useState<FormTemplate | null>(forms[0] || null);
  const [isNewMode, setIsNewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const cloneField = (fld: FormField): FormField => {
    const copy: FormField = {
      id: fld.id,
      label: fld.label,
      type: fld.type,
      required: fld.required,
      ...(fld.placeholder ? { placeholder: fld.placeholder } : {}),
      ...(fld.helpText ? { helpText: fld.helpText } : {}),
      ...(fld.options ? { options: [...fld.options] } : {}),
    };
    return copy;
  };

  useEffect(() => {
    if (!isNewMode) {
      const found = forms.find((f) => f.id === selectedId) || forms[0] || null;
      if (found) {
        setSelectedId(found.id);
        setDraft({
          ...found,
          fields: found.fields.map(cloneField),
        });
      }
    }
  }, [forms, selectedId, isNewMode]);

  const startNewTemplate = () => {
    setIsNewMode(true);
    setSelectedId('');
    setDraft({
      id: '',
      name: 'استمارة حجز مخصصة جديدة',
      description: 'وصف مختصر لاستخدام هذه الاستمارة',
      isDefault: false,
      fields: [
        {
          id: generateSafeId('fld'),
          label: 'الاسم الكامل',
          type: 'text',
          required: true,
          placeholder: 'أدخل الاسم الكامل كما في الوثيقة الرسمية',
        },
        {
          id: generateSafeId('fld'),
          label: 'صورة الجواز أو الهوية',
          type: 'file',
          required: true,
        },
      ],
    });
  };

  const selectTemplate = (tmpl: FormTemplate) => {
    setIsNewMode(false);
    setSelectedId(tmpl.id);
    setDraft({
      ...tmpl,
      fields: tmpl.fields.map(cloneField),
    });
  };

  const addField = (type: FieldType) => {
    if (!draft) return;
    const needsOptions = type === 'select' || type === 'radio' || type === 'multiselect';
    const newField: FormField = {
      id: generateSafeId('fld'),
      label: `حقل ${FIELD_TYPE_LABELS[type]}`,
      type,
      required: true,
      placeholder: '',
      helpText: '',
      ...(needsOptions ? { options: ['خيار 1', 'خيار 2'] } : {}),
    };
    setDraft({ ...draft, fields: [...draft.fields, newField] });
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    if (!draft) return;
    const nextFields = draft.fields.map((f, i) => {
      if (i !== idx) return f;
      const merged = { ...f, ...patch };
      const needsOpts =
        merged.type === 'select' || merged.type === 'radio' || merged.type === 'multiselect';
      if (needsOpts && (!merged.options || merged.options.length === 0)) {
        merged.options = ['خيار 1', 'خيار 2'];
      }
      if (!needsOpts) {
        delete merged.options;
      }
      return merged;
    });
    setDraft({ ...draft, fields: nextFields });
  };

  const removeField = (idx: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      fields: draft.fields.filter((_, i) => i !== idx),
    });
  };

  const moveField = (fromIdx: number, toIdx: number) => {
    if (!draft) return;
    if (toIdx < 0 || toIdx >= draft.fields.length || fromIdx === toIdx) return;
    const updated = [...draft.fields];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setDraft({ ...draft, fields: updated });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      showToast('يُرجى إدخال اسم الاستمارة.', 'error');
      return;
    }
    if (draft.fields.length === 0) {
      showToast('يجب أن تحتوي الاستمارة على حقل واحد على الأقل.', 'error');
      return;
    }

    setSaving(true);
    try {
      const savedId = await saveFormTemplate(draft, isNewMode);
      setIsNewMode(false);
      setSelectedId(savedId);
      showToast('تم حفظ الاستمارة الديناميكية بنجاح', 'success');
      await onRefresh();
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ الاستمارة.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const linked = packages.filter((p) => p.formTemplateId === id);
    if (linked.length > 0) {
      showToast(
        `لا يمكن حذف الاستمارة لأنها مرتبطة بـ ${linked.length} باقة حالياً. قم بتغيير استمارة تلك الباقات أولاً.`,
        'error'
      );
      return;
    }
    try {
      await deleteFormTemplateById(id);
      showToast('تم حذف الاستمارة بنجاح', 'success');
      setSelectedId('');
      await onRefresh();
    } catch {
      showToast('تعذر حذف الاستمارة.', 'error');
    }
  };

  const linkedPackages = draft && !isNewMode
    ? packages.filter((p) => p.formTemplateId === draft.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            منشئ الاستمارات الديناميكي
          </h1>
          <p className="text-sm text-[#556660]">
            صمّم استمارات بيانات المسافرين بالسحب والإفلات، وعدّل الحقول المطلوبة لكل نوع من الرحلات في أي وقت.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewTemplate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          <Plus className="w-4 h-4" />
          إنشاء استمارة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Saved Templates */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-bold text-[#556660] px-1">
            الاستمارات المتوفرة ({forms.length})
          </p>
          {forms.map((tmpl) => {
            const active = !isNewMode && selectedId === tmpl.id;
            const countLinked = packages.filter((p) => p.formTemplateId === tmpl.id).length;
            return (
              <div
                key={tmpl.id}
                onClick={() => selectTemplate(tmpl)}
                className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0F332B] text-white border-[#0F332B]'
                    : 'bg-white text-[#142621] border-[#E6DCCA] hover:border-[#0E6E73]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold text-sm leading-snug">{tmpl.name}</h3>
                  {tmpl.isDefault && (
                    <Star
                      className={`w-4 h-4 shrink-0 ${active ? 'text-[#E8C97E]' : 'text-[#B88E3E]'}`}
                      aria-label="النموذج الافتراضي"
                    />
                  )}
                </div>
                <p
                  className={`text-xs mt-1.5 line-clamp-2 ${
                    active ? 'text-white/75' : 'text-[#6B7A74]'
                  }`}
                >
                  {tmpl.description}
                </p>
                <div
                  className={`flex items-center gap-2 text-[11px] mt-3 ${
                    active ? 'text-[#E8C97E]' : 'text-[#556660]'
                  }`}
                >
                  <span className="tabular-nums">{tmpl.fields.length} حقول</span>
                  <span>·</span>
                  <span className="tabular-nums">مرتبطة بـ {countLinked} باقة</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Editor Canvas */}
        {draft && (
          <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
            {/* Template Meta Header */}
            <div className="p-6 bg-[#FAF7F0] border-b border-[#E6DCCA] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-[#8C6D2E]">
                  {isNewMode ? 'استمارة جديدة' : 'تحرير الاستمارة'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0F332B] bg-white border border-[#E6DCCA] hover:bg-[#EFE7D8]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showPreview ? 'العودة للمحرر' : 'معاينة كما يراها العميل'}
                  </button>
                  {!isNewMode && !draft.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(draft.id)}
                      className="p-2 rounded-xl text-red-700 bg-white border border-red-200 hover:bg-red-50"
                      title="حذف الاستمارة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    حفظ الاستمارة
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="اسم الاستمارة"
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-[#E6DCCA] text-sm font-bold text-[#0F332B]"
                />
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="وصف مختصر للاستمارة"
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-[#E6DCCA] text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <label className="inline-flex items-center gap-2 text-[#142621] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                    className="w-4 h-4 accent-[#0F332B]"
                  />
                  تعيين كاستمارة عامة افتراضية للباقات الجديدة
                </label>

                {linkedPackages.length > 0 && (
                  <span className="text-[#0E6E73] font-medium">
                    مرتبطة حالياً بـ: {linkedPackages.map((p) => p.title).join('، ')}
                  </span>
                )}
              </div>
            </div>

            {showPreview ? (
              /* Live Customer Preview */
              <div className="p-6 space-y-5">
                <p className="text-xs font-semibold text-[#6B7A74]">
                  معاينة تفاعلية لكيفية ظهور الحقول لكل مسافر في صفحة الحجز:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA]">
                  {draft.fields.map((fld) => (
                    <div
                      key={fld.id}
                      className={`space-y-1.5 ${
                        fld.type === 'file' || fld.type === 'multiselect' ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <label className="text-xs font-bold text-[#0F332B] block">
                        {fld.label}
                        {fld.required && <span className="text-red-600 mr-1">*</span>}
                      </label>
                      {fld.type === 'select' ? (
                        <select className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs">
                          <option>اختر...</option>
                          {(fld.options || []).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : fld.type === 'radio' || fld.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2">
                          {(fld.options || []).map((o) => (
                            <span
                              key={o}
                              className="px-3 py-1.5 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                            >
                              {o}
                            </span>
                          ))}
                        </div>
                      ) : fld.type === 'file' ? (
                        <div className="p-4 rounded-lg border-2 border-dashed border-[#D8CBB3] bg-white text-center text-xs text-[#6B7A74]">
                          منطقة رفع الملف ({fld.label})
                        </div>
                      ) : (
                        <input
                          type={fld.type === 'date' ? 'date' : 'text'}
                          disabled
                          placeholder={fld.placeholder || FIELD_TYPE_LABELS[fld.type]}
                          className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Drag & Drop Field Editor */
              <div className="p-6 space-y-6">
                {/* Quick Add Field Palette */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#556660]">
                    أضف حقلاً جديداً إلى الاستمارة:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.map((ft) => (
                      <button
                        key={ft}
                        type="button"
                        onClick={() => addField(ft)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#0E6E73]" />
                        {FIELD_TYPE_LABELS[ft]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Draggable Fields List */}
                <div className="space-y-3">
                  <p className="text-xs text-[#6B7A74]">
                    اسحب الحقول من المقبض الجانبي لإعادة ترتيبها أو استخدم أزرار الصعود والهبوط:
                  </p>

                  {draft.fields.map((field, idx) => {
                    const hasOptions =
                      field.type === 'select' ||
                      field.type === 'radio' ||
                      field.type === 'multiselect';
                    const isDropTarget = dragOverIndex === idx && dragIndex !== idx;

                    return (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverIndex(idx);
                        }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== idx) {
                            moveField(dragIndex, idx);
                          }
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={`p-4 rounded-xl border transition-all space-y-3 ${
                          isDropTarget
                            ? 'border-[#0E6E73] bg-[#0E6E73]/5'
                            : 'border-[#E6DCCA] bg-[#FAF7F0]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[#556660] cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4 text-[#B88E3E]" />
                            <span className="font-mono text-xs font-bold tabular-nums">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-[#0E6E73]">
                              {FIELD_TYPE_LABELS[field.type]}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveField(idx, idx - 1)}
                              className="p-1.5 rounded-lg hover:bg-[#EFE7D8] disabled:opacity-30"
                              title="تحريك لأعلى"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === draft.fields.length - 1}
                              onClick={() => moveField(idx, idx + 1)}
                              className="p-1.5 rounded-lg hover:bg-[#EFE7D8] disabled:opacity-30"
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeField(idx)}
                              className="p-1.5 rounded-lg text-red-700 hover:bg-red-50"
                              title="حذف الحقل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateField(idx, { label: e.target.value })}
                              placeholder="عنوان الحقل الظاهر للعميل"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-sm font-medium"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <select
                              value={field.type}
                              onChange={(e) =>
                                updateField(idx, { type: e.target.value as FieldType })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs font-medium"
                            >
                              {FIELD_TYPES.map((ft) => (
                                <option key={ft} value={ft}>
                                  {FIELD_TYPE_LABELS[ft]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3 flex items-center">
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F332B] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(idx, { required: e.target.checked })}
                                className="w-4 h-4 accent-[#0F332B]"
                              />
                              حقل إجباري
                            </label>
                          </div>

                          <div className="sm:col-span-6">
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                              placeholder="نص توضيحي داخل الحقل (اختياري)"
                              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                            />
                          </div>

                          <div className="sm:col-span-6">
                            <input
                              type="text"
                              value={field.helpText || ''}
                              onChange={(e) => updateField(idx, { helpText: e.target.value })}
                              placeholder="ملاحظة مساعدة أسفل الحقل (اختياري)"
                              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                            />
                          </div>

                          {hasOptions && (
                            <div className="sm:col-span-12 space-y-1">
                              <label className="text-[11px] font-semibold text-[#556660]">
                                الخيارات المتاحة (افصل بينها بفاصلة أو سطر جديد):
                              </label>
                              <input
                                type="text"
                                value={(field.options || []).join('، ')}
                                onChange={(e) =>
                                  updateField(idx, {
                                    options: e.target.value
                                      .split(/[،,]/)
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="خيار 1، خيار 2، خيار 3"
                                className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DCCA] text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
