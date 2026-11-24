import React, { useState } from 'react';
import {
  UserPlus,
  Edit3,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  ROLE_PRESET_PERMISSIONS,
  STAFF_ROLE_LABELS,
  type StaffMember,
  type StaffPermissions,
  type StaffRole,
} from '../../types';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../../data/defaults';
import {
  deleteStaffMember,
  saveStaffMember,
} from '../../services/firestoreService';
import { useToast } from '../ToastProvider';

interface StaffManagerProps {
  staffList: StaffMember[];
  onRefresh: () => Promise<void>;
}

const PERMISSION_LABELS: Array<{ key: keyof StaffPermissions; label: string }> = [
  { key: 'manageBookings', label: 'إدارة الحجوزات والعملاء وتصدير الكشوفات' },
  { key: 'managePackages', label: 'إضافة وتعديل وحذف الباقات السياحية' },
  { key: 'manageForms', label: 'منشئ الاستمارات الديناميكي' },
  { key: 'manageSettings', label: 'إعدادات الهوية البصرية والمحتوى (CMS)' },
  { key: 'manageStaff', label: 'إدارة المشرفين وتحديد الصلاحيات' },
];

export const StaffManager: React.FC<StaffManagerProps> = ({
  staffList,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('sales');
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<StaffPermissions>(
    ROLE_PRESET_PERMISSIONS.sales
  );
  const [saving, setSaving] = useState(false);
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);

  const openAdd = () => {
    setIsNew(true);
    setEmail('');
    setName('');
    setRole('sales');
    setActive(true);
    setPermissions({ ...ROLE_PRESET_PERMISSIONS.sales });
    setModalOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setIsNew(false);
    setEmail(member.email);
    setName(member.name);
    setRole(member.role);
    setActive(member.active);
    setPermissions({ ...member.permissions });
    setModalOpen(true);
  };

  const handleRolePresetChange = (nextRole: StaffRole) => {
    setRole(nextRole);
    setPermissions({ ...ROLE_PRESET_PERMISSIONS[nextRole] });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('يُرجى إدخال بريد إلكتروني صحيح (حساب Google للموظف).', 'error');
      return;
    }
    if (name.trim().length < 2) {
      showToast('يُرجى إدخال اسم المشرف أو الموظف.', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveStaffMember(
        {
          email: cleanEmail,
          name: name.trim(),
          role,
          active,
          permissions,
        },
        isNew
      );
      showToast(
        isNew ? 'تمت إضافة الموظف وتفعيل صلاحياته بنجاح' : 'تم تحديث صلاحيات الموظف بنجاح',
        'success'
      );
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      console.error(err);
      showToast('تعذر حفظ بيانات المشرف.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (staffEmail: string) => {
    try {
      await deleteStaffMember(staffEmail);
      setConfirmDeleteEmail(null);
      showToast('تمت إزالة المشرف من القائمة', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف هذا المشرف.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            إدارة الصلاحيات والمشرفين
          </h1>
          <p className="text-sm text-[#556660]">
            أضف موظفي المكتب عبر بريدهم في Google وحدد الصلاحيات الدقيقة لكل دور (مدير عام، مبيعات، محرر باقات).
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          <UserPlus className="w-4 h-4" />
          إضافة مشرف / موظف
        </button>
      </div>

      {/* Staff List Table */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">الاسم والبريد الإلكتروني</th>
                <th className="py-3.5 px-4 font-semibold">الدور الوظيفي</th>
                <th className="py-3.5 px-4 font-semibold">الصلاحيات الممنوحة</th>
                <th className="py-3.5 px-4 font-semibold">الحالة</th>
                <th className="py-3.5 px-4 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E9DC]">
              {staffList.map((member) => {
                const isPrimaryOwner = member.email === BOOTSTRAPPED_ADMIN_EMAIL;
                const activePerms = PERMISSION_LABELS.filter((p) => member.permissions?.[p.key]);
                return (
                  <tr key={member.email} className="hover:bg-[#FAF7F0]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#B88E3E] shrink-0" />
                        <div>
                          <p className="font-bold text-[#0F332B]">{member.name}</p>
                          <p className="font-mono text-xs text-[#6B7A74]">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-bold text-[#0E6E73]">
                      {STAFF_ROLE_LABELS[member.role]}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#374B45]">
                      {activePerms.length === PERMISSION_LABELS.length
                        ? 'صلاحية كاملة على جميع أقسام النظام'
                        : activePerms.map((p) => p.label.split(' ')[0] + ' ' + (p.label.split(' ')[1] || '')).join(' · ') || 'بدون صلاحيات'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      {member.active ? (
                        <span className="text-[#0E6E73]">مفعّل</span>
                      ) : (
                        <span className="text-red-700">موقوف</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          className="p-2 rounded-lg text-[#0F332B] hover:bg-[#EFE7D8]"
                          title="تعديل الصلاحيات"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {!isPrimaryOwner &&
                          (confirmDeleteEmail === member.email ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(member.email)}
                              className="px-2.5 py-1 rounded-lg bg-red-700 text-white text-xs font-bold"
                            >
                              تأكيد
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEmail(member.email)}
                              className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                              title="حذف الموظف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white w-full max-w-lg rounded-2xl border border-[#E6DCCA] overflow-hidden"
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <h2 className="font-display font-extrabold text-base text-[#0F332B]">
                {isNew ? 'إضافة مشرف أو موظف جديد' : 'تعديل صلاحيات الموظف'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">
                  البريد الإلكتروني (حساب Google للدخول) *
                </label>
                <input
                  type="email"
                  required
                  disabled={!isNew}
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm text-right disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">الاسم *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد — قسم المبيعات"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">قالب الدور الوظيفي</label>
                <select
                  value={role}
                  onChange={(e) => handleRolePresetChange(e.target.value as StaffRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-medium"
                >
                  {Object.entries(STAFF_ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#F0E9DC]">
                <p className="text-xs font-bold text-[#0F332B]">تخصيص الصلاحيات التفصيلية:</p>
                {PERMISSION_LABELS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-3 text-sm text-[#142621] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[item.key]}
                      onChange={(e) =>
                        setPermissions({ ...permissions, [item.key]: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#0F332B]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-3 text-sm font-semibold text-[#0F332B] pt-2 border-t border-[#F0E9DC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 accent-[#0E6E73]"
                />
                حساب مفعّل (يمكنه الدخول إلى لوحة التحكم)
              </label>
            </div>

            <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6DCCA] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#556660]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                حفظ الصلاحيات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
