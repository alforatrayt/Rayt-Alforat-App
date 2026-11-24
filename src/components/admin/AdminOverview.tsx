import React from 'react';
import {
  ClipboardList,
  Clock,
  Wallet,
  Package,
  ArrowLeft,
} from 'lucide-react';
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  type FormTemplate,
  type StaffPermissions,
  type TravelPackage,
} from '../../types';
import { formatFirestoreDate } from '../../utils/exportUtils';
import { computeBookingFinancialTotals } from '../../services/firestoreService';
import type { AdminTab } from './AdminDashboard';

interface AdminOverviewProps {
  packages: TravelPackage[];
  bookings: Booking[];
  forms: FormTemplate[];
  permissions: StaffPermissions;
  onNavigateTab: (tab: AdminTab) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  packages,
  bookings,
  forms,
  permissions,
  onNavigateTab,
}) => {
  const pendingCount = bookings.filter((b) => b.status === 'pending_review').length;
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const totalCollected = activeBookings.reduce((sum, b) => {
    const fin = computeBookingFinancialTotals(b.totalPrice, b.payments || []);
    const paid = (b.payments?.length || 0) > 0 ? fin.paidAmount : b.paidAmount || 0;
    return sum + paid;
  }, 0);
  const totalExpected = activeBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const visiblePackages = packages.filter((p) => p.visible).length;

  const kpis = [
    {
      label: 'إجمالي الحجوزات',
      value: bookings.length.toLocaleString('ar-SA'),
      sub: `${bookings.filter((b) => b.status === 'confirmed').length} مؤكد`,
      icon: ClipboardList,
    },
    {
      label: 'بانتظار المراجعة',
      value: pendingCount.toLocaleString('ar-SA'),
      sub: 'تحتاج متابعة الفريق',
      icon: Clock,
    },
    {
      label: 'المبالغ المحصّلة فعلياً',
      value: `${totalCollected.toLocaleString('ar-SA')} ريال`,
      sub: `من أصل ${totalExpected.toLocaleString('ar-SA')} ريال مطلوبة`,
      icon: Wallet,
    },
    {
      label: 'الباقات النشطة',
      value: `${visiblePackages} / ${packages.length}`,
      sub: `${forms.length} استمارات ديناميكية`,
      icon: Package,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B]">
            ملخص الأداء والعمليات
          </h1>
          <p className="text-sm text-[#556660]">
            نظرة فورية على الحجوزات الواردة، التحصيل المالي، الباقات السياحية، والنماذج النشطة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {permissions.managePackages && (
            <button
              type="button"
              onClick={() => onNavigateTab('packages')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              الباقات والتصنيفات
            </button>
          )}
          {permissions.manageBookings && (
            <button
              type="button"
              onClick={() => onNavigateTab('financials')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0E6E73] bg-white border border-[#0E6E73] hover:bg-[#FAF7F0]"
            >
              التقارير المالية
            </button>
          )}
          {(permissions.manageSettings || permissions.managePackages) && (
            <button
              type="button"
              onClick={() => onNavigateTab('posters')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F332B] bg-white border border-[#E6DCCA] hover:bg-[#FAF7F0]"
            >
              إعلانات الموسم
            </button>
          )}
          {permissions.manageForms && (
            <button
              type="button"
              onClick={() => onNavigateTab('forms')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F332B] bg-white border border-[#E6DCCA] hover:bg-[#FAF7F0]"
            >
              منشئ الاستمارات
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl border border-[#E6DCCA] p-5 space-y-2"
            >
              <div className="flex items-center justify-between text-[#556660]">
                <span className="text-xs font-medium">{kpi.label}</span>
                <Icon className="w-4 h-4 text-[#B88E3E]" />
              </div>
              <p className="font-display text-2xl font-extrabold text-[#0F332B] tabular-nums">
                {kpi.value}
              </p>
              <p className="text-xs text-[#6B7A74]">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Bookings Table */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0E9DC] flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-[#0F332B]">
            أحدث الحجوزات الواردة
          </h2>
          {permissions.manageBookings && (
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6E73] hover:text-[#0F332B]"
            >
              عرض كل الحجوزات
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {bookings.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#556660]">
            لا توجد حجوزات مسجلة حتى الآن. ستظهر الحجوزات الجديدة هنا فور إرسالها من واجهة العملاء.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                <tr>
                  <th className="py-3 px-4 font-semibold">المرجع</th>
                  <th className="py-3 px-4 font-semibold">العميل</th>
                  <th className="py-3 px-4 font-semibold">الباقة</th>
                  <th className="py-3 px-4 font-semibold">المسافرون</th>
                  <th className="py-3 px-4 font-semibold">الإجمالي</th>
                  <th className="py-3 px-4 font-semibold">الحالة</th>
                  <th className="py-3 px-4 font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DC]">
                {bookings.slice(0, 6).map((b) => (
                  <tr key={b.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-[#0F332B] tabular-nums">
                      {b.bookingRef}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#142621]">{b.customerName}</p>
                      <p className="text-xs font-mono text-[#6B7A74] tabular-nums" dir="ltr">
                        {b.customerPhone}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-[#374B45]">{b.packageTitle}</td>
                    <td className="py-3 px-4 tabular-nums">
                      {b.adultsCount + b.childrenCount + b.infantsCount}
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {b.totalPrice.toLocaleString('ar-SA')} {b.currency}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-[#0E6E73]">
                      {BOOKING_STATUS_LABELS[b.status]}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#6B7A74]">
                      {formatFirestoreDate(b.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
