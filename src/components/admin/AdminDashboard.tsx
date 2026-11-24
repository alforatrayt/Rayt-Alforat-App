import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  ClipboardList,
  Settings,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Loader2,
  Lock,
  Database,
  Menu,
  X,
  Image as ImageIcon,
  Wallet,
} from 'lucide-react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';
import {
  ROLE_PRESET_PERMISSIONS,
  STAFF_ROLE_LABELS,
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
  fetchStaffProfileByEmail,
  seedInitialAgencyDataIfEmpty,
} from '../../services/firestoreService';
import { BrandLogo } from '../BrandLogo';
import { useToast } from '../ToastProvider';
import { AdminOverview } from './AdminOverview';
import { PackagesManager } from './PackagesManager';
import { FormBuilderManager } from './FormBuilderManager';
import { BookingsManager } from './BookingsManager';
import { PostersManager } from './PostersManager';
import { SettingsManager } from './SettingsManager';
import { StaffManager } from './StaffManager';
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
  | 'staff';

interface AdminDashboardProps {
  user: User | null;
  authReady: boolean;
  settings: SiteSettings;
  initialTab?: AdminTab;
  onSettingsUpdated: (next: SiteSettings) => void;
  onPublicDataChanged: () => void;
  onBackToSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  authReady,
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

  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [categories, setCategories] = useState<PackageCategory[]>([]);
  const [posters, setPosters] = useState<SeasonPoster[]>([]);
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [packageManifestTargetId, setPackageManifestTargetId] = useState<string | null>(null);

  const isBootstrappedOwner =
    Boolean(user?.email && user.emailVerified && user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL);

  const effectivePermissions: StaffPermissions = isBootstrappedOwner
    ? ROLE_PRESET_PERMISSIONS.super_admin
    : staffProfile?.active
    ? staffProfile.permissions
    : {
        managePackages: false,
        manageForms: false,
        manageBookings: false,
        manageSettings: false,
        manageStaff: false,
      };

  const isAuthorizedStaff =
    isBootstrappedOwner || Boolean(staffProfile && staffProfile.active);

  const loadAdminWorkspace = async (
    perms: StaffPermissions,
    canSeed: boolean,
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

      const [pkgsRes, catsRes, postersRes, formsRes, bookingsRes, staffRes] = await Promise.all([
        fetchAllPackagesAdmin(),
        fetchAllCategoriesAdmin(),
        perms.manageSettings || perms.managePackages
          ? fetchAllSeasonPostersAdmin()
          : Promise.resolve([]),
        fetchAllFormTemplatesAdmin(),
        fetchAllBookingsAdmin(),
        perms.manageStaff ? fetchAllStaffAdmin() : Promise.resolve([]),
      ]);

      setPackages(pkgsRes);
      setCategories(catsRes);
      setPosters(postersRes);
      setForms(formsRes);
      setBookings(bookingsRes);
      setStaffList(staffRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Missing or insufficient permissions') || msg.includes('permission-denied')) {
        setStaffProfile(null);
        showToast('انتهت صلاحية الدخول لهذا الحساب. يُرجى تسجيل الدخول بحساب الإدارة المعتمد.', 'info');
      } else {
        console.error(err);
        showToast('تعذر تحميل بعض بيانات لوحة التحكم.', 'error');
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    let active = true;
    const resolveAccess = async () => {
      if (!authReady) return;
      if (!user || !user.email || !user.emailVerified) {
        setStaffProfile(null);
        setCheckingAccess(false);
        return;
      }

      setCheckingAccess(true);
      try {
        const emailLower = user.email.toLowerCase();
        const ownerMatch = emailLower === BOOTSTRAPPED_ADMIN_EMAIL;
        let docProfile: StaffMember | null = null;
        try {
          docProfile = await fetchStaffProfileByEmail(emailLower);
        } catch {
          docProfile = null;
        }

        if (!active) return;
        setStaffProfile(docProfile);
        setCheckingAccess(false);

        if (ownerMatch || (docProfile && docProfile.active)) {
          const perms = ownerMatch
            ? ROLE_PRESET_PERMISSIONS.super_admin
            : docProfile!.permissions;
          await loadAdminWorkspace(perms, ownerMatch, emailLower);
        }
      } catch {
        if (active) setCheckingAccess(false);
      }
    };

    resolveAccess();
    return () => {
      active = false;
    };
  }, [user, authReady]);

