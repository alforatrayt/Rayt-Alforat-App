import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  ROLE_PRESET_PERMISSIONS,
  STAFF_ROLE_LABELS,
  type AuditActor,
  type StaffMember,
  type StaffPermissions,
  type StaffRole,
} from '../../types';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../../data/defaults';
import {
  createStaffAccountWithAuth,
  deleteStaffMember,
  logAuditEvent,
  updateStaffSecurityProfile,
} from '../../services/firestoreService';
import {
  createTotpSetup,
  formatRemainingLockout,
  generateQrCodeDataUrl,
  generateTemporaryPassword,
  validateStrongPassword,
  verifyTotpCode,
} from '../../utils/securityUtils';
import { useToast } from '../ToastProvider';

interface StaffManagerProps {
  staffList: StaffMember[];
  ownerProfile: StaffMember | null;
  actor: AuditActor;
  onRefresh: () => Promise<void>;
}

const ASSIGNABLE_ROLES: StaffRole[] = ['manager', 'sales', 'content_editor'];

export const StaffManager: React.FC<StaffManagerProps> = ({
  staffList,
  ownerProfile,
  actor,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const staffAccounts = staffList.filter(
    (m) => m.email.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL
  );

  // Create Staff Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTempPassword, setNewTempPassword] = useState(() => generateTemporaryPassword(12));
  const [showTempPassword, setShowTempPassword] = useState(true);
  const [newRole, setNewRole] = useState<StaffRole>('sales');
  const [newPermissions, setNewPermissions] = useState<StaffPermissions>(
    ROLE_PRESET_PERMISSIONS.sales
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);

  // Edit Permissions Modal State
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('sales');
  const [editPermissions, setEditPermissions] = useState<StaffPermissions>(
    ROLE_PRESET_PERMISSIONS.sales
  );
  const [savingEdit, setSavingEdit] = useState(false);

  // Action Confirmations / Busy State
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);
  const [confirmReset2faEmail, setConfirmReset2faEmail] = useState<string | null>(null);

  // Optional Owner 2FA Enrollment State
  const [owner2faModalOpen, setOwner2faModalOpen] = useState(false);
  const [ownerTotpSecret, setOwnerTotpSecret] = useState('');
  const [ownerTotpQr, setOwnerTotpQr] = useState('');
  const [ownerTotpCode, setOwnerTotpCode] = useState('');
  const [savingOwner2fa, setSavingOwner2fa] = useState(false);

  const owner2faEnabled = Boolean(ownerProfile?.totpEnabled && ownerProfile?.totpVerified);

  const openCreateModal = () => {
    setNewName('');
    setNewEmail('');
    setNewTempPassword(generateTemporaryPassword(12));
    setShowTempPassword(true);
    setNewRole('sales');
    setNewPermissions(ROLE_PRESET_PERMISSIONS.sales);
    setCreateError('');
    setCreateOpen(true);
  };

  const handleRolePresetChange = (role: StaffRole, isEdit = false) => {
    const preset = { ...ROLE_PRESET_PERMISSIONS[role], manageStaff: false };
    if (isEdit) {
      setEditRole(role);
      setEditPermissions(preset);
    } else {
      setNewRole(role);
      setNewPermissions(preset);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanName = newName.trim();
    if (cleanName.length < 2) {
      setCreateError('يُرجى إدخال الاسم الكامل للموظف.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setCreateError('يُرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (cleanEmail === BOOTSTRAPPED_ADMIN_EMAIL) {
      setCreateError('هذا البريد محجوز للمالك العام ولا يمكن إضافته كحساب موظف.');
      return;
    }
    const pwdCheck = validateStrongPassword(newTempPassword);
    if (!pwdCheck.valid) {
      setCreateError(pwdCheck.errors[0]);
      return;
    }

    setCreating(true);
    try {
      await createStaffAccountWithAuth({
        name: cleanName,
        email: cleanEmail,
        tempPassword: newTempPassword,
        role: newRole,
        permissions: newPermissions,
      });

      await logAuditEvent({
        action: 'staff_created',
        actor,
        targetType: 'staff',
        targetId: cleanEmail,
        summary: `إنشاء حساب موظف جديد: ${cleanName}`,
        details: `البريد: ${cleanEmail} · الدور: ${STAFF_ROLE_LABELS[newRole]}`,
      });

      setCreatedCredentials({
        name: cleanName,
        email: cleanEmail,
        tempPassword: newTempPassword,
      });
      setCreateOpen(false);
      showToast(`تم إنشاء حساب الموظف (${cleanName}) بنجاح`, 'success');
      await onRefresh();
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (code === 'auth/operation-not-allowed') {
        setCreateError(
          'مزود الدخول بالبريد الإلكتروني وكلمة المرور (Email/Password) غير مفعّل في مشروع Firebase حتى الآن. يُرجى تفعيله من Firebase Console ← Authentication ← Sign-in method ← Email/Password.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setCreateError(
          'هذا البريد الإلكتروني مسجل مسبقاً في Firebase Authentication. استخدم بريداً آخر أو احذف المستخدم القديم من وحدة تحكم Firebase أولاً.'
        );
      } else if (code === 'staff/already-exists') {
        setCreateError('يوجد موظف مسجل مسبقاً بهذا البريد الإلكتروني في النظام.');
      } else if (code === 'auth/weak-password') {
        setCreateError('كلمة المرور المؤقتة ضعيفة جداً وفق سياسات Firebase.');
      } else {
        setCreateError(
          err instanceof Error ? err.message : 'تعذر إنشاء حساب الموظف، يُرجى المحاولة مجدداً.'
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditPermissions({ ...member.permissions, manageStaff: false });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || editName.trim().length < 2) return;
    setSavingEdit(true);
    try {
      await updateStaffSecurityProfile(editingMember.email, {
        name: editName.trim(),
        role: editRole,
        permissions: editPermissions,
      });
      await logAuditEvent({
        action: 'staff_updated',
        actor,
        targetType: 'staff',
        targetId: editingMember.email,
        summary: `تعديل بيانات وصلاحيات الموظف: ${editName.trim()}`,
        details: `الدور: ${STAFF_ROLE_LABELS[editRole]}`,
      });
      setEditingMember(null);
      showToast('تم تحديث صلاحيات الموظف بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حفظ تعديلات الموظف.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleFreeze = async (member: StaffMember) => {
    const nextActive = !member.active;
    setBusyEmail(member.email);
    try {
      await updateStaffSecurityProfile(member.email, { active: nextActive });
      await logAuditEvent({
        action: nextActive ? 'staff_activated' : 'staff_frozen',
        actor,
        targetType: 'staff',
        targetId: member.email,
        summary: nextActive
          ? `إعادة تفعيل حساب الموظف: ${member.name}`
          : `إيقاف وتجميد فوري لحساب الموظف: ${member.name}`,
      });
      showToast(
        nextActive
          ? `تم إعادة تفعيل حساب ${member.name}`
          : `تم تجميد حساب ${member.name} وطرد جلساته النشطة فوراً`,
        nextActive ? 'success' : 'info'
      );
      await onRefresh();
    } catch {
      showToast('تعذر تغيير حالة الحساب.', 'error');
    } finally {
      setBusyEmail(null);
    }
  };

  const handleReset2fa = async (member: StaffMember) => {
    setBusyEmail(member.email);
    try {
      await updateStaffSecurityProfile(member.email, {
        totpEnabled: true,
        totpVerified: false,
        totpSecret: '',
        failedAttempts: 0,
        lockedUntil: 0,
      });
      await logAuditEvent({
        action: '2fa_reset',
        actor,
        targetType: 'staff',
        targetId: member.email,
        summary: `إعادة تعيين المصادقة الثنائية (2FA) للموظف: ${member.name}`,
        details: 'سيُطلب من الموظف مسح رمز QR جديد عند تسجيل الدخول القادم',
      });
      setConfirmReset2faEmail(null);
      showToast(`تمت إعادة تعيين الـ 2FA للموظف ${member.name} بنجاح`, 'success');
      await onRefresh();
    } catch {
      showToast('تعذر إعادة تعيين الـ 2FA.', 'error');
    } finally {
      setBusyEmail(null);
    }
  };

  const handleUnlockStaff = async (member: StaffMember) => {
    setBusyEmail(member.email);
    try {
      await updateStaffSecurityProfile(member.email, {
        failedAttempts: 0,
        lockedUntil: 0,
      });
      showToast(`تم فك القفل المؤقت عن حساب ${member.name}`, 'success');
      await onRefresh();
    } catch {
      showToast('تعذر فك قفل الحساب.', 'error');
    } finally {
      setBusyEmail(null);
    }
  };

  const handleDelete = async (member: StaffMember) => {
    setBusyEmail(member.email);
    try {
      await deleteStaffMember(member.email);
      await logAuditEvent({
        action: 'staff_deleted',
        actor,
        targetType: 'staff',
        targetId: member.email,
        summary: `حذف حساب الموظف: ${member.name} (${member.email})`,
      });
      setConfirmDeleteEmail(null);
      showToast('تم حذف سجل الموظف وإيقاف وصوله للنظام', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حذف هذا السجل.', 'error');
    } finally {
      setBusyEmail(null);
    }
  };

  const handleOpenOwner2faSetup = async () => {
    const setup = createTotpSetup(BOOTSTRAPPED_ADMIN_EMAIL);
    setOwnerTotpSecret(setup.secret);
    setOwnerTotpCode('');
    try {
      const qr = await generateQrCodeDataUrl(setup.otpauthUri);
      setOwnerTotpQr(qr);
      setOwner2faModalOpen(true);
    } catch {
      showToast('تعذر توليد رمز الاستجابة السريع (QR).', 'error');
    }
  };

  const handleConfirmOwner2faEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTotpCode(ownerTotpSecret, ownerTotpCode)) {
      showToast('رمز التحقق غير صحيح. تأكد من إدخال الرمز ذي الـ 6 أرقام من تطبيق المصادقة.', 'error');
      return;
    }
    setSavingOwner2fa(true);
    try {
      await updateStaffSecurityProfile(BOOTSTRAPPED_ADMIN_EMAIL, {
        totpEnabled: true,
        totpVerified: true,
        totpSecret: ownerTotpSecret,
      });
      await logAuditEvent({
        action: '2fa_owner_toggled',
        actor,
        targetType: 'staff',
        targetId: BOOTSTRAPPED_ADMIN_EMAIL,
        summary: 'تفعيل المصادقة الثنائية (2FA) الاختيارية لحساب المالك العام',
      });
      setOwner2faModalOpen(false);
      showToast('تم تفعيل المصادقة الثنائية (2FA) لحساب المالك بنجاح', 'success');
      await onRefresh();
    } catch {
      showToast('تعذر حفظ إعداد المصادقة الثنائية.', 'error');
    } finally {
      setSavingOwner2fa(false);
    }
  };

  const handleDisableOwner2fa = async () => {
    setSavingOwner2fa(true);
    try {
      await updateStaffSecurityProfile(BOOTSTRAPPED_ADMIN_EMAIL, {
        totpEnabled: false,
        totpVerified: false,
        totpSecret: '',
      });
      await logAuditEvent({
        action: '2fa_owner_toggled',
        actor,
        targetType: 'staff',
        targetId: BOOTSTRAPPED_ADMIN_EMAIL,
        summary: 'إلغاء تفعيل المصادقة الثنائية (2FA) لحساب المالك العام',
      });
      showToast('تم إيقاف المصادقة الثنائية لحساب المالك', 'info');
      await onRefresh();
    } catch {
      showToast('تعذر تحديث إعداد المصادقة الثنائية.', 'error');
    } finally {
      setSavingOwner2fa(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`تم نسخ ${label}`, 'success');
    } catch {
      showToast(`تعذر النسخ التلقائي — انسخ ${label} يدوياً.`, 'info');
    }
  };

  const nowMs = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            إدارة الموظفين والأمان والمصادقة الثنائية
          </h1>
          <p className="text-sm text-[#556660] mt-1">
            أنشئ حسابات الموظفين المخولين بالبريد وكلمة المرور مع تغيير إجباري لكلمة المرور ومصادقة ثنائية (2FA)، وتحكم بالتجميد الفوري أو إعادة تعيين الـ 2FA.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          <Plus className="w-4 h-4 text-[#E8C97E]" />
          إضافة موظف مخوّل
        </button>
      </div>

      {/* Created Staff Credentials Copy Card */}
      {createdCredentials && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <h2 className="font-display font-extrabold text-sm">
                  تم إنشاء حساب الموظف ({createdCredentials.name}) بنجاح
                </h2>
                <p className="text-xs text-emerald-800">
                  أرسل هذه البيانات للموظف. عند أول دخول، سيُجبر على تغيير كلمة المرور المؤقتة ثم ربط تطبيق المصادقة (Google Authenticator).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCredentials(null)}
              className="p-1.5 rounded-lg text-emerald-800 hover:bg-emerald-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white rounded-xl p-3.5 border border-emerald-200">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-[#6B7A74] block">البريد الإلكتروني</span>
                <span dir="ltr" className="font-mono text-xs font-bold text-[#0F332B]">
                  {createdCredentials.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(createdCredentials.email, 'البريد الإلكتروني')}
                className="p-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] text-[#0F332B]"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-[#6B7A74] block">كلمة المرور المؤقتة</span>
                <span dir="ltr" className="font-mono text-xs font-bold text-[#0E6E73]">
                  {createdCredentials.tempPassword}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(createdCredentials.tempPassword, 'كلمة المرور المؤقتة')}
                className="p-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] text-[#0F332B]"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Google Firewall & Optional Owner 2FA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#0E6E73]/30 p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#0F332B] text-[#E8C97E] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-extrabold text-[#0F332B]">
                جدار حماية Google للمالك العام (Whitelist)
              </h2>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                مفعّل
              </span>
            </div>
            <p className="text-xs text-[#374B45] leading-relaxed">
              الدخول عبر زر Google محصور برمجياً وقواعدياً في البريد{' '}
              <strong dir="ltr" className="font-mono text-[#0F332B]">
                {BOOTSTRAPPED_ADMIN_EMAIL}
              </strong>{' '}
              فقط، ويُمنع التسجيل الذاتي أو دخول أي بريد Google آخر فوراً.
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E6DCCA] p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-[#B88E3E] shrink-0" />
              <div>
                <h3 className="font-display font-bold text-sm text-[#0F332B]">
                  التحقق بخطوتين للمالك (2FA اختياري)
                </h3>
                <p className="text-xs text-[#6B7A74]">
                  {owner2faEnabled
                    ? 'مفعّل — يُطلب رمز Google Authenticator بعد دخول Google'
                    : 'غير مفعّل حالياً (المصادقة الإلزامية مفعّلة لجميع الموظفين)'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            {owner2faEnabled ? (
              <button
                type="button"
                disabled={savingOwner2fa}
                onClick={handleDisableOwner2fa}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-800 border border-red-200 hover:bg-red-100 disabled:opacity-60"
              >
                {savingOwner2fa ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldOff className="w-3.5 h-3.5" />
                )}
                إيقاف 2FA للمالك
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenOwner2faSetup}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#FAF7F0] text-[#0F332B] border border-[#E6DCCA] hover:border-[#0E6E73]"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#0E6E73]" />
                تفعيل 2FA لحساب المالك
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Staff Accounts Table */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
        <div className="px-5 py-3.5 bg-[#FAF7F0] border-b border-[#E6DCCA] flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-extrabold text-[#0F332B]">
            حسابات الموظفين والمخولين ({staffAccounts.length})
          </h3>
          <span className="text-xs text-[#556660]">
            جميع الموظفين يدخلون بالبريد وكلمة المرور + رمز المصادقة الثنائية (TOTP)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#FAF7F0]/60 text-xs text-[#556660] border-b border-[#E6DCCA]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">الموظف</th>
                <th className="py-3.5 px-4 font-semibold">الدور والصلاحيات</th>
                <th className="py-3.5 px-4 font-semibold">حالة الأمان و 2FA</th>
                <th className="py-3.5 px-4 font-semibold">حالة الحساب</th>
                <th className="py-3.5 px-4 font-semibold">التحكم السريع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E9DC]">
              {/* Always show Owner Row */}
              <tr className="bg-emerald-50/25">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#0E6E73] shrink-0" />
                    <div>
                      <p className="font-bold text-[#0F332B]">المالك العام — راية الفُرات</p>
                      <p dir="ltr" className="font-mono text-xs text-[#0E6E73] text-right">
                        {BOOTSTRAPPED_ADMIN_EMAIL}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-xs">
                  <span className="font-bold text-[#0F332B]">{STAFF_ROLE_LABELS.super_admin}</span>
                  <p className="text-[11px] text-[#6B7A74] mt-0.5">كامل الصلاحيات + سجل المراقبة</p>
                </td>
                <td className="py-3.5 px-4 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#E6DCCA] font-semibold text-[#0F332B]">
                    <Lock className="w-3 h-3 text-[#B88E3E]" />
                    Google {owner2faEnabled ? '+ 2FA مفعّل' : 'فقط'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-xs font-bold text-emerald-800">نشط دائماً</td>
                <td className="py-3.5 px-4 text-xs text-[#6B7A74]">حساب المالك الأساسي</td>
              </tr>

              {staffAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 px-4 text-center text-xs text-[#6B7A74]">
                    لا يوجد موظفون مضافون حالياً. اضغط على «إضافة موظف مخوّل» لإنشاء حساب موظف جديد.
                  </td>
                </tr>
              ) : (
                staffAccounts.map((member) => {
                  const isLocked = Boolean(member.lockedUntil && member.lockedUntil > nowMs);
                  const isBusy = busyEmail === member.email;
                  const permLabels = [
                    member.permissions.manageBookings ? 'الحجوزات والمالية' : '',
                    member.permissions.managePackages ? 'الباقات والإعلانات' : '',
                    member.permissions.manageForms ? 'منشئ الاستمارات' : '',
                    member.permissions.manageSettings ? 'الإعدادات' : '',
                  ].filter(Boolean);

                  return (
                    <tr
                      key={member.email}
                      className={
                        !member.active
                          ? 'bg-red-50/30'
                          : isLocked
                          ? 'bg-amber-50/40'
                          : 'hover:bg-[#FAF7F0]/50'
                      }
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#0F332B]">{member.name}</p>
                        <p dir="ltr" className="font-mono text-xs text-[#556660] text-right">
                          {member.email}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-xs space-y-1">
                        <p className="font-bold text-[#0F332B]">
                          {STAFF_ROLE_LABELS[member.role]}
                        </p>
                        <p className="text-[11px] text-[#6B7A74]">
                          {permLabels.length > 0 ? permLabels.join(' · ') : 'اطلاع عام فقط'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-xs space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                              member.mustChangePassword
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {member.mustChangePassword
                              ? 'بانتظار تغيير كلمة المرور'
                              : 'كلمة مرور مخصصة'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                              member.totpVerified
                                ? 'bg-[#0E6E73]/10 text-[#0E6E73] border-[#0E6E73]/30'
                                : 'bg-[#FAF7F0] text-[#8C6D2E] border-[#E6DCCA]'
                            }`}
                          >
                            {member.totpVerified ? '2FA مربوط ومفعّل' : 'بانتظار ربط 2FA'}
                          </span>
                        </div>
                        {isLocked && member.lockedUntil && (
                          <p className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            مقفل مؤقتاً ({formatRemainingLockout(member.lockedUntil - nowMs)})
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-bold">
                        {member.active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800">
                            <UserCheck className="w-3.5 h-3.5" />
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <UserX className="w-3.5 h-3.5" />
                            مجمّد (موقوف)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openEditModal(member)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0F332B]"
                            title="تعديل الصلاحيات"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            الصلاحيات
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleFreeze(member)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                              member.active
                                ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : member.active ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            {member.active ? 'تجميد فوري' : 'تفعيل'}
                          </button>

                          {confirmReset2faEmail === member.email ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReset2fa(member)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#0E6E73] text-white text-xs font-bold"
                            >
                              تأكيد إعادة 2FA
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmReset2faEmail(member.email)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E6DCCA] hover:border-[#0E6E73] text-xs font-semibold text-[#0E6E73]"
                              title="إعادة تعيين الـ 2FA عند فقدان الهاتف"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              إعادة تعيين الـ 2FA
                            </button>
                          )}

                          {isLocked && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUnlockStaff(member)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              فك القفل
                            </button>
                          )}

                          {confirmDeleteEmail === member.email ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(member)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-700 text-white text-xs font-bold"
                            >
                              تأكيد الحذف
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteEmail(member.email)}
                              className="p-1.5 rounded-lg text-red-700 hover:bg-red-50"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Staff Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xl rounded-2xl border border-[#E6DCCA] overflow-hidden my-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <h2 className="font-display font-extrabold text-lg text-[#0F332B]">
                إنشاء حساب موظف جديد (Email/Password + 2FA)
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              {createError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: أحمد العلي"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F332B]">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@rayatalfurat.sa"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-left"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0F332B]">
                    كلمة المرور المؤقتة (يُجبر الموظف على تغييرها بأول دخول) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewTempPassword(generateTemporaryPassword(12))}
                    className="text-xs font-bold text-[#0E6E73] hover:underline"
                  >
                    توليد كلمة مرور قوية
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showTempPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={newTempPassword}
                    onChange={(e) => setNewTempPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A74]"
                  >
                    {showTempPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#0F332B]">الدور الوظيفي</label>
                <select
                  value={newRole}
                  onChange={(e) => handleRolePresetChange(e.target.value as StaffRole, false)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-bold text-[#0F332B]"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-2.5">
                <p className="text-xs font-bold text-[#0F332B]">الصلاحيات التفصيلية للموظف:</p>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {(
                    [
                      ['manageBookings', 'الحجوزات والمدفوعات والتصدير'],
                      ['managePackages', 'الباقات والتصنيفات والإعلانات'],
                      ['manageForms', 'منشئ الاستمارات الديناميكية'],
                      ['manageSettings', 'إعدادات الهوية والموقع'],
                    ] as Array<[keyof StaffPermissions, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions[key]}
                        onChange={(e) =>
                          setNewPermissions((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                            manageStaff: false,
                          }))
                        }
                        className="w-4 h-4 accent-[#0F332B]"
                      />
                      <span className="font-semibold text-[#142621]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#556660] bg-[#FAF7F0] border border-[#E6DCCA]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  إنشاء الحساب وتفعيل الحماية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Permissions Modal */}
      {editingMember && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          onClick={() => setEditingMember(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl border border-[#E6DCCA] overflow-hidden my-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <div>
                <h2 className="font-display font-extrabold text-base text-[#0F332B]">
                  تعديل صلاحيات الموظف
                </h2>
                <p dir="ltr" className="font-mono text-xs text-[#6B7A74] text-right">
                  {editingMember.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">الاسم</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F332B]">الدور الوظيفي</label>
                <select
                  value={editRole}
                  onChange={(e) => handleRolePresetChange(e.target.value as StaffRole, true)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-bold text-[#0F332B]"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] space-y-2.5">
                <p className="text-xs font-bold text-[#0F332B]">الصلاحيات:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {(
                    [
                      ['manageBookings', 'الحجوزات والمدفوعات والتصدير'],
                      ['managePackages', 'الباقات والتصنيفات والإعلانات'],
                      ['manageForms', 'منشئ الاستمارات الديناميكية'],
                      ['manageSettings', 'إعدادات الهوية والموقع'],
                    ] as Array<[keyof StaffPermissions, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPermissions[key]}
                        onChange={(e) =>
                          setEditPermissions((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                            manageStaff: false,
                          }))
                        }
                        className="w-4 h-4 accent-[#0F332B]"
                      />
                      <span className="font-semibold text-[#142621]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#556660] bg-[#FAF7F0] border border-[#E6DCCA]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Optional 2FA Setup Modal */}
      {owner2faModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setOwner2faModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl border border-[#E6DCCA] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6DCCA] flex items-center justify-between">
              <h2 className="font-display font-extrabold text-base text-[#0F332B]">
                تفعيل المصادقة الثنائية للمالك (TOTP 2FA)
              </h2>
              <button
                type="button"
                onClick={() => setOwner2faModalOpen(false)}
                className="p-1.5 rounded-lg text-[#556660] hover:bg-[#EFE7D8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOwner2faEnable} className="p-6 space-y-4 text-center">
              <p className="text-xs text-[#556660] leading-relaxed">
                امسح رمز الاستجابة السريع (QR) باستخدام تطبيق{' '}
                <strong>Google Authenticator</strong> أو <strong>Microsoft Authenticator</strong>، ثم أدخل الرمز المكون من 6 أرقام لتفعيل الحماية.
              </p>

              {ownerTotpQr && (
                <div className="flex justify-center">
                  <img
                    src={ownerTotpQr}
                    alt="QR Code للمصادقة الثنائية"
                    className="w-44 h-44 rounded-xl border border-[#E6DCCA] p-1.5 bg-white"
                  />
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-between gap-2 text-xs">
                <span dir="ltr" className="font-mono font-bold text-[#0F332B] truncate">
                  {ownerTotpSecret}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(ownerTotpSecret, 'المفتاح السري')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E6DCCA] text-[11px] font-bold shrink-0"
                >
                  نسخ المفتاح
                </button>
              </div>

              <div className="space-y-1 text-right">
                <label className="text-xs font-bold text-[#0F332B]">
                  أدخل الرمز ذو الـ 6 أرقام للتأكيد *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  dir="ltr"
                  value={ownerTotpCode}
                  onChange={(e) => setOwnerTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-center font-mono text-xl font-extrabold tracking-[0.35em]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOwner2faModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#556660] bg-[#FAF7F0] border border-[#E6DCCA]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingOwner2fa || ownerTotpCode.length !== 6}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  {savingOwner2fa && <Loader2 className="w-4 h-4 animate-spin" />}
                  تأكيد وتفعيل 2FA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
