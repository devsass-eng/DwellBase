import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, UserPlus, Search, Filter, 
  Eye, Edit3, CheckCircle2, 
  UserX, KeyRound, History, AlertTriangle, 
  Phone, Mail, Check, X, Loader2, Copy, 
  ArrowUpDown, Home, Users as UsersIcon,
  RotateCcw
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi } from '../api/client';
import type { SuperAdminLandlord, SuperAdminAuditLog, OneTimePaymentRecord } from '../api/client';
import { useNotifications } from '../context/NotificationContext';

const SuperAdminLandlords = () => {
  const [landlords, setLandlords] = useState<SuperAdminLandlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'code'>('createdAt');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [selectedLandlord, setSelectedLandlord] = useState<SuperAdminLandlord | null>(null);
  const [detailedLandlordData, setDetailedLandlordData] = useState<{
    landlord: SuperAdminLandlord;
    rooms: unknown[];
    tenants: unknown[];
    payments: OneTimePaymentRecord[];
    history: SuperAdminAuditLog[];
    activationTokens: { id: string; raw_token: string; expires_at: string; used_at: string | null; created_at: string }[];
  } | null>(null);

  const [activeModal, setActiveModal] = useState<
    'view' | 'edit' | 'activate' | 'suspend' | 'reactivate' | 'resetAccess' | 'history' | null
  >(null);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Form states
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    propertyName: '',
    propertyAddress: '',
    notes: '',
  });

  const [activateNotes, setActivateNotes] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendNotes, setSuspendNotes] = useState('');
  const [reactivateNotes, setReactivateNotes] = useState('');
  const [resetTempPassword, setResetTempPassword] = useState('');
  const [resetNotes, setResetNotes] = useState('');
  const [resetResultData, setResetResultData] = useState<{
    activationLink?: string;
    token?: string;
    temporaryPassword?: string | null;
    expiresAt?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [landlordHistory, setLandlordHistory] = useState<SuperAdminAuditLog[]>([]);

  const { addNotification } = useNotifications();

  const fetchLandlords = async () => {
    try {
      setLoading(true);
      const data = await superAdminApi.getLandlords();
      setLandlords(data);
    } catch (err) {
      console.error('Failed to load landlords:', err);
      addNotification({
        title: 'Error loading landlords',
        message: err instanceof Error ? err.message : 'Could not retrieve landlords list',
        type: 'error',
        recipientType: 'landlord',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLandlords();
  }, []);

  const handleOpenViewModal = async (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setModalLoading(true);
    setActiveModal('view');
    try {
      const details = await superAdminApi.getLandlord(landlord.id);
      setDetailedLandlordData(details);
    } catch (err) {
      console.error(err);
      setModalError('Failed to load full landlord details');
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenEditModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setEditFormData({
      fullName: landlord.full_name,
      email: landlord.email,
      phone: landlord.phone || '',
      propertyName: landlord.property_name || '',
      propertyAddress: landlord.property_address || '',
      notes: '',
    });
    setModalError('');
    setModalSuccess('');
    setActiveModal('edit');
  };

  const handleOpenActivateModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setActivateNotes('');
    setModalError('');
    setModalSuccess('');
    setActiveModal('activate');
  };

  const handleOpenSuspendModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setSuspendReason('');
    setSuspendNotes('');
    setModalError('');
    setModalSuccess('');
    setActiveModal('suspend');
  };

  const handleOpenReactivateModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setReactivateNotes('');
    setModalError('');
    setModalSuccess('');
    setActiveModal('reactivate');
  };

  const handleOpenResetAccessModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setResetTempPassword('');
    setResetNotes('');
    setResetResultData(null);
    setCopiedLink(false);
    setModalError('');
    setModalSuccess('');
    setActiveModal('resetAccess');
  };

  const handleOpenHistoryModal = async (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setModalLoading(true);
    setActiveModal('history');
    try {
      const details = await superAdminApi.getLandlord(landlord.id);
      setLandlordHistory(details.history || []);
    } catch (err) {
      console.error(err);
      setModalError('Failed to load audit history');
    } finally {
      setModalLoading(false);
    }
  };

  // Actions
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLandlord) return;
    setModalLoading(true);
    setModalError('');
    try {
      await superAdminApi.updateLandlord(selectedLandlord.id, editFormData);
      addNotification({
        title: 'Landlord Updated',
        message: `Profile updated for ${editFormData.fullName}`,
        type: 'success',
        recipientType: 'landlord',
      });
      setModalSuccess('Landlord updated successfully!');
      await fetchLandlords();
      setTimeout(() => setActiveModal(null), 1200);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update landlord');
    } finally {
      setModalLoading(false);
    }
  };

  const handleActivateSubmit = async () => {
    if (!selectedLandlord) return;
    setModalLoading(true);
    setModalError('');
    try {
      const res = await superAdminApi.activateLandlord(selectedLandlord.id, activateNotes);
      addNotification({
        title: 'Account Activated',
        message: res.message,
        type: 'success',
        recipientType: 'landlord',
      });
      await fetchLandlords();
      if (res.activation) {
        setResetResultData(res.activation);
        setActiveModal('resetAccess');
      } else {
        setActiveModal(null);
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to activate account');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSuspendSubmit = async () => {
    if (!selectedLandlord) return;
    if (!suspendReason.trim()) {
      setModalError('Please state a reason for suspending this account.');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      await superAdminApi.suspendLandlord(selectedLandlord.id, suspendReason.trim(), suspendNotes);
      addNotification({
        title: 'Account Suspended',
        message: `Account for ${selectedLandlord.full_name} suspended. All records remain preserved.`,
        type: 'warning',
        recipientType: 'landlord',
      });
      await fetchLandlords();
      setActiveModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to suspend account');
    } finally {
      setModalLoading(false);
    }
  };

  const handleReactivateSubmit = async () => {
    if (!selectedLandlord) return;
    setModalLoading(true);
    setModalError('');
    try {
      await superAdminApi.reactivateLandlord(selectedLandlord.id, reactivateNotes);
      addNotification({
        title: 'Account Reactivated',
        message: `Access restored for ${selectedLandlord.full_name} with zero additional fee.`,
        type: 'success',
        recipientType: 'landlord',
      });
      await fetchLandlords();
      setActiveModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to reactivate account');
    } finally {
      setModalLoading(false);
    }
  };

  const handleResetAccessSubmit = async () => {
    if (!selectedLandlord) return;
    setModalLoading(true);
    setModalError('');
    try {
      const res = await superAdminApi.resetAccess(selectedLandlord.id, resetTempPassword, resetNotes);
      setResetResultData(res);
      addNotification({
        title: 'Activation Link Generated',
        message: `New single-use access link generated for ${selectedLandlord.full_name}`,
        type: 'info',
        recipientType: 'landlord',
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to generate access credentials');
    } finally {
      setModalLoading(false);
    }
  };

  // Filter & Search
  const filteredLandlords = landlords
    .filter(l => {
      const matchesSearch = 
        l.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.landlord_code && l.landlord_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.phone && l.phone.includes(searchTerm)) ||
        (l.property_name && l.property_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || l.account_status === statusFilter;
      const isPaidMatch = paymentFilter === 'ALL' || 
        (paymentFilter === 'PAID' && l.is_paid) || 
        (paymentFilter === 'UNPAID' && !l.is_paid);

      return matchesSearch && matchesStatus && isPaidMatch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'createdAt') {
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'name') {
        comparison = a.full_name.localeCompare(b.full_name);
      } else if (sortBy === 'code') {
        comparison = (a.landlord_code || '').localeCompare(b.landlord_code || '');
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="space-y-6">
        
        {/* Header & Add Landlord Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-900 text-amber-400 rounded-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Landlords Management</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Supervise, provision, and control all landlord workspaces and one-time payment verification.
            </p>
          </div>

          <Link
            to="/superadmin/add-landlord"
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add Landlord</span>
          </Link>
        </div>

        {/* Search and Filters Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, phone, property, or Landlord ID (e.g. LL-001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Payment">Pending Payment</option>
                <option value="Pending Activation">Pending Activation</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            {/* Payment Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span>Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">Paid (Approved)</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>

            {/* Sort */}
            <button
              onClick={() => {
                if (sortBy === 'createdAt') setSortBy('name');
                else if (sortBy === 'name') setSortBy('code');
                else setSortBy('createdAt');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs hover:bg-slate-100 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort: {sortBy === 'createdAt' ? 'Date Created' : sortBy === 'name' ? 'Name' : 'ID'}</span>
            </button>
          </div>
        </div>

        {/* Landlords Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-3" />
              <p className="text-sm font-medium">Loading landlord accounts...</p>
            </div>
          ) : filteredLandlords.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-700">No landlords found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'ALL' || paymentFilter !== 'ALL'
                  ? 'Try adjusting your search or filters.'
                  : 'Start by provisioning the first landlord account.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Landlord ID &amp; Name</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">One-Time Payment</th>
                    <th className="py-3.5 px-4">Account Status</th>
                    <th className="py-3.5 px-4">Rooms / Tenants</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLandlords.map((l) => {
                    const isPaid = l.is_paid;
                    const payment = l.latest_payment;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* ID & Name */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{l.full_name}</span>
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200">
                              {l.landlord_code || 'LL'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{l.property_name || 'DwellBase Property'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Created: {new Date(l.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-4 px-4">
                          <div className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{l.email}</span>
                          </div>
                          {l.phone && (
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{l.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* One-Time Payment */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isPaid 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : payment?.status === 'pending_verification'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {isPaid ? 'Approved (Paid)' : payment?.status === 'pending_verification' ? 'Pending Approval' : 'Unpaid'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 font-semibold mt-1">
                            Fee: GH₵{l.one_time_fee || 500}
                          </div>
                          {payment?.payment_method && (
                            <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
                              Method: {payment.payment_method === 'cash' ? 'Cash' : 'Direct MoMo'}
                            </div>
                          )}
                        </td>

                        {/* Account Status */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            l.account_status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : l.account_status === 'Suspended'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : l.account_status === 'Pending Activation'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {l.account_status}
                          </span>
                          {l.account_activated_at && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              Activated: {new Date(l.account_activated_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>

                        {/* Property summary */}
                        <td className="py-4 px-4">
                          <div className="text-xs text-slate-700 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Home className="w-3.5 h-3.5 text-slate-400" /> {l.room_count} Rooms
                            </span>
                            <span className="flex items-center gap-1">
                              <UsersIcon className="w-3.5 h-3.5 text-slate-400" /> {l.tenant_count} Tenants
                            </span>
                          </div>
                          <div className="text-[11px] text-teal-600 font-medium mt-1">
                            Permanent Workspace
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenViewModal(l)}
                              title="View Landlord Details"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(l)}
                              title="Edit Landlord Profile"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {l.account_status === 'Suspended' ? (
                              <button
                                onClick={() => handleOpenReactivateModal(l)}
                                title="Reactivate Account (Zero Fee)"
                                className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            ) : l.account_status === 'Active' ? (
                              <button
                                onClick={() => handleOpenSuspendModal(l)}
                                title="Suspend Account"
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenActivateModal(l)}
                                title="Verify Payment & Activate Account"
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenResetAccessModal(l)}
                              title="Generate Single-Use Activation Link / Reset Password"
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenHistoryModal(l)}
                              title="View Administrative Audit History"
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: VIEW LANDLORD DETAILS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'view' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 text-amber-400 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{selectedLandlord.full_name} ({selectedLandlord.landlord_code || 'LL'})</h3>
                  <p className="text-xs text-slate-500">{selectedLandlord.email} &bull; {selectedLandlord.property_name || 'DwellBase Property'}</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {modalLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">Fetching landlord profile details...</p>
                </div>
              ) : (
                <>
                  {/* Account Status & Payment Overview */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Account Status</span>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        selectedLandlord.account_status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedLandlord.account_status === 'Suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {selectedLandlord.account_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">One-Time Fee</span>
                      <div className="font-bold text-slate-800">GH₵{selectedLandlord.one_time_fee || 500} ({selectedLandlord.is_paid ? 'Paid' : 'Unpaid'})</div>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Created Date</span>
                      <div className="font-medium text-slate-700">{new Date(selectedLandlord.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Activation Date</span>
                      <div className="font-semibold text-slate-800">{selectedLandlord.account_activated_at ? new Date(selectedLandlord.account_activated_at).toLocaleDateString() : 'Pending'}</div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspace &amp; Contact Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                      <div><span className="text-slate-400">Phone:</span> <span className="font-medium text-slate-700">{selectedLandlord.phone || 'None provided'}</span></div>
                      <div><span className="text-slate-400">Property Address:</span> <span className="font-medium text-slate-700">{selectedLandlord.property_address || 'None provided'}</span></div>
                      <div><span className="text-slate-400">Total Rooms:</span> <span className="font-semibold text-slate-800">{selectedLandlord.room_count}</span></div>
                      <div><span className="text-slate-400">Total Tenants:</span> <span className="font-semibold text-slate-800">{selectedLandlord.tenant_count}</span></div>
                    </div>
                  </div>

                  {/* One-Time Payment Records */}
                  {detailedLandlordData && detailedLandlordData.payments && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">One-Time Payment Transactions ({detailedLandlordData.payments.length})</h4>
                      <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                        {detailedLandlordData.payments.length === 0 ? (
                          <div className="p-3 text-slate-400 text-center">No payment record registered yet.</div>
                        ) : (
                          detailedLandlordData.payments.map((p) => (
                            <div key={p.id} className="p-3 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 font-mono">{p.payment_id}</span>
                                <span className="text-slate-500 text-[11px] ml-2">GH₵{p.amount} via {p.payment_method === 'cash' ? 'Cash' : 'Direct MoMo'} &bull; {p.date_received}</span>
                                {p.external_reference && <p className="text-[10px] text-slate-400 mt-0.5">Ref: {p.external_reference}</p>}
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : p.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Historical Audit Actions */}
                  {detailedLandlordData && detailedLandlordData.history && detailedLandlordData.history.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Administrative History</h4>
                      <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                        {detailedLandlordData.history.map((h) => (
                          <div key={h.id} className="p-2.5 flex items-start justify-between gap-3">
                            <div>
                              <span className="font-semibold text-slate-800">{h.action}</span>
                              <p className="text-[11px] text-slate-500 mt-0.5">{h.notes || 'Administrative action'}</p>
                            </div>
                            <div className="text-right whitespace-nowrap text-[10px] text-slate-400">
                              <div>{h.super_admin_name}</div>
                              <div>{new Date(h.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">ID: {selectedLandlord.id}</span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: EDIT DETAILS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'edit' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3>Edit Landlord Profile</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              {modalSuccess && <div className="p-3 text-xs bg-emerald-50 text-emerald-700 rounded-lg">{modalSuccess}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Property Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                  value={editFormData.propertyName}
                  onChange={(e) => setEditFormData({ ...editFormData, propertyName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Property Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                  value={editFormData.propertyAddress}
                  onChange={(e) => setEditFormData({ ...editFormData, propertyAddress: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: ACTIVATE ACCOUNT
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'activate' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50 text-emerald-800 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <h3>Activate Landlord Permanent Access</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              <p className="text-slate-600">
                You are about to activate permanent workspace access for <strong className="text-slate-800">{selectedLandlord.full_name}</strong> (<span className="text-slate-500">{selectedLandlord.email}</span>).
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <p><strong>One-Time Fee:</strong> GH₵{selectedLandlord.one_time_fee || 500}</p>
                <p><strong>Verification:</strong> Confirm you have independently verified the cash or Mobile Money payment received outside the app.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Activation Notes (Recorded in Audit Log)</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Cash received in person / Verified direct MoMo transfer"
                  value={activateNotes}
                  onChange={(e) => setActivateNotes(e.target.value)}
                />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivateSubmit}
                  disabled={modalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Confirm &amp; Activate Access</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: SUSPEND ACCOUNT
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'suspend' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 bg-red-50 text-red-800 flex items-center gap-2 font-bold">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3>Suspend Landlord Account</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              <p className="text-slate-600">
                Are you sure you want to suspend access for <strong className="text-slate-800">{selectedLandlord.full_name}</strong>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Safety Guarantee:</strong> The landlord will be temporarily restricted from logging in. All historical tenant, room, and financial records remain permanently preserved and safe.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Suspension * (Required)</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="e.g. Administrative investigation / Security review"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Internal Memo</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Optional internal audit memo..."
                  value={suspendNotes}
                  onChange={(e) => setSuspendNotes(e.target.value)}
                />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspendSubmit}
                  disabled={modalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  <span>Suspend Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: REACTIVATE ACCOUNT
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'reactivate' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-teal-100 bg-teal-50 text-teal-900 flex items-center gap-2 font-bold">
              <RotateCcw className="w-5 h-5 text-teal-600" />
              <h3>Reactivate Suspended Account</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              <p className="text-slate-600">
                Restore full workspace access to <strong className="text-slate-800">{selectedLandlord.full_name}</strong>.
              </p>
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800">
                <strong>Zero Additional Fee Policy:</strong> The landlord previously paid their one-time access fee. Reactivation restores their permanent access immediately without asking them to pay again.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reactivation Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Identity re-verified / Administrative block lifted"
                  value={reactivateNotes}
                  onChange={(e) => setReactivateNotes(e.target.value)}
                />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReactivateSubmit}
                  disabled={modalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  <span>Reactivate (No Fee)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: RESET ACCESS / ACTIVATION LINK
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'resetAccess' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-amber-50 text-amber-900 flex items-center gap-2 font-bold">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <h3>Single-Use Activation Link &amp; Reset</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}

              {!resetResultData ? (
                <>
                  <p className="text-xs text-slate-600">
                    Generate a cryptographically secure, single-use activation link for <strong className="text-slate-800">{selectedLandlord.full_name}</strong> to set their password.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Set Temporary Password Directly (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Leave blank to let landlord set password via link"
                      value={resetTempPassword}
                      onChange={(e) => setResetTempPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="e.g. Issued initial onboarding link"
                      value={resetNotes}
                      onChange={(e) => setResetNotes(e.target.value)}
                    />
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setActiveModal(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResetAccessSubmit}
                      disabled={modalLoading}
                      className="px-5 py-2 text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      <span>Generate Link</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <strong>Link Generated:</strong> Send this single-use activation link directly to the landlord.
                  </div>

                  {resetResultData.activationLink && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-xs text-slate-500 font-semibold block">Secure Activation Link (Valid 72h):</span>
                      <input
                        type="text"
                        readOnly
                        value={resetResultData.activationLink}
                        className="w-full mt-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded text-slate-700 select-all"
                      />
                    </div>
                  )}

                  {resetResultData.temporaryPassword && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="text-slate-500 block">Direct Temporary Password:</span>
                      <code className="text-sm font-bold font-mono text-slate-800">{resetResultData.temporaryPassword}</code>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (resetResultData.activationLink) {
                          navigator.clipboard.writeText(
                            `Hello ${selectedLandlord.full_name},\nYour DwellBase landlord workspace has been activated!\nPlease click your private activation link below to set your account password:\n\n${resetResultData.activationLink}\n\nThis single-use link is valid for 72 hours.`
                          );
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied Message!' : 'Copy Activation Message'}</span>
                    </button>

                    <button
                      onClick={() => setActiveModal(null)}
                      className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: VIEW AUDIT HISTORY
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'history' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <History className="w-5 h-5 text-slate-600" />
                <h3>Administrative Audit History — {selectedLandlord.full_name}</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">Loading audit entries...</p>
                </div>
              ) : landlordHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  No administrative actions recorded yet for this landlord.
                </div>
              ) : (
                <div className="space-y-3">
                  {landlordHistory.map((entry) => (
                    <div key={entry.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                          {entry.action}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium pt-1">{entry.notes || 'Administrative operation'}</p>
                      <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                        <span>Actor: <strong>{entry.super_admin_name}</strong></span>
                        {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};

export default SuperAdminLandlords;
