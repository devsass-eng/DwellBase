import { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, Filter, ShieldCheck, 
  MoreVertical, Eye, Edit3, CheckCircle2, 
  UserX, RefreshCw, Layers, KeyRound, History, 
  AlertTriangle, Calendar, Phone, Mail, MapPin, 
  Check, X, Loader2, Copy, ExternalLink, ArrowUpDown,
  Home, Users as UsersIcon, CreditCard, Clock
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { superAdminApi, SuperAdminLandlord, SuperAdminAuditLog } from '../api/client';
import { useNotifications } from '../context/NotificationContext';

const SuperAdminLandlords = () => {
  const [landlords, setLandlords] = useState<SuperAdminLandlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'expiry'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [selectedLandlord, setSelectedLandlord] = useState<SuperAdminLandlord | null>(null);
  const [detailedLandlordData, setDetailedLandlordData] = useState<{
    landlord: SuperAdminLandlord;
    rooms: unknown[];
    tenants: unknown[];
    recentPayments: unknown[];
    history: SuperAdminAuditLog[];
  } | null>(null);

  const [activeModal, setActiveModal] = useState<
    'add' | 'view' | 'edit' | 'activate' | 'suspend' | 'renew' | 'changePlan' | 'resetAccess' | 'history' | null
  >(null);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Form states
  const [addFormData, setAddFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    propertyName: '',
    propertyAddress: '',
    subscriptionPlan: 'Standard',
    subscriptionDurationMonths: 12,
    subscriptionStartDate: new Date().toISOString().split('T')[0],
    accountStatus: 'Active',
    notes: '',
  });

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
  const [renewMonths, setRenewMonths] = useState(12);
  const [renewNotes, setRenewNotes] = useState('');
  const [newPlan, setNewPlan] = useState('Standard');
  const [newPlanDuration, setNewPlanDuration] = useState(12);
  const [newPlanNotes, setNewPlanNotes] = useState('');
  const [resetTempPassword, setResetTempPassword] = useState('');
  const [resetNotes, setResetNotes] = useState('');
  const [resetResultData, setResetResultData] = useState<{
    temporaryPassword?: string;
    resetToken?: string;
    resetLink?: string;
    expiresAt?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [landlordHistory, setLandlordHistory] = useState<SuperAdminAuditLog[]>([]);

  const { addNotification } = useNotifications();

  // Load landlords from backend
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

  // Modal open handlers
  const handleOpenAddModal = () => {
    setAddFormData({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      propertyName: '',
      propertyAddress: '',
      subscriptionPlan: 'Standard',
      subscriptionDurationMonths: 12,
      subscriptionStartDate: new Date().toISOString().split('T')[0],
      accountStatus: 'Active',
      notes: '',
    });
    setModalError('');
    setModalSuccess('');
    setActiveModal('add');
  };

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

  const handleOpenRenewModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setRenewMonths(12);
    setRenewNotes('');
    setModalError('');
    setModalSuccess('');
    setActiveModal('renew');
  };

  const handleOpenChangePlanModal = (landlord: SuperAdminLandlord) => {
    setSelectedLandlord(landlord);
    setNewPlan(landlord.subscription_plan || 'Standard');
    setNewPlanDuration(landlord.subscription_duration_months || 12);
    setNewPlanNotes('');
    setModalError('');
    setModalSuccess('');
    setActiveModal('changePlan');
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
      const history = await superAdminApi.getLandlordHistory(landlord.id);
      setLandlordHistory(history);
    } catch (err) {
      console.error(err);
      setModalError('Failed to load audit history');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit operations
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.fullName || !addFormData.email) {
      setModalError('Full name and email are required');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const res = await superAdminApi.createLandlord(addFormData);
      addNotification({
        title: 'Landlord Created',
        message: `Account created for ${addFormData.fullName} with ${addFormData.subscriptionPlan} plan`,
        type: 'success',
        recipientType: 'landlord',
      });
      setModalSuccess(`Landlord created successfully! Generated password: ${res.initialPassword}`);
      await fetchLandlords();
      setTimeout(() => setActiveModal(null), 1800);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create landlord');
    } finally {
      setModalLoading(false);
    }
  };

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
      await superAdminApi.activateLandlord(selectedLandlord.id, activateNotes);
      addNotification({
        title: 'Account Activated',
        message: `Landlord ${selectedLandlord.full_name} is now active`,
        type: 'success',
        recipientType: 'landlord',
      });
      await fetchLandlords();
      setActiveModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to activate account');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSuspendSubmit = async () => {
    if (!selectedLandlord) return;
    if (!suspendReason.trim()) {
      setModalError('Please state a reason for suspending this account');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      await superAdminApi.suspendLandlord(selectedLandlord.id, suspendReason.trim(), suspendNotes);
      addNotification({
        title: 'Account Suspended',
        message: `Account for ${selectedLandlord.full_name} suspended. Records remain preserved.`,
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

  const handleRenewSubmit = async () => {
    if (!selectedLandlord) return;
    setModalLoading(true);
    setModalError('');
    try {
      const res = await superAdminApi.renewSubscription(selectedLandlord.id, renewMonths, renewNotes);
      addNotification({
        title: 'Subscription Renewed',
        message: res.message,
        type: 'success',
        recipientType: 'landlord',
      });
      await fetchLandlords();
      setActiveModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to renew subscription');
    } finally {
      setModalLoading(false);
    }
  };

  const handleChangePlanSubmit = async () => {
    if (!selectedLandlord) return;
    setModalLoading(true);
    setModalError('');
    try {
      const res = await superAdminApi.changePlan(selectedLandlord.id, newPlan, newPlanDuration, newPlanNotes);
      addNotification({
        title: 'Plan Updated',
        message: res.message,
        type: 'success',
        recipientType: 'landlord',
      });
      await fetchLandlords();
      setActiveModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to change plan');
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
        title: 'Access Credentials Reset',
        message: `New access link and credentials generated for ${selectedLandlord.full_name}`,
        type: 'info',
        recipientType: 'landlord',
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to reset access credentials');
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
        (l.phone && l.phone.includes(searchTerm)) ||
        (l.property_name && l.property_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const status = l.computedStatus || l.account_status;
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesPlan = planFilter === 'ALL' || l.subscription_plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'createdAt') {
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'name') {
        comparison = a.full_name.localeCompare(b.full_name);
      } else if (sortBy === 'expiry') {
        const dateA = a.subscription_end_date ? new Date(a.subscription_end_date).getTime() : 0;
        const dateB = b.subscription_end_date ? new Date(b.subscription_end_date).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

  // Calculate metrics
  const totalCount = landlords.length;
  const activeCount = landlords.filter(l => (l.computedStatus || l.account_status) === 'Active').length;
  const suspendedCount = landlords.filter(l => l.account_status === 'Suspended').length;
  const expiredCount = landlords.filter(l => (l.computedStatus || l.account_status) === 'Expired').length;
  const pendingCount = landlords.filter(l => l.account_status === 'Pending Activation').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
      case 'Suspended':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Suspended</span>;
      case 'Expired':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Expired</span>;
      case 'Pending Activation':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Pending Activation</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'Enterprise':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-100 text-purple-800">Enterprise</span>;
      case 'Pro':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800">Pro</span>;
      case 'Standard':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-100 text-teal-800">Standard</span>;
      case 'Starter':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">Starter</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">{plan}</span>;
    }
  };

  const isExpiringSoon = (endDateStr: string) => {
    if (!endDateStr) return false;
    const endDate = new Date(endDateStr);
    const today = new Date();
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  return (
    <DashboardLayout userType="super_admin" userName="Super Administrator">
      <div className="space-y-6">
        
        {/* Top Header & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-900 text-amber-400 rounded-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Landlords Management</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Supervise, provision, activate, and manage all landlord platform accounts and subscription lifecycles.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Add Landlord</span>
          </button>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Landlords</span>
            <div className="text-2xl font-bold text-slate-800 mt-1">{totalCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Pending Activation</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{pendingCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Expired</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{expiredCount}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Suspended</span>
            <div className="text-2xl font-bold text-red-700 mt-1">{suspendedCount}</div>
          </div>
        </div>

        {/* Search, Filters and Sort Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or property name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
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
                <option value="Pending Activation">Pending Activation</option>
                <option value="Expired">Expired</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            {/* Plan Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span>Plan:</span>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Plans</option>
                <option value="Starter">Starter</option>
                <option value="Standard">Standard</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            {/* Sort */}
            <button
              onClick={() => {
                if (sortBy === 'createdAt') setSortBy('name');
                else if (sortBy === 'name') setSortBy('expiry');
                else setSortBy('createdAt');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs hover:bg-slate-100 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort: {sortBy === 'createdAt' ? 'Date Created' : sortBy === 'name' ? 'Name' : 'Expiry'}</span>
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
                {searchTerm || statusFilter !== 'ALL' || planFilter !== 'ALL'
                  ? 'Try adjusting your search or filters to find what you are looking for.'
                  : 'Get started by creating the first landlord account.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Landlord & Property</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Plan & Subscription</th>
                    <th className="py-3.5 px-4">Properties & Tenants</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLandlords.map((l) => {
                    const status = l.computedStatus || l.account_status;
                    const expiringSoon = isExpiringSoon(l.subscription_end_date);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Name & Property */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800">{l.full_name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{l.property_name || 'DwellBase Property'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Joined: {new Date(l.created_at).toLocaleDateString()}
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

                        {/* Subscription */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {getPlanBadge(l.subscription_plan)}
                            <span className="text-xs text-slate-500">({l.subscription_duration_months || 12} mo)</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Expires: {l.subscription_end_date || 'N/A'}</span>
                          </div>
                          {expiringSoon && status === 'Active' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 mt-1">
                              <AlertTriangle className="w-3 h-3" /> Expiring Soon
                            </span>
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
                          <div className="text-[11px] text-slate-400 mt-1">
                            {l.active_tenant_count} Active tenancies
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {getStatusBadge(status)}
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

                            <button
                              onClick={() => handleOpenRenewModal(l)}
                              title="Renew Subscription"
                              className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>

                            {status === 'Active' ? (
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
                                title="Activate Account"
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenChangePlanModal(l)}
                              title="Change Subscription Plan"
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Layers className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenResetAccessModal(l)}
                              title="Reset Access Credentials"
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
          MODAL: ADD LANDLORD
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'add' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Building2 className="w-5 h-5 text-amber-500" />
                <h3>Add New Landlord</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg border border-red-200">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 text-xs bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                  {modalSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Landlord Full Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="e.g. Kwabena Darko"
                    value={addFormData.fullName}
                    onChange={(e) => setAddFormData({ ...addFormData, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="landlord@example.com"
                    value={addFormData.email}
                    onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="024 123 4567"
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password (Optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="Auto-generated if empty"
                    value={addFormData.password}
                    onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Property Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="e.g. Royal Palms Court"
                    value={addFormData.propertyName}
                    onChange={(e) => setAddFormData({ ...addFormData, propertyName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Property Address</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="e.g. East Legon, Accra"
                    value={addFormData.propertyAddress}
                    onChange={(e) => setAddFormData({ ...addFormData, propertyAddress: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none bg-white"
                    value={addFormData.subscriptionPlan}
                    onChange={(e) => setAddFormData({ ...addFormData, subscriptionPlan: e.target.value })}
                  >
                    <option value="Starter">Starter</option>
                    <option value="Standard">Standard</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none bg-white"
                    value={addFormData.subscriptionDurationMonths}
                    onChange={(e) => setAddFormData({ ...addFormData, subscriptionDurationMonths: parseInt(e.target.value) })}
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months (1 Year)</option>
                    <option value={24}>24 Months (2 Years)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none bg-white"
                    value={addFormData.accountStatus}
                    onChange={(e) => setAddFormData({ ...addFormData, accountStatus: e.target.value })}
                  >
                    <option value="Active">Active (Paid)</option>
                    <option value="Pending Activation">Pending Activation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Notes / Receipt Ref</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Record manual payment confirmation details or memo..."
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Create Landlord Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <h3 className="font-bold text-slate-800 text-base">{selectedLandlord.full_name}</h3>
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
                  {/* Subscription & Account Status Bar */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Status</span>
                      {getStatusBadge(selectedLandlord.computedStatus || selectedLandlord.account_status)}
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Subscription Plan</span>
                      <div className="font-semibold text-slate-800">{selectedLandlord.subscription_plan} ({selectedLandlord.subscription_duration_months} mo)</div>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Start Date</span>
                      <div className="font-medium text-slate-700">{selectedLandlord.subscription_start_date || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Expiry Date</span>
                      <div className="font-semibold text-slate-800">{selectedLandlord.subscription_end_date || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Profile Summary */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                      <div><span className="text-slate-400">Phone:</span> <span className="font-medium text-slate-700">{selectedLandlord.phone || 'None provided'}</span></div>
                      <div><span className="text-slate-400">Address:</span> <span className="font-medium text-slate-700">{selectedLandlord.property_address || 'None provided'}</span></div>
                      <div><span className="text-slate-400">Total Rooms:</span> <span className="font-semibold text-slate-800">{selectedLandlord.room_count}</span></div>
                      <div><span className="text-slate-400">Total Tenants:</span> <span className="font-semibold text-slate-800">{selectedLandlord.tenant_count} ({selectedLandlord.active_tenant_count} active)</span></div>
                    </div>
                  </div>

                  {/* Rooms list */}
                  {detailedLandlordData && detailedLandlordData.rooms && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Rooms ({detailedLandlordData.rooms.length})</h4>
                      <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                        {detailedLandlordData.rooms.length === 0 ? (
                          <div className="p-3 text-slate-400 text-center">No rooms registered yet.</div>
                        ) : (
                          detailedLandlordData.rooms.map((r: any) => (
                            <div key={r.id} className="p-2.5 flex items-center justify-between">
                              <span className="font-medium text-slate-700">{r.room_number}</span>
                              <span className="text-slate-500">GH₵{r.monthly_rent}/mo</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.status === 'Occupied' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {r.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tenants list */}
                  {detailedLandlordData && detailedLandlordData.tenants && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tenants ({detailedLandlordData.tenants.length})</h4>
                      <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                        {detailedLandlordData.tenants.length === 0 ? (
                          <div className="p-3 text-slate-400 text-center">No tenants registered yet.</div>
                        ) : (
                          detailedLandlordData.tenants.map((t: any) => (
                            <div key={t.id} className="p-2.5 flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-slate-800">{t.full_name}</span>
                                <span className="text-slate-400 text-[11px] ml-1.5">({t.tenant_id})</span>
                              </div>
                              <span className="text-slate-500">{t.room_number || 'No room'}</span>
                              <span className="font-medium text-slate-700">GH₵{t.monthly_rent || 0}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${t.tenancy_status === 'Active' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                                {t.tenancy_status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recent Audit Timeline */}
                  {detailedLandlordData && detailedLandlordData.history && detailedLandlordData.history.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Admin Actions</h4>
                      <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 text-xs">
                        {detailedLandlordData.history.slice(0, 5).map((h) => (
                          <div key={h.id} className="p-2.5 flex items-start justify-between gap-3">
                            <div>
                              <span className="font-semibold text-slate-800">{h.action}</span>
                              <p className="text-[11px] text-slate-500 mt-0.5">{h.notes || 'Administrative action performed'}</p>
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
              <span className="text-slate-400">Landlord ID: <code className="font-mono">{selectedLandlord.id}</code></span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
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
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
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
              <h3>Activate Landlord Account</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              <p className="text-slate-600">
                You are about to activate the account for <strong className="text-slate-800">{selectedLandlord.full_name}</strong> (<span className="text-slate-500">{selectedLandlord.email}</span>).
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <p><strong>Plan:</strong> {selectedLandlord.subscription_plan}</p>
                <p><strong>Payment Verification:</strong> Confirm you have received subscription payment outside the app.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Activation Notes (Recorded in Audit Log)</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Payment verified via Bank Wire / MoMo ref #12345"
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
                  <span>Confirm Activation</span>
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
                <strong>Safety Policy:</strong> The landlord will be temporarily restricted from logging in. All historical tenant, room, and financial records remain permanently preserved and safe.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Suspension * (Required)</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="e.g. Non-payment of subscription renewal / Policy violation"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Additional Internal Memo</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Optional internal notes..."
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
          MODAL: RENEW SUBSCRIPTION
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'renew' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-teal-50 text-teal-900 flex items-center gap-2 font-bold">
              <RefreshCw className="w-5 h-5 text-teal-600" />
              <h3>Renew Landlord Subscription</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p><strong>Landlord:</strong> {selectedLandlord.full_name} ({selectedLandlord.email})</p>
                <p><strong>Current Plan:</strong> {selectedLandlord.subscription_plan}</p>
                <p><strong>Current Expiry:</strong> {selectedLandlord.subscription_end_date || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Extension Duration</label>
                <select
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value={1}>+1 Month</option>
                  <option value={3}>+3 Months</option>
                  <option value={6}>+6 Months</option>
                  <option value={12}>+12 Months (1 Year)</option>
                  <option value={24}>+24 Months (2 Years)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Renewal Notes / Offline Payment Ref</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Paid annual subscription via MoMo / Bank Transfer"
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
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
                  onClick={handleRenewSubmit}
                  disabled={modalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Confirm Renewal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: CHANGE PLAN
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'changePlan' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-indigo-50 text-indigo-900 flex items-center gap-2 font-bold">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3>Change Subscription Plan</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p><strong>Landlord:</strong> {selectedLandlord.full_name}</p>
                <p><strong>Current Plan:</strong> {selectedLandlord.subscription_plan}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Plan</label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Standard">Standard</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Months)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newPlanDuration}
                    onChange={(e) => setNewPlanDuration(parseInt(e.target.value) || 12)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes / Reason</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Landlord upgraded to Pro tier after adding 20+ rooms"
                  value={newPlanNotes}
                  onChange={(e) => setNewPlanNotes(e.target.value)}
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
                  onClick={handleChangePlanSubmit}
                  disabled={modalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: RESET ACCESS & CREDENTIALS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeModal === 'resetAccess' && selectedLandlord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-amber-50 text-amber-900 flex items-center gap-2 font-bold">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <h3>Reset Landlord Access Credentials</h3>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {modalError && <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg">{modalError}</div>}

              {!resetResultData ? (
                <>
                  <p className="text-xs text-slate-600">
                    Generate a secure, expiring password reset and activation link for <strong className="text-slate-800">{selectedLandlord.full_name}</strong>.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Set Specific Temporary Password (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="Leave blank to auto-generate secure password"
                      value={resetTempPassword}
                      onChange={(e) => setResetTempPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="e.g. Requested password recovery via phone verification"
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
                      className="px-5 py-2 text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      <span>Generate Reset Access</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <strong>Success!</strong> Credentials have been updated and an expiring activation token was generated.
                  </div>

                  {resetResultData.temporaryPassword && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-xs text-slate-500 block">Temporary Password:</span>
                      <code className="text-sm font-bold font-mono text-slate-800 select-all">{resetResultData.temporaryPassword}</code>
                    </div>
                  )}

                  {resetResultData.resetLink && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-xs text-slate-500 block">Direct Access Link:</span>
                      <input
                        type="text"
                        readOnly
                        value={resetResultData.resetLink}
                        className="w-full mt-1 px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded text-slate-700 select-all"
                      />
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400">
                    Token Expires: {new Date(resetResultData.expiresAt || '').toLocaleString()}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (resetResultData.resetLink) {
                          navigator.clipboard.writeText(
                            `DwellBase Landlord Access Details:\nEmail: ${selectedLandlord.email}\nTemporary Password: ${resetResultData.temporaryPassword}\nLogin URL: ${resetResultData.resetLink}`
                          );
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied Details!' : 'Copy Info'}</span>
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
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
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
