import { useState, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import type { Tenant } from '../context/AppDataContext';
import { formatGHS, formatReadableDate } from '../utils/reportUtils';
import { 
  Plus, Search, Filter, 
  UserPlus,
  X, AlertCircle, Edit3, Trash2,
  AlertTriangle, Eye, ShieldCheck
} from 'lucide-react';

const TenantsManagement = () => {
  const { rooms, tenants, charges, addTenant, updateTenant, removeTenant, landlordProfile } = useAppData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Modals for Actions
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '', monthlyRent: 0 });
  const [removingTenant, setRemovingTenant] = useState<Tenant | null>(null);
  const [removalReason, setRemovalReason] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    roomId: '',
    startDate: new Date().toISOString().split('T')[0],
    durationMonths: '12',
    customDuration: '',
    createLogin: 'later'
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only vacant rooms from the shared data store
  const vacantRooms = useMemo(() => rooms.filter(r => r.status === 'Vacant'), [rooms]);

  // Auto-populate rent from selected room
  const selectedRoom = useMemo(() => rooms.find(r => r.id === formData.roomId), [rooms, formData.roomId]);

  // Sequential Tenant ID
  const generatedTenantId = useMemo(() => {
    const nextNumber = tenants.length + 1;
    return `TENT-${nextNumber.toString().padStart(2, '0')}`;
  }, [tenants.length]);

  const activeDuration = formData.durationMonths === 'custom'
    ? parseInt(formData.customDuration || '0')
    : parseInt(formData.durationMonths);

  const calculatedEndDate = useMemo(() => {
    if (!formData.startDate || !activeDuration) return '';
    const date = new Date(formData.startDate);
    date.setMonth(date.getMonth() + activeDuration);
    return date.toISOString().split('T')[0];
  }, [formData.startDate, activeDuration]);

  const totalContractualRent = useMemo(() => {
    const rent = selectedRoom?.monthlyRent || 0;
    if (!rent || !activeDuration) return 0;
    return rent * activeDuration;
  }, [selectedRoom, activeDuration]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const matchesSearch =
        t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tenantId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone.includes(searchQuery) ||
        t.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = statusFilter === 'All' || t.tenancyStatus === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tenants, searchQuery, statusFilter]);

  const resetForm = () => {
    setFormData({
      fullName: '', phone: '', email: '', roomId: '',
      startDate: new Date().toISOString().split('T')[0],
      durationMonths: '12', customDuration: '', createLogin: 'later'
    });
    setFormError('');
  };

  const handleSaveTenant = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.fullName.trim()) return setFormError('Full Name is required.');
    if (!formData.phone.trim()) return setFormError('Phone Number is required.');
    if (!formData.roomId) return setFormError('Please select a room.');
    if (!selectedRoom) return setFormError('Selected room is no longer available.');
    if (!formData.startDate) return setFormError('Start Date is required.');
    if (!activeDuration || activeDuration <= 0) return setFormError('Valid duration is required.');
    if (!calculatedEndDate) return setFormError('Could not calculate end date.');

    setIsSubmitting(true);

    setTimeout(() => {
      addTenant({
        tenantId: generatedTenantId,
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        roomCode: selectedRoom.roomCode,
        monthlyRent: selectedRoom.monthlyRent,
        startDate: formData.startDate,
        durationMonths: activeDuration,
        endDate: calculatedEndDate,
        totalContractualRent,
        amountPaid: 0,
        outstandingBalance: 0, // Charges will track actual billing
        tenancyStatus: new Date(formData.startDate) > new Date() ? 'Upcoming' : 'Active',
        accountStatus: formData.createLogin === 'now' ? 'Invitation Pending' : 'Not Set Up'
      });

      setIsSubmitting(false);
      setIsAddModalOpen(false);
      resetForm();
    }, 600);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    updateTenant(editingTenant.id, {
      fullName: editForm.fullName,
      phone: editForm.phone,
      email: editForm.email,
      monthlyRent: editForm.monthlyRent,
    });
    setEditingTenant(null);
  };

  const handleConfirmRemoval = () => {
    if (!removingTenant) return;
    removeTenant(removingTenant.id, removalReason);
    setRemovingTenant(null);
    setRemovalReason('');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Active': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      'Upcoming': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Expiring Soon': 'bg-amber-50 text-amber-700 border border-amber-200',
      'Expired': 'bg-red-50 text-red-700 border border-red-200',
      'Ended': 'bg-gray-100 text-gray-600 border border-gray-200',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <DashboardLayout userType="landlord" userName={landlordProfile.fullName}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Tenants</h2>
            <p className="text-slate-500 mt-1">Manage tenant profiles, room allocations, agreements, and login access.</p>
          </div>
          <button
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Tenant
          </button>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, phone, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none py-2.5 pl-3 pr-8 text-sm"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="Ended">Ended</option>
            </select>
          </div>
        </div>

        {/* Tenant List */}
        {tenants.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No tenants added yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">Register your first tenant to start managing rent and payments.</p>
            <button
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Your First Tenant
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-gray-50 text-slate-700 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Tenant</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Room & Rent</th>
                    <th className="px-6 py-4">Tenancy</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{tenant.fullName}</div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">{tenant.tenantId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{tenant.phone}</div>
                        {tenant.email && <div className="text-xs text-slate-400 mt-0.5">{tenant.email}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{tenant.roomNumber}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatGHS(tenant.monthlyRent)}/mo</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-500">{formatReadableDate(tenant.startDate)} →</div>
                        <div className="text-xs text-slate-500">{formatReadableDate(tenant.endDate)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(tenant.tenancyStatus)}`}>
                          {tenant.tenancyStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button 
                          onClick={() => setViewingTenant(tenant)}
                          className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors inline-flex items-center gap-1"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                        <button 
                          onClick={() => {
                            setEditingTenant(tenant);
                            setEditForm({
                              fullName: tenant.fullName,
                              phone: tenant.phone,
                              email: tenant.email,
                              monthlyRent: tenant.monthlyRent
                            });
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors inline-flex items-center gap-1"
                          title="Edit Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        {tenant.tenancyStatus !== 'Ended' && (
                          <button 
                            onClick={() => {
                              setRemovingTenant(tenant);
                              setRemovalReason('');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-1"
                            title="End Tenancy & Remove Tenant"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> End Tenancy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No tenants match your current search or filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MODAL: VIEW TENANT DETAILS ────────────────────────────────────── */}
        {viewingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setViewingTenant(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">Tenant Profile</h3>
                <button onClick={() => setViewingTenant(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div><span className="text-xs text-slate-400 block">Full Name</span><strong>{viewingTenant.fullName}</strong></div>
                <div><span className="text-xs text-slate-400 block">Tenant ID</span><span className="font-mono">{viewingTenant.tenantId}</span></div>
                <div><span className="text-xs text-slate-400 block">Contact</span><span>{viewingTenant.phone} • {viewingTenant.email || 'No email provided'}</span></div>
                <div><span className="text-xs text-slate-400 block">Assigned Room</span><strong>{viewingTenant.roomNumber}</strong></div>
                <div><span className="text-xs text-slate-400 block">Contract Period</span><span>{formatReadableDate(viewingTenant.startDate)} to {formatReadableDate(viewingTenant.endDate)}</span></div>
                <div><span className="text-xs text-slate-400 block">Agreed Monthly Rent</span><strong>{formatGHS(viewingTenant.monthlyRent)}</strong></div>
                <div><span className="text-xs text-slate-400 block">Tenancy Status</span><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(viewingTenant.tenancyStatus)}`}>{viewingTenant.tenancyStatus}</span></div>
                <div><span className="text-xs text-slate-400 block">Login Account</span><span className="font-semibold text-teal-700">{viewingTenant.accountStatus}</span></div>
              </div>
              <div className="flex justify-end pt-3 border-t">
                <button onClick={() => setViewingTenant(null)} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: EDIT TENANT ────────────────────────────────────────────── */}
        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setEditingTenant(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">Edit Tenant Details</h3>
                <button onClick={() => setEditingTenant(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={editForm.fullName} 
                    onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} 
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    required 
                    value={editForm.phone} 
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })} 
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={editForm.email} 
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })} 
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Agreed Monthly Rent (GH₵)</label>
                  <input 
                    type="number" 
                    min="1" 
                    required 
                    value={editForm.monthlyRent} 
                    onChange={e => setEditForm({ ...editForm, monthlyRent: parseFloat(e.target.value) || 0 })} 
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button type="button" onClick={() => setEditingTenant(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: CONFIRM END TENANCY & REMOVAL ──────────────────────────── */}
        {removingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setRemovingTenant(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-bold">End Tenancy & Remove Tenant</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to end the tenancy for <strong>{removingTenant.fullName}</strong> ({removingTenant.tenantId}) in <strong>{removingTenant.roomNumber}</strong>?
              </p>

              {/* Debt Preservation Notice */}
              {charges.filter(c => c.tenantId === removingTenant.id && c.status !== 'paid').reduce((s, c) => s + c.remainingBalance, 0) > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <strong>Important — Preserved Debt:</strong>
                  <p>
                    This tenant has an outstanding balance of <strong>{formatGHS(charges.filter(c => c.tenantId === removingTenant.id && c.status !== 'paid').reduce((s, c) => s + c.remainingBalance, 0))}</strong>.
                    Per DwellBase regulations, their debt will remain permanently attached to their historical record and will never be cancelled or transferred to a replacement tenant.
                  </p>
                </div>
              )}

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-teal-600 inline mr-1" />
                Historical records, past payments, and issued receipts will remain permanently searchable under <strong>History & Reports &gt; Former Tenants</strong>.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Ending Tenancy (Required for Audit Trail)</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g., Contract expired; tenant moved out."
                  value={removalReason}
                  onChange={e => setRemovalReason(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setRemovingTenant(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                <button
                  type="button"
                  onClick={handleConfirmRemoval}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700"
                >
                  Confirm End of Tenancy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Tenant Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
                <h3 className="text-xl font-bold text-slate-800">Add New Tenant</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {formError && (
                  <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{formError}</p>
                  </div>
                )}

                <form id="add-tenant-form" onSubmit={handleSaveTenant} className="space-y-6">
                  {/* Section A: Basic Info */}
                  <section>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                      1. Basic Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Generated Tenant ID</label>
                        <input type="text" disabled value={generatedTenantId} className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-slate-500 font-mono text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                        <input type="text" required placeholder="e.g. John Mensah" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                        <input type="tel" required placeholder="e.g. 0244123456" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input type="email" placeholder="e.g. john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                      </div>
                    </div>
                  </section>

                  {/* Section B: Accommodation */}
                  <section>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                      2. Accommodation & Tenancy Agreement
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Assign Room <span className="text-red-500">*</span></label>
                        <select required value={formData.roomId} onChange={(e) => setFormData({ ...formData, roomId: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm">
                          <option value="">Select a vacant room</option>
                          {vacantRooms.map(r => (
                            <option key={r.id} value={r.id}>{r.roomNumber} — {formatGHS(r.monthlyRent)}/mo</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tenancy Start Date <span className="text-red-500">*</span></label>
                        <input type="date" required value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                      </div>
                    </div>
                  </section>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-tenant-form"
                  disabled={isSubmitting || vacantRooms.length === 0}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? 'Saving...' : 'Save Tenant'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default TenantsManagement;
