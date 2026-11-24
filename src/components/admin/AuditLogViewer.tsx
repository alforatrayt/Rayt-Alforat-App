import React, { useMemo, useState } from 'react';
import {
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Wallet,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AUDIT_ACTION_LABELS,
  STAFF_ROLE_LABELS,
  type AuditLog,
  type AuditLogAction,
  type StaffMember,
  type StaffRole,
} from '../../types';
import { formatFirestoreDate } from '../../utils/exportUtils';

interface AuditLogViewerProps {
  logs: AuditLog[];
  staffList: StaffMember[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

function formatLogTimestamp(val: AuditLog['createdAt']): string {
  if (!val) return 'الآن';
  if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
    return val.toDate().toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (val instanceof Date) {
    return val.toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return formatFirestoreDate(val);
}

function getActionTone(action: AuditLogAction): {
  text: string;
  bg: string;
  border: string;
  Icon: React.FC<{ className?: string }>;
} {
  if (
    action === 'login_locked' ||
    action === 'staff_frozen' ||
    action === 'staff_deleted' ||
    action === 'booking_deleted' ||
    action === 'payment_removed'
  ) {
    return {
      text: 'text-red-800',
      bg: 'bg-red-50',
      border: 'border-red-200',
      Icon: AlertTriangle,
    };
  }
  if (
    action === 'payment_added' ||
    action === 'bus_assigned' ||
    action === 'booking_status_updated'
  ) {
    return {
      text: 'text-[#0E6E73]',
      bg: 'bg-[#0E6E73]/10',
      border: 'border-[#0E6E73]/30',
      Icon: Wallet,
    };
  }
  if (action === 'manifest_exported' || action === 'financial_report_exported') {
    return {
      text: 'text-[#8C6D2E]',
      bg: 'bg-[#B88E3E]/10',
      border: 'border-[#B88E3E]/30',
      Icon: FileSpreadsheet,
    };
  }
  if (action === 'login_success' || action === 'staff_activated') {
    return {
      text: 'text-emerald-800',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      Icon: UserCheck,
    };
  }
  return {
    text: 'text-[#0F332B]',
    bg: 'bg-[#FAF7F0]',
    border: 'border-[#E6DCCA]',
    Icon: ShieldCheck,
  };
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs,
  staffList,
  loading,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | AuditLogAction>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    staffList.forEach((s) => map.set(s.email.toLowerCase(), s.name));
    logs.forEach((l) => {
      const em = (l.actorEmail || '').toLowerCase();
      if (em && !map.has(em)) {
        map.set(em, l.actorName || em);
      }
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [logs, staffList]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (actorFilter !== 'all' && (log.actorEmail || '').toLowerCase() !== actorFilter) {
        return false;
      }
      if (q) {
        const hay = `${log.actorName} ${log.actorEmail} ${log.summary} ${log.details} ${log.targetId} ${
          AUDIT_ACTION_LABELS[log.action] || log.action
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, actionFilter, actorFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0F332B] flex items-center gap-2.5">
            <History className="w-6 h-6 text-[#0E6E73]" />
            سجل المراقبة والنشاط الأمني (Audit Log)
          </h1>
          <p className="text-sm text-[#556660] mt-1">
            متابعة حصرية للمالك العام لجميع العمليات الحساسة: تسجيلات الدخول، التعديلات المالية، حالات الحجوزات، وتصدير الكشوفات.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-[#E6DCCA] text-[#0F332B] hover:bg-[#FAF7F0] disabled:opacity-60 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#0E6E73]" />
          ) : (
            <RefreshCw className="w-4 h-4 text-[#0E6E73]" />
          )}
          تحديث السجل
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7A74] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الموظف، المرجع، أو تفاصيل العملية..."
            className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as 'all' | AuditLogAction)}
          className="px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
        >
          <option value="all">جميع أنواع العمليات ({logs.length})</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#E6DCCA] text-xs font-semibold text-[#0F332B]"
        >
          <option value="all">جميع الموظفين والمشرفين</option>
          {uniqueActors.map((actor) => (
            <option key={actor.email} value={actor.email}>
              {actor.name} ({actor.email})
            </option>
          ))}
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-[#E6DCCA] overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 flex items-center justify-center gap-2 text-sm text-[#556660]">
            <Loader2 className="w-5 h-5 animate-spin text-[#0E6E73]" />
            جارٍ تحميل سجل المراقبة...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#556660]">
            لا توجد سجلات مطابقة لمعايير التصفية الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#FAF7F0] text-xs text-[#556660] border-b border-[#E6DCCA]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">التوقيت</th>
                  <th className="py-3.5 px-4 font-semibold">الموظف / المنفّذ</th>
                  <th className="py-3.5 px-4 font-semibold">نوع العملية</th>
                  <th className="py-3.5 px-4 font-semibold">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DC]">
                {filteredLogs.map((log) => {
                  const tone = getActionTone(log.action);
                  const Icon = tone.Icon;
                  const roleLabel =
                    STAFF_ROLE_LABELS[log.actorRole as StaffRole] || log.actorRole;

                  return (
                    <tr key={log.id} className="hover:bg-[#FAF7F0]/50 transition-colors align-top">
                      <td className="py-3.5 px-4 text-xs text-[#556660] whitespace-nowrap tabular-nums">
                        {formatLogTimestamp(log.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#0F332B] text-xs">{log.actorName}</p>
                        <p dir="ltr" className="font-mono text-[11px] text-[#6B7A74] text-right">
                          {log.actorEmail}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#FAF7F0] border border-[#E6DCCA] text-[10px] font-semibold text-[#556660]">
                          {roleLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${tone.bg} ${tone.text} ${tone.border}`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {AUDIT_ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#142621] space-y-1 max-w-md">
                        <p className="font-semibold text-[#0F332B]">{log.summary}</p>
                        {log.details && (
                          <p className="text-[11px] text-[#556660] leading-relaxed">{log.details}</p>
                        )}
                        {log.targetId && (
                          <p className="text-[11px] font-mono text-[#6B7A74]" dir="ltr">
                            #{log.targetId}
                          </p>
                        )}
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
  );
};
