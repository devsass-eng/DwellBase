import { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, Activity, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';
import type { SuperAdminAuditLog } from '../api/client';

const SuperAdminAuditLogs = () => {
  const [logs, setLogs] = useState<SuperAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const data = await superAdminApi.getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      (l.landlord_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.super_admin_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.notes && l.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.action || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_LANDLORD':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">CREATE_LANDLORD</span>;
      case 'APPROVE_PAYMENT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">APPROVE_PAYMENT</span>;
      case 'RECORD_PAYMENT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">RECORD_PAYMENT</span>;
      case 'REJECT_PAYMENT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">REJECT_PAYMENT</span>;
      case 'REVERSE_PAYMENT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">REVERSE_PAYMENT</span>;
      case 'ACTIVATE_ACCOUNT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVATE_ACCOUNT</span>;
      case 'SUSPEND_ACCOUNT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">SUSPEND_ACCOUNT</span>;
      case 'REACTIVATE_ACCOUNT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">REACTIVATE_ACCOUNT</span>;
      case 'RESET_ACCESS':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">RESET_ACCESS</span>;
      case 'EDIT_LANDLORD':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">EDIT_LANDLORD</span>;
      case 'UPDATE_SETTINGS':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">UPDATE_SETTINGS</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">{action}</span>;
    }
  };

  return (
    <DashboardLayout userType="super_admin" userName="Admin">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-navy-900 text-teal-400 rounded-xl shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Platform Audit Logs</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Immutable system audit trail of all landlord account operations, one-time payment approvals, suspensions, reactivations, and credential resets.
          </p>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by actor, landlord name, action, or memo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE_LANDLORD">CREATE_LANDLORD</option>
              <option value="APPROVE_PAYMENT">APPROVE_PAYMENT</option>
              <option value="RECORD_PAYMENT">RECORD_PAYMENT</option>
              <option value="REJECT_PAYMENT">REJECT_PAYMENT</option>
              <option value="REVERSE_PAYMENT">REVERSE_PAYMENT</option>
              <option value="ACTIVATE_ACCOUNT">ACTIVATE_ACCOUNT</option>
              <option value="SUSPEND_ACCOUNT">SUSPEND_ACCOUNT</option>
              <option value="REACTIVATE_ACCOUNT">REACTIVATE_ACCOUNT</option>
              <option value="RESET_ACCESS">RESET_ACCESS</option>
              <option value="EDIT_LANDLORD">EDIT_LANDLORD</option>
              <option value="UPDATE_SETTINGS">UPDATE_SETTINGS</option>
            </select>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">Loading audit trail...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <Activity className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              No audit logs match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Subject / Landlord</th>
                    <th className="py-3 px-4">Administrative Memo / Details</th>
                    <th className="py-3 px-4">Admin Actor</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">{getActionBadge(log.action)}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {log.landlord_name || 'System'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">{log.notes || 'Administrative action performed'}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{log.super_admin_name}</td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminAuditLogs;