  const [authNotice, setAuthNotice] = useState<string>('');

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthNotice('');
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('تم تسجيل الدخول بنجاح', 'success');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        const msg =
          'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية. اضغط على زر الدخول مجدداً لإكمال المصادقة، وتأكد من السماح بالنوافذ المنبثقة في المتصفح.';
        setAuthNotice(msg);
        showToast('تم إلغاء نافذة تسجيل الدخول — يمكنك المحاولة مجدداً.', 'info');
      } else if (code === 'auth/popup-blocked') {
        const msg =
          'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. يُرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مرة أخرى.';
        setAuthNotice(msg);
        showToast(msg, 'error');
      } else if (code === 'auth/network-request-failed') {
        const msg = 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت وحاول مجدداً.';
        setAuthNotice(msg);
        showToast(msg, 'error');
      } else {
        const msg = 'تعذر إكمال تسجيل الدخول عبر Google. يُرجى المحاولة مرة أخرى.';
        setAuthNotice(msg);
        showToast(msg, 'error');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  };

  const handleSwitchAccount = async () => {
    await signOut(auth);
    await handleGoogleSignIn();
  };

  const refreshAll = async () => {
    await loadAdminWorkspace(effectivePermissions, false, user?.email?.toLowerCase());
    onPublicDataChanged();
  };

  // Loading auth state
  if (!authReady || checkingAccess) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-[#0F332B]">
          <Loader2 className="w-8 h-8 animate-spin text-[#0E6E73]" />
          <p className="text-sm font-medium">جارٍ التحقق من صلاحيات الدخول...</p>
        </div>
      </div>
    );
  }

  // Sign-In Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E6DCCA] p-8 sm:p-10 text-center space-y-6">
          <div className="flex justify-center">
            <BrandLogo settings={settings} size="lg" showWordmark />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
              لوحة تحكم المشرفين
            </h1>
            <p className="text-sm text-[#556660] leading-relaxed">
              سجّل دخولك بحساب Google المعتمد لإدارة الباقات السياحية، منشئ الاستمارات الديناميكي، حجوزات العملاء، وإعدادات الهوية.
            </p>
          </div>

          {authNotice && (
            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-[#B88E3E]/50 text-xs text-[#0F332B] leading-relaxed text-right">
              {authNotice}
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-5 rounded-xl font-display font-bold text-sm text-white flex items-center justify-center gap-2.5 transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {signingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 text-[#E8C97E]" />
            )}
            تسجيل الدخول عبر Google
          </button>

          <button
            type="button"
            onClick={onBackToSite}
            className="text-sm font-medium text-[#556660] hover:text-[#0F332B] transition-colors"
          >
            العودة إلى واجهة العملاء
          </button>
        </div>
      </div>
    );
  }

  // Signed in but not authorized staff
  if (!isAuthorizedStaff) {
    return (
      <div className="min-h-screen bg-[#F8F4EC] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E6DCCA] p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-700">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#0F332B]">
            الحساب غير مُصرَّح له بالدخول
          </h1>
          <p className="text-sm text-[#556660] leading-relaxed">
            الحساب <strong className="font-mono text-xs">{user.email}</strong> غير مدرج حالياً ضمن قائمة مشرفي وموظفي {settings.agencyName}. يُرجى تسجيل الدخول بحساب الإدارة المعتمد (<strong className="font-mono text-xs">{BOOTSTRAPPED_ADMIN_EMAIL}</strong>) أو الطلب من المدير العام إضافتك من قسم إدارة الصلاحيات.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              disabled={signingIn}
              onClick={handleSwitchAccount}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0F332B] hover:opacity-90 disabled:opacity-60"
            >
              تبديل الحساب والدخول بحساب آخر
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
      label: 'الصلاحيات والمشرفون',
      icon: ShieldCheck,
      allowed: effectivePermissions.manageStaff,
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
                ? 'مدير عام'
                : staffProfile
                ? STAFF_ROLE_LABELS[staffProfile.role]
                : 'مشرف'}
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
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'financials' && effectivePermissions.manageBookings && (
            <FinancialDashboard
              bookings={bookings}
              packages={packages}
              settings={settings}
              currentUserEmail={user.email || undefined}
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

          {activeTab === 'staff' && effectivePermissions.manageStaff && (
            <StaffManager
              staffList={staffList}
              onRefresh={refreshAll}
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
          onClose={() => setPackageManifestTargetId(null)}
        />
      )}
    </div>
  );
};
