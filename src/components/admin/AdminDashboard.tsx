import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  History,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  Package,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  isAuthorizedOwnerUser,
  isPasswordStaffUser,
} from '../../firebase';
import {
  ROLE_PRESET_PERMISSIONS,
  STAFF_ROLE_LABELS,
  type AuditActor,
  type AuditLog,
  type Booking,
  type FormTemplate,
  type PackageCategory,
  type SeasonPoster,
  type SiteSettings,
  type StaffMember,
  type StaffPermissions,
  type TravelPackage,
} from '../../types';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../../data/defaults';
import {
  fetchAllBookingsAdmin,
  fetchAllCategoriesAdmin,
  fetchAllFormTemplatesAdmin,
  fetchAllPackagesAdmin,
  fetchAllSeasonPostersAdmin,
  fetchAllStaffAdmin,
  fetchAuditLogsOwnerOnly,
  logAuditEvent,
  seedInitialAgencyDataIfEmpty,
  subscribeStaffProfile,
  updateStaffSecurityProfile,
} from '../../services/firestoreService';
import {
  clearLocalFailedAttempts,
  createTotpSetup,
  formatRemainingLockout,
  generateQrCodeDataUrl,
  getLocalLockState,
  LOCKOUT_DURATION_MS,
  LOCKOUT_MAX_ATTEMPTS,
  recordLocalFailedAttempt,
  validateStrongPassword,
  verifyTotpCode,
} from '../../utils/securityUtils';
import { BrandLogo } from '../BrandLogo';
import { useToast } from '../ToastProvider';
import { AdminOverview } from './AdminOverview';
import { PackagesManager } from './PackagesManager';
import { FormBuilderManager } from './FormBuilderManager';
import { BookingsManager } from './BookingsManager';
import { PostersManager } from './PostersManager';
import { SettingsManager } from './SettingsManager';
import { StaffManager } from './StaffManager';
import { AuditLogViewer } from './AuditLogViewer';
import { ManifestExportModal } from './ManifestExportModal';
import { FinancialDashboard } from './FinancialDashboard';

export type AdminTab =
  | 'overview'
  | 'packages'
  | 'posters'
  | 'forms'
  | 'bookings'
  | 'financials'
  | 'settings'
  | 'staff'
  | 'audit';

interface AdminDashboardProps {
  user: User | null;
  authReady: boolean;
  blockedAuthEmail?: string;
  onClearBlockedAuth?: () => void;
  settings: SiteSettings;
  initialTab?: AdminTab;
  onSettingsUpdated: (next: SiteSettings) => void;
  onPublicDataChanged: () => void;
  onBackToSite: () => void;
}

const GOOGLE_DENIED_MESSAGE = 'عذراً، هذا الحساب غير مصرح له بالدخول عبر Google';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  authReady,
  blockedAuthEmail = '',
  onClearBlockedAuth,
  settings,
  initialTab = 'overview',
  onSettingsUpdated,
  onPublicDataChanged,
  onBackToSite,
}) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Auth & Security Gate States
  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [twoFactorSessionUid, setTwoFactorSessionUid] = useState<string | null>(null);
  const [securityBannerError, setSecurityBannerError] = useState<string>('');
  const [localBlockedGoogleMsg, setLocalBlockedGoogleMsg] = useState<string>('');
  const [authNotice, setAuthNotice] = useState<string>('');
  const [unauthorizedHost, setUnauthorizedHost] = useState<string>('');

  // Login Form States
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [signingInEmail, setSigningInEmail] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Forced Password Change States
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPasswords, setShowNewPasswords] = useState(false);
  const [savingNewPassword, setSavingNewPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Mandatory 2FA Enrollment States
  const [enrollSecret, setEnrollSecret] = useState('');
  const [enrollQrUrl, setEnrollQrUrl] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [savingEnroll, setSavingEnroll] = useState(false);

  // 2FA Login Challenge States
  const [totpInput, setTotpInput] = useState('');
  const [totpError, setTotpError] = useState('');
  const [verifyingTotp, setVerifyingTotp] = useState(false);

  // Workspace Data States
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [categories, setCategories] = useState<PackageCategory[]>([]);
  const [posters, setPosters] = useState<SeasonPoster[]>([]);
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [packageManifestTargetId, setPackageManifestTargetId] = useState<string | null>(null);

  const loadedWorkspaceUidRef = useRef<string | null>(null);
  const ownerLoginLoggedUidRef = useRef<string | null>(null);

  const isBootstrappedOwner = isAuthorizedOwnerUser(user);
  const isPasswordStaff = isPasswordStaffUser(user);
  const userEmailLower = (user?.email || '').trim().toLowerCase();

  const effectivePermissions: StaffPermissions = useMemo(() => {
    if (isBootstrappedOwner) {
      return ROLE_PRESET_PERMISSIONS.super_admin;
    }
    if (isPasswordStaff && staffProfile && staffProfile.active) {
      return {
        managePackages: Boolean(staffProfile.permissions?.managePackages),
        manageForms: Boolean(staffProfile.permissions?.manageForms),
        manageBookings: Boolean(staffProfile.permissions?.manageBookings),
        manageSettings: Boolean(staffProfile.permissions?.manageSettings),
        manageStaff: false, // Staff management & Audit Logs strictly Owner-only
      };
    }
    return {
      managePackages: false,
      manageForms: false,
      manageBookings: false,
      manageSettings: false,
      manageStaff: false,
    };
  }, [isBootstrappedOwner, isPasswordStaff, staffProfile]);

  const currentActor: AuditActor = useMemo(
    () => ({
      email: userEmailLower,
      name:
        staffProfile?.name ||
        user?.displayName ||
        (isBootstrappedOwner ? 'المدير العام — راية الفُرات' : userEmailLower || 'موظف'),
      role: isBootstrappedOwner ? 'super_admin' : staffProfile?.role || 'staff',
    }),
    [userEmailLower, staffProfile?.name, staffProfile?.role, user?.displayName, isBootstrappedOwner]
  );

  // ==================== REAL-TIME STAFF PROFILE SUBSCRIPTION ====================
  useEffect(() => {
    if (!authReady) return;

    if (!user || (!isBootstrappedOwner && !isPasswordStaff)) {
      setStaffProfile(null);
      setTwoFactorSessionUid(null);
      loadedWorkspaceUidRef.current = null;
      ownerLoginLoggedUidRef.current = null;
      setCheckingAccess(false);
      return;
    }

    if (twoFactorSessionUid && twoFactorSessionUid !== user.uid) {
      setTwoFactorSessionUid(null);
    }

    setCheckingAccess(true);
    let initialResolved = false;

    const unsub = subscribeStaffProfile(
      userEmailLower,
      async (profile) => {
        if (isBootstrappedOwner) {
          setStaffProfile(profile);
          if (!initialResolved) {
            initialResolved = true;
            setCheckingAccess(false);
          }
          return;
        }

        // Password Staff Real-Time Firewall & Kill Switch
        if (!profile) {
          setSecurityBannerError(
            'عذراً، هذا الحساب غير مسجل ضمن الموظفين المخولين أو تم حذفه من النظام.'
          );
          setStaffProfile(null);
          setTwoFactorSessionUid(null);
          loadedWorkspaceUidRef.current = null;
          setCheckingAccess(false);
          try {
            await signOut(auth);
          } catch {
            // ignore signout error
          }
          return;
        }

        if (!profile.active) {
          setSecurityBannerError(
            'تم إيقاف وتجميد هذا الحساب من قِبل المدير العام. تم إنهاء الجلسة فوراً.'
          );
          setStaffProfile(null);
          setTwoFactorSessionUid(null);
          loadedWorkspaceUidRef.current = null;
          setCheckingAccess(false);
          showToast('تم إيقاف هذا الحساب من قِبل الإدارة.', 'error');
          try {
            await signOut(auth);
          } catch {
            // ignore signout error
          }
          return;
        }

        setStaffProfile(profile);
        if (!initialResolved) {
          initialResolved = true;
          setCheckingAccess(false);
        }
      },
      (err) => {
        console.error('Staff profile subscription error:', err);
        if (!initialResolved) {
          initialResolved = true;
          setCheckingAccess(false);
        }
        if (!isBootstrappedOwner) {
          setSecurityBannerError('تعذر التحقق من صلاحيات حساب الموظف.');
        }
      }
    );

    return () => unsub();
  }, [user, authReady, userEmailLower, isBootstrappedOwner, isPasswordStaff]);

  // ==================== SECURITY GATE EVALUATION ====================
  const nowMs = Date.now();
  const isAccountLocked = Boolean(
    !isBootstrappedOwner && staffProfile?.lockedUntil && staffProfile.lockedUntil > nowMs
  );
  const needsPasswordChange = Boolean(
    user && isPasswordStaff && staffProfile?.active && staffProfile.mustChangePassword
  );
  const needs2faEnrollment = Boolean(
    user &&
      isPasswordStaff &&
      staffProfile?.active &&
      !needsPasswordChange &&
      !staffProfile.totpVerified
  );
  const requires2faLoginChallenge = Boolean(
    user &&
      staffProfile &&
      staffProfile.totpEnabled &&
      staffProfile.totpVerified &&
      Boolean(staffProfile.totpSecret) &&
      twoFactorSessionUid !== user.uid
  );

  const canAccessWorkspace = Boolean(
    authReady &&
      !checkingAccess &&
      user &&
      (isBootstrappedOwner || (isPasswordStaff && staffProfile?.active)) &&
      !isAccountLocked &&
      !needsPasswordChange &&
      !needs2faEnrollment &&
      !requires2faLoginChallenge
  );

  // Generate QR code automatically when employee enters Gate 2 (Mandatory 2FA Enrollment)
  useEffect(() => {
    if (!needs2faEnrollment || !userEmailLower) {
      return;
    }
    if (enrollSecret && enrollQrUrl) return;
    let cancelled = false;
    const setup = createTotpSetup(userEmailLower);
    setEnrollSecret(setup.secret);
    setEnrollCode('');
    setEnrollError('');
    generateQrCodeDataUrl(setup.otpauthUri)
      .then((qr) => {
        if (!cancelled) setEnrollQrUrl(qr);
      })
      .catch(() => {
        if (!cancelled) setEnrollError('تعذر إنشاء رمز الاستجابة السريع (QR).');
      });
    return () => {
      cancelled = true;
    };
  }, [needs2faEnrollment, userEmailLower, enrollSecret, enrollQrUrl]);

  // ==================== LOAD WORKSPACE ONLY AFTER ALL GATES PASS ====================
  const loadAdminWorkspace = useCallback(
    async (
      perms: StaffPermissions,
      canSeed: boolean,
      ownerMode: boolean,
      currentEmail?: string
    ) => {
      setLoadingData(true);
      try {
        if (canSeed) {
          const seeded = await seedInitialAgencyDataIfEmpty(currentEmail);
          if (seeded) {
            showToast('تمت تهيئة وتحديث بيانات مكتب راية الفُرات في قاعدة البيانات.', 'info');
            onPublicDataChanged();
          }
        }

        const [pkgsRes, catsRes, postersRes, formsRes, bookingsRes, staffRes, auditRes] =
          await Promise.all([
            fetchAllPackagesAdmin(),
            fetchAllCategoriesAdmin(),
            perms.manageSettings || perms.managePackages
              ? fetchAllSeasonPostersAdmin()
              : Promise.resolve([]),
            fetchAllFormTemplatesAdmin(),
            fetchAllBookingsAdmin(),
            ownerMode ? fetchAllStaffAdmin() : Promise.resolve([]),
            ownerMode ? fetchAuditLogsOwnerOnly() : Promise.resolve([]),
          ]);

        setPackages(pkgsRes);
        setCategories(catsRes);
        setPosters(postersRes);
        setForms(formsRes);
        setBookings(bookingsRes);
        setStaffList(staffRes);
        setAuditLogs(auditRes);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Missing or insufficient permissions') || msg.includes('permission-denied')) {
          showToast('ليست لديك صلاحية كاملة لبعض الأقسام. تحقق من إعدادات الحساب.', 'info');
        } else {
          console.error(err);
          showToast('تعذر تحميل بعض بيانات لوحة التحكم.', 'error');
        }
      } finally {
        setLoadingData(false);
      }
    },
    [onPublicDataChanged, showToast]
  );

  useEffect(() => {
    if (!canAccessWorkspace || !user) return;
    if (loadedWorkspaceUidRef.current === user.uid) return;
    loadedWorkspaceUidRef.current = user.uid;

    loadAdminWorkspace(
      effectivePermissions,
      isBootstrappedOwner,
      isBootstrappedOwner,
      userEmailLower
    );

    if (isBootstrappedOwner && ownerLoginLoggedUidRef.current !== user.uid) {
      ownerLoginLoggedUidRef.current = user.uid;
      void logAuditEvent({
        action: 'login_success',
        actor: currentActor,
        targetType: 'session',
        targetId: user.uid,
        summary: 'تسجيل دخول المالك العام بنجاح عبر Google',
      });
    }
  }, [
    canAccessWorkspace,
    user,
    effectivePermissions,
    isBootstrappedOwner,
    userEmailLower,
    loadAdminWorkspace,
    currentActor,
  ]);

  // ==================== AUTH HANDLERS ====================
  const activeGoogleBlockedMsg =
    localBlockedGoogleMsg || (blockedAuthEmail ? GOOGLE_DENIED_MESSAGE : '');

  const handleGoogleSignIn = async () => {
    if (signingInGoogle || signingInEmail) return;
    setSigningInGoogle(true);
    setAuthNotice('');
    setSecurityBannerError('');
    setLocalBlockedGoogleMsg('');
    onClearBlockedAuth?.();
    setUnauthorizedHost('');

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!isAuthorizedOwnerUser(cred.user)) {
        setLocalBlockedGoogleMsg(GOOGLE_DENIED_MESSAGE);
        await signOut(auth);
        showToast(GOOGLE_DENIED_MESSAGE, 'error');
        return;
      }
      showToast('تم التحقق من حساب المالك العام بنجاح', 'success');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      const host = typeof window !== 'undefined' ? window.location.hostname : '';

      if (code === 'auth/unauthorized-domain') {
        setUnauthorizedHost(host);
        const msg = `تم رفض تسجيل الدخول لأن النطاق الحالي (${host}) غير مضاف إلى النطاقات المصرح بها في Firebase Authentication.`;
        setAuthNotice(msg);
        showToast('النطاق الحالي غير مصرح له في Firebase Auth', 'error');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        const msg = 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
        setAuthNotice(msg);
        showToast(msg, 'info');
      } else if (code === 'auth/popup-blocked') {
        const msg = 'قام المتصفح بحظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول مجدداً.';
        setAuthNotice(msg);
        showToast(msg, 'error');
      } else if (code === 'auth/network-request-failed') {
        const msg = 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت وحاول مجدداً.';
        setAuthNotice(msg);
        showToast(msg, 'error');
      } else {
        const msg = `تعذر إكمال تسجيل الدخول عبر Google${code ? ` (${code})` : ''}.`;
        setAuthNotice(msg);
        showToast(msg, 'error');
      }
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleEmailStaffSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingInEmail || signingInGoogle) return;

    const cleanEmail = loginEmail.trim().toLowerCase();
    setAuthNotice('');
    setSecurityBannerError('');
    setLocalBlockedGoogleMsg('');
    onClearBlockedAuth?.();

    if (!cleanEmail || !loginPassword) {
      setAuthNotice('يُرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    if (cleanEmail === BOOTSTRAPPED_ADMIN_EMAIL) {
      setAuthNotice('حساب المالك العام يدخل حصراً عبر زر «تسجيل الدخول بواسطة Google».');
      return;
    }

    const lockState = getLocalLockState(cleanEmail);
    if (lockState.isLocked) {
      const msg = `تم إيقاف محاولات الدخول لهذا الحساب مؤقتاً لمدة 15 دقيقة بعد 5 محاولات خاطئة. المتبقي: ${formatRemainingLockout(
        lockState.remainingMs
      )}.`;
      setSecurityBannerError(msg);
      showToast('الحساب مقفل مؤقتاً بسبب محاولات خاطئة', 'error');
      return;
    }

    setSigningInEmail(true);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, loginPassword);
      clearLocalFailedAttempts(cleanEmail);
      setLoginPassword('');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        const failRes = recordLocalFailedAttempt(cleanEmail);
        if (failRes.isLocked) {
          const msg = `تم استنفاد 5 محاولات خاطئة. تم قفل الدخول مؤقتاً لمدة 15 دقيقة للحماية.`;
          setSecurityBannerError(msg);
          showToast(msg, 'error');
        } else {
          const msg = `البريد الإلكتروني أو كلمة المرور غير صحيحة. المحاولات المتبقية قبل القفل المؤقت: ${failRes.attemptsLeft}`;
          setAuthNotice(msg);
          showToast(msg, 'error');
        }
      } else if (code === 'auth/too-many-requests') {
        const msg = 'تم تجاوز عدد محاولات الدخول المسموح بها مؤقتاً. يُرجى الانتظار 15 دقيقة.';
        setSecurityBannerError(msg);
        showToast(msg, 'error');
      } else if (code === 'auth/user-disabled') {
        const msg = 'تم تعطيل هذا الحساب. تواصل مع المدير العام.';
        setSecurityBannerError(msg);
        showToast(msg, 'error');
      } else if (code === 'auth/operation-not-allowed') {
        const msg = 'مزود الدخول بالبريد وكلمة المرور غير مفعّل في مشروع Firebase.';
        setAuthNotice(msg);
        showToast(msg, 'error');
      } else {
        const msg = `تعذر تسجيل الدخول (${code || 'خطأ غير معروف'}).`;
        setAuthNotice(msg);
        showToast(msg, 'error');
      }
    } finally {
      setSigningInEmail(false);
    }
  };

  // ==================== GATE 1 HANDLER: MANDATORY PASSWORD CHANGE ====================
  const handleMandatoryPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user) return;
    setPasswordChangeError('');

    const check = validateStrongPassword(newPassword);
    if (!check.valid) {
      setPasswordChangeError(check.errors[0]);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setSavingNewPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      await updateStaffSecurityProfile(userEmailLower, {
        mustChangePassword: false,
      });
      await logAuditEvent({
        action: 'password_changed',
        actor: currentActor,
        targetType: 'staff',
        targetId: userEmailLower,
        summary: `تعيين كلمة مرور شخصية قوية للموظف: ${currentActor.name}`,
      });
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('تم تحديث كلمة المرور بنجاح. أتمم الآن تفعيل المصادقة الثنائية (2FA).', 'success');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/requires-recent-login') {
        setPasswordChangeError(
          'انتهت صلاحية الجلسة الحساسة. يُرجى تسجيل الخروج والدخول بكلمة المرور المؤقتة ثم تعيين كلمة المرور مباشرة.'
        );
      } else {
        setPasswordChangeError('تعذر تحديث كلمة المرور. تأكد من قوة كلمة المرور وحاول مجدداً.');
      }
    } finally {
      setSavingNewPassword(false);
    }
  };

  // ==================== SHARED TOTP FAILURE TRACKER (5 FAILURES -> 15-MIN LOCK) ====================
  const handleTotpFailure = async (setErrorMsg: (m: string) => void) => {
    const localFail = recordLocalFailedAttempt(userEmailLower);
    const prevRemoteFails = staffProfile?.failedAttempts || 0;
    const totalFails = Math.max(localFail.failedAttempts, prevRemoteFails + 1);
    const shouldLock = totalFails >= LOCKOUT_MAX_ATTEMPTS;
    const lockedUntil = shouldLock ? Date.now() + LOCKOUT_DURATION_MS : 0;

    if (staffProfile) {
      try {
        await updateStaffSecurityProfile(userEmailLower, {
          failedAttempts: totalFails,
          lockedUntil,
        });
      } catch {
        // ignore if rules block
      }
    }

    if (shouldLock) {
      await logAuditEvent({
        action: 'login_locked',
        actor: currentActor,
        targetType: 'staff',
        targetId: userEmailLower,
        summary: `قفل الحساب مؤقتاً لمدة 15 دقيقة بعد ${LOCKOUT_MAX_ATTEMPTS} محاولات تحقق فاشلة (2FA)`,
      });
      const lockMsg =
        'تم إدخال رمز تحقق خاطئ 5 مرات متتالية. تم قفل الدخول مؤقتاً لمدة 15 دقيقة وتم تسجيل خروجك.';
      setSecurityBannerError(lockMsg);
      setErrorMsg(lockMsg);
      showToast(lockMsg, 'error');
      await signOut(auth);
      return;
    }

    const left = Math.max(1, LOCKOUT_MAX_ATTEMPTS - totalFails);
    const msg = `رمز التحقق غير صحيح. المحاولات المتبقية قبل القفل لمدة 15 دقيقة: ${left}`;
    setErrorMsg(msg);
  };

  // ==================== GATE 2 HANDLER: MANDATORY 2FA ENROLLMENT ====================
  const handleComplete2faEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !enrollSecret) return;
    setEnrollError('');
    setSavingEnroll(true);
    try {
      if (!verifyTotpCode(enrollSecret, enrollCode)) {
        await handleTotpFailure(setEnrollError);
        return;
      }

      clearLocalFailedAttempts(userEmailLower);
      await updateStaffSecurityProfile(userEmailLower, {
        totpSecret: enrollSecret,
        totpEnabled: true,
        totpVerified: true,
        failedAttempts: 0,
        lockedUntil: 0,
        touchLastLogin: true,
      });

      setTwoFactorSessionUid(user.uid);
      await logAuditEvent({
        action: '2fa_enrolled',
        actor: currentActor,
        targetType: 'staff',
        targetId: userEmailLower,
        summary: `ربط وتفعيل المصادقة الثنائية (2FA) لأول مرة للموظف: ${currentActor.name}`,
      });
      await logAuditEvent({
        action: 'login_success',
        actor: currentActor,
        targetType: 'session',
        targetId: user.uid,
        summary: `تسجيل دخول موظف ناجح (بعد تفعيل 2FA): ${currentActor.name}`,
      });
      setEnrollCode('');
      setEnrollSecret('');
      setEnrollQrUrl('');
      showToast('تم تفعيل المصادقة الثنائية والدخول بنجاح!', 'success');
    } catch {
      setEnrollError('تعذر حفظ إعداد المصادقة الثنائية. حاول مجدداً.');
    } finally {
      setSavingEnroll(false);
    }
  };

  // ==================== GATE 3 HANDLER: 2FA CHALLENGE ON LOGIN ====================
  const handleVerify2faChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !staffProfile?.totpSecret) return;
    setTotpError('');
    setVerifyingTotp(true);
    try {
      if (!verifyTotpCode(staffProfile.totpSecret, totpInput)) {
        await handleTotpFailure(setTotpError);
        return;
      }

      clearLocalFailedAttempts(userEmailLower);
      try {
        await updateStaffSecurityProfile(userEmailLower, {
          failedAttempts: 0,
          lockedUntil: 0,
          touchLastLogin: true,
        });
      } catch {
        // non-blocking
      }

      setTwoFactorSessionUid(user.uid);
      await logAuditEvent({
        action: 'login_success',
        actor: currentActor,
        targetType: 'session',
        targetId: user.uid,
        summary: isBootstrappedOwner
          ? 'تسجيل دخول المالك العام بنجاح (Google + 2FA)'
          : `تسجيل دخول موظف بنجاح (Password + 2FA): ${currentActor.name}`,
      });
      setTotpInput('');
      showToast('تم التحقق من رمز الأمان والدخول بنجاح', 'success');
    } finally {
      setVerifyingTotp(false);
    }
  };

  const handleCopyHost = async () => {
    if (!unauthorizedHost) return;
    try {
      await navigator.clipboard.writeText(unauthorizedHost);
      showToast(`تم نسخ النطاق: ${unauthorizedHost}`, 'success');
    } catch {
      showToast('تعذر النسخ تلقائياً، انسخ اسم النطاق يدوياً.', 'info');
    }
  };

  const handleCopyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      showToast(`تم نسخ ${label}`, 'success');
    } catch {
      showToast(`تعذر النسخ التلقائي — انسخ ${label} يدوياً.`, 'info');
    }
  };

  const handleSignOut = async () => {
    setTwoFactorSessionUid(null);
    loadedWorkspaceUidRef.current = null;
    ownerLoginLoggedUidRef.current = null;
    await signOut(auth);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  };

  const refreshAll = async () => {
    await loadAdminWorkspace(
      effectivePermissions,
      false,
      isBootstrappedOwner,
      userEmailLower
    );
    onPublicDataChanged();
  };

  const refreshAuditLogsOnly = async () => {
    if (!isBootstrappedOwner) return;
    setLoadingAuditLogs(true);
    try {
      const logs = await fetchAuditLogsOwnerOnly();
      setAuditLogs(logs);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // ==================== LOADING VIEW ====================
  if (!authReady || checkingAccess) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-[#0F332B]">
          <Loader2 className="w-8 h-8 animate-spin text-[#0E6E73]" />
          <p className="text-sm font-medium">جارٍ التحقق من الهوية والصلاحيات الأمنية...</p>
        </div>
      </div>
    );
  }

  // ==================== LOGIN VIEW (NO PUBLIC SIGN-UP) ====================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E6DCCA] p-7 sm:p-9 space-y-6 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-3">
            <BrandLogo settings={settings} size="lg" showWordmark />
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
                بوابة دخول الإدارة والمخولين
              </h1>
              <p className="text-xs text-[#556660] leading-relaxed">
                نظام مصادقة هجين محمي: حساب المالك العام عبر Google، وحسابات الموظفين بالبريد وكلمة المرور + المصادقة الثنائية (2FA).
              </p>
            </div>
          </div>

          {activeGoogleBlockedMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-800">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{GOOGLE_DENIED_MESSAGE}</span>
              </div>
              <p className="text-[11px] text-red-800/90">
                الدخول عبر Google مقتصر حصراً على بريد المالك العام المعتمد.
              </p>
            </div>
          )}

          {securityBannerError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
              <span>{securityBannerError}</span>
            </div>
          )}

          {authNotice && (
            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#B88E3E]/50 text-xs text-[#0F332B] leading-relaxed space-y-2.5">
              <p>{authNotice}</p>
              {unauthorizedHost && (
                <div className="pt-2 border-t border-[#E6DCCA] space-y-2">
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-[#E6DCCA]">
                    <span dir="ltr" className="font-mono text-[11px] font-semibold text-[#0F332B] truncate">
                      {unauthorizedHost}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyHost}
                      className="px-2.5 py-1 rounded-md bg-[#0F332B] text-white text-[11px] font-bold shrink-0 hover:opacity-90"
                    >
                      نسخ النطاق
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Staff Email / Password Login Form */}
          <form onSubmit={handleEmailStaffSignIn} className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-[#0F332B]">
                دخول الموظفين والمخولين
              </h2>
              <span className="text-[11px] text-[#0E6E73] font-semibold">Email + 2FA</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">البريد الإلكتروني الوظيفي</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B7A74] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="staff@rayatalfurat.sa"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-left focus:outline-none focus:border-[#0E6E73]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7A74] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  dir="ltr"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-left focus:outline-none focus:border-[#0E6E73]"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A74]"
                  aria-label="إظهار أو إخفاء كلمة المرور"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={signingInEmail || signingInGoogle}
              className="w-full py-3 px-4 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {signingInEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 text-[#E8C97E]" />
              )}
              دخول الموظفين
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[#E6DCCA]" />
            <span className="shrink mx-3 text-[11px] font-semibold text-[#6B7A74]">
              أو للمالك العام فقط
            </span>
            <div className="flex-grow border-t border-[#E6DCCA]" />
          </div>

          {/* Whitelisted Super Admin Google Sign-In */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={signingInGoogle || signingInEmail}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-xl font-display font-bold text-sm text-[#0F332B] bg-[#FAF7F0] border border-[#B88E3E]/60 hover:bg-[#F3ECE0] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60"
            >
              {signingInGoogle ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#0E6E73]" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-[#0E6E73]" />
              )}
              تسجيل الدخول بواسطة Google
            </button>
            <p className="text-[11px] text-center text-[#6B7A74]">
              لا يتوفر تسجيل حسابات جديدة ذاتياً؛ تُنشأ حسابات الموظفين من داخل الإدارة فقط.
            </p>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onBackToSite}
              className="text-xs font-semibold text-[#556660] hover:text-[#0F332B] transition-colors"
            >
              العودة إلى واجهة العملاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== GATE: LOCKOUT / AUTHORIZATION CHECK ====================
  if (isAccountLocked && staffProfile?.lockedUntil) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-red-200 p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-700">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#0F332B]">
            تم قفل الحساب مؤقتاً (15 دقيقة)
          </h1>
          <p className="text-sm text-[#556660] leading-relaxed">
            تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). الوقت المتبقي لفك القفل التلقائي:{' '}
            <strong className="text-red-700">
              {formatRemainingLockout(staffProfile.lockedUntil - nowMs)}
            </strong>
            . يمكنك أيضاً التواصل مع المدير العام لإعادة التعيين.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0F332B]"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // ==================== GATE 1: MANDATORY INITIAL PASSWORD CHANGE ====================
  if (needsPasswordChange) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E6DCCA] p-7 sm:p-9 space-y-6 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0F332B] text-[#E8C97E] flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="font-display text-xl font-extrabold text-[#0F332B]">
              تغيير كلمة المرور الإجباري
            </h1>
            <p className="text-xs text-[#556660] leading-relaxed">
              مرحباً <strong>{staffProfile?.name}</strong>. لأمان النظام، يجب استبدال كلمة المرور المؤقتة بكلمة مرور شخصية قوية قبل المتابعة.
            </p>
          </div>

          {passwordChangeError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
              {passwordChangeError}
            </div>
          )}

          <form onSubmit={handleMandatoryPasswordChange} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">كلمة المرور الجديدة *</label>
              <div className="relative">
                <input
                  type={showNewPasswords ? 'text' : 'password'}
                  dir="ltr"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPasswords((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A74]"
                >
                  {showNewPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F332B]">تأكيد كلمة المرور الجديدة *</label>
              <input
                type={showNewPasswords ? 'text' : 'password'}
                dir="ltr"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-sm font-mono text-left"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-[11px] text-[#556660] space-y-1">
              <p className="font-bold text-[#0F332B]">متطلبات كلمة المرور القوية:</p>
              <p>• 8 خانات على الأقل · حرف كبير (A-Z) · حرف صغير (a-z) · رقم (0-9) · رمز خاص (!@#$%)</p>
            </div>

            <button
              type="submit"
              disabled={savingNewPassword}
              className="w-full py-3 px-4 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {savingNewPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ كلمة المرور والانتقال للتحقق الثنائي (2FA)
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold text-[#556660] hover:text-red-700"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== GATE 2: MANDATORY 2FA ENROLLMENT ====================
  if (needs2faEnrollment) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E6DCCA] p-7 sm:p-9 space-y-5 shadow-sm text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0F332B] text-[#E8C97E] flex items-center justify-center">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-xl font-extrabold text-[#0F332B]">
              تفعيل المصادقة الثنائية الإلزامية (2FA)
            </h1>
            <p className="text-xs text-[#556660] leading-relaxed">
              امسح رمز QR باستخدام تطبيق <strong>Google Authenticator</strong> أو{' '}
              <strong>Microsoft Authenticator</strong> على هاتفك، ثم أدخل الرمز ذو الـ 6 أرقام لتأكيد الربط.
            </p>
          </div>

          {enrollError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
              {enrollError}
            </div>
          )}

          {enrollQrUrl ? (
            <div className="flex justify-center">
              <img
                src={enrollQrUrl}
                alt="QR Code لتطبيق المصادقة الثنائية"
                className="w-44 h-44 rounded-xl border border-[#E6DCCA] p-1.5 bg-white"
              />
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#0E6E73]" />
            </div>
          )}

          {enrollSecret && (
            <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] flex items-center justify-between gap-2 text-xs">
              <span dir="ltr" className="font-mono font-bold text-[#0F332B] truncate">
                {enrollSecret}
              </span>
              <button
                type="button"
                onClick={() => handleCopyText(enrollSecret, 'المفتاح السري')}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#E6DCCA] text-[11px] font-bold shrink-0"
              >
                نسخ المفتاح
              </button>
            </div>
          )}

          <form onSubmit={handleComplete2faEnrollment} className="space-y-4">
            <div className="space-y-1 text-right">
              <label className="text-xs font-bold text-[#0F332B]">
                أدخل رمز التحقق ذو الـ 6 أرقام *
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                dir="ltr"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-center font-mono text-2xl font-extrabold tracking-[0.35em]"
              />
            </div>

            <button
              type="submit"
              disabled={savingEnroll || enrollCode.length !== 6}
              className="w-full py-3 px-4 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {savingEnroll && <Loader2 className="w-4 h-4 animate-spin" />}
              تأكيد الربط والدخول للوحة التحكم
            </button>
          </form>

          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-semibold text-[#556660] hover:text-red-700"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // ==================== GATE 3: LOGIN 2FA VERIFICATION CHALLENGE ====================
  if (requires2faLoginChallenge) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E6DCCA] p-7 sm:p-9 space-y-5 shadow-sm text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0F332B] text-[#E8C97E] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-xl font-extrabold text-[#0F332B]">
              التحقق بخطوتين (2FA)
            </h1>
            <p className="text-xs text-[#556660] leading-relaxed">
              أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة لحساب{' '}
              <strong dir="ltr" className="font-mono text-[#0F332B]">
                {user.email}
              </strong>
              .
            </p>
          </div>

          {totpError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
              {totpError}
            </div>
          )}

          <form onSubmit={handleVerify2faChallenge} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              dir="ltr"
              value={totpInput}
              onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3.5 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-center font-mono text-2xl font-extrabold tracking-[0.35em]"
            />

            <button
              type="submit"
              disabled={verifyingTotp || totpInput.length !== 6}
              className="w-full py-3 px-4 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {verifyingTotp && <Loader2 className="w-4 h-4 animate-spin" />}
              تحقق ودخول
            </button>
          </form>

          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-semibold text-[#556660] hover:text-red-700"
          >
            تسجيل الخروج والعودة
          </button>
        </div>
      </div>
    );
  }

  // ==================== FALLBACK AUTHORIZATION BLOCK ====================
  if (!isBootstrappedOwner && (!isPasswordStaff || !staffProfile?.active)) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-red-200 p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-700">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#0F332B]">
            تم رفض الدخول — غير مصرح
          </h1>
          <p className="text-sm text-[#556660] leading-relaxed">
            الحساب <strong dir="ltr" className="font-mono text-xs">{user.email}</strong> لا يملك صلاحية دخول نشطة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0F332B]"
            >
              تسجيل الخروج
            </button>
            <button
              type="button"
              onClick={onBackToSite}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0F332B] bg-[#FAF7F0] border border-[#E6DCCA]"
            >
              العودة للموقع
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== AUTHORIZED WORKSPACE NAVIGATION ====================
  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    allowed: boolean;
    count?: number;
  }> = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, allowed: true },
    {
      id: 'bookings',
      label: 'الحجوزات والعملاء',
      icon: ClipboardList,
      allowed: effectivePermissions.manageBookings,
      count: bookings.filter((b) => b.status === 'pending_review').length,
    },
    {
      id: 'financials',
      label: 'التقارير المالية',
      icon: Wallet,
      allowed: effectivePermissions.manageBookings,
    },
    {
      id: 'packages',
      label: 'الباقات والتصنيفات',
      icon: Package,
      allowed: effectivePermissions.managePackages,
      count: packages.length,
    },
    {
      id: 'posters',
      label: 'إعلانات الموسم',
      icon: ImageIcon,
      allowed: effectivePermissions.manageSettings || effectivePermissions.managePackages,
      count: posters.length,
    },
    {
      id: 'forms',
      label: 'منشئ الاستمارات',
      icon: FileSpreadsheet,
      allowed: effectivePermissions.manageForms,
      count: forms.length,
    },
    {
      id: 'settings',
      label: 'إعدادات الهوية والنظام',
      icon: Settings,
      allowed: effectivePermissions.manageSettings,
    },
    {
      id: 'staff',
      label: 'الموظفون والأمان (2FA)',
      icon: Users,
      allowed: isBootstrappedOwner,
      count: staffList.filter((s) => s.email.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL).length,
    },
    {
      id: 'audit',
      label: 'سجل المراقبة والنشاط',
      icon: History,
      allowed: isBootstrappedOwner,
    },
  ];

  const currentTabMeta = navItems.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex">
      {/* Desktop & Mobile Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-40 h-screen w-64 text-white flex flex-col transition-transform duration-200 no-print ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
          <BrandLogo settings={settings} size="sm" showWordmark inverted />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-white/75 hover:bg-white/10"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems
            .filter((item) => item.allowed)
            .map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#E8C97E] text-[#0F332B] font-bold'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        active ? 'text-[#0F332B]' : 'text-[#E8C97E]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Signed-in Staff Info & Actions */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-2 space-y-0.5">
            <p className="text-xs font-bold text-white truncate">
              {staffProfile?.name || user.displayName || 'المدير العام'}
            </p>
            <p className="text-[11px] text-[#E8C97E]">
              {isBootstrappedOwner
                ? 'المالك العام (Super Admin)'
                : staffProfile
                ? STAFF_ROLE_LABELS[staffProfile.role]
                : 'موظف'}
            </p>
            <p className="text-[11px] font-mono text-white/60 truncate">{user.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToSite}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              واجهة العملاء
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-lg bg-white/10 hover:bg-red-500/30 text-white transition-colors"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Admin Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#E6DCCA] px-4 sm:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#0F332B] hover:bg-[#FAF7F0]"
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-[#6B7A74] truncate">
              <span>لوحة التحكم</span>
              <span className="mx-2">/</span>
              <strong className="text-[#0F332B] font-display">
                {currentTabMeta?.label || 'نظرة عامة'}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshAll}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-[#0F332B] bg-[#FAF7F0] border border-[#E6DCCA] hover:bg-[#EFE7D8] transition-colors whitespace-nowrap"
            >
              {loadingData ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5 text-[#0E6E73]" />
              )}
              تحديث البيانات
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main
          className={`flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto ${
            packageManifestTargetId ? 'no-print' : ''
          }`}
        >
          {activeTab === 'overview' && (
            <AdminOverview
              packages={packages}
              bookings={bookings}
              forms={forms}
              permissions={effectivePermissions}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'packages' && effectivePermissions.managePackages && (
            <PackagesManager
              packages={packages}
              categories={categories}
              forms={forms}
              onRefresh={refreshAll}
              onExportManifest={
                effectivePermissions.manageBookings
                  ? (pkg) => setPackageManifestTargetId(pkg.id)
                  : undefined
              }
            />
          )}

          {activeTab === 'posters' &&
            (effectivePermissions.manageSettings || effectivePermissions.managePackages) && (
              <PostersManager posters={posters} onRefresh={refreshAll} />
            )}

          {activeTab === 'forms' && effectivePermissions.manageForms && (
            <FormBuilderManager
              forms={forms}
              packages={packages}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'bookings' && effectivePermissions.manageBookings && (
            <BookingsManager
              bookings={bookings}
              packages={packages}
              forms={forms}
              settings={settings}
              isSuperAdmin={isBootstrappedOwner || staffProfile?.role === 'super_admin'}
              currentUserEmail={user.email || undefined}
              actor={currentActor}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'financials' && effectivePermissions.manageBookings && (
            <FinancialDashboard
              bookings={bookings}
              packages={packages}
              settings={settings}
              currentUserEmail={user.email || undefined}
              actor={currentActor}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'settings' && effectivePermissions.manageSettings && (
            <SettingsManager
              settings={settings}
              onSaved={(updated) => {
                onSettingsUpdated(updated);
                onPublicDataChanged();
              }}
            />
          )}

          {activeTab === 'staff' && isBootstrappedOwner && (
            <StaffManager
              staffList={staffList}
              ownerProfile={staffProfile}
              actor={currentActor}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'audit' && isBootstrappedOwner && (
            <AuditLogViewer
              logs={auditLogs}
              staffList={staffList}
              loading={loadingAuditLogs}
              onRefresh={refreshAuditLogsOnly}
            />
          )}
        </main>
      </div>

      {packageManifestTargetId && (
        <ManifestExportModal
          allBookings={bookings}
          filteredBookings={bookings.filter((b) => b.packageId === packageManifestTargetId)}
          selectedBookings={[]}
          packages={packages}
          forms={forms}
          settings={settings}
          initialPackageId={packageManifestTargetId}
          actor={currentActor}
          onClose={() => setPackageManifestTargetId(null)}
        />
      )}
    </div>
  );
};
