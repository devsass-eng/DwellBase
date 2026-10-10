import { useState, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import { 
  Plus, Search, Filter, MoreVertical, 
  UserPlus, Mail, Phone,
  DollarSign, X,
  AlertCircle, BedDouble
} from 'lucide-react';

const TenantsManagement = () => {
  const { rooms, tenants, addTenant } = useAppData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
        outstandingBalance: totalContractualRent,
        tenancyStatus: new Date(formData.startDate) > new Date() ? 'Upcoming' : 'Active',
        accountStatus: formData.createLogin === 'now' ? 'Invitation Pending' : 'Not Set Up'
      });

      setIsSubmitting(false);
      setIsAddModalOpen(false);
      resetForm();
    }, 1000);
  };

  const formatCurrency = (amount: number) =>
    `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Active': 'bg-emerald-50 text-emerald-700',
      'Upcoming': 'bg-blue-50 text-blue-700',
      'Expiring Soon': 'bg-amber-50 text-amber-700',
      'Expired': 'bg-red-50 text-red-700',
      'Ended': 'bg-gray-100 text-gray-600',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <DashboardLayout userType="landlord" userName="Sarah Landlord">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Tenants</h2>
            <p className="text-slate-500 mt-1">Manage tenant information, accommodation, tenancy periods, and rent agreements.</p>
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
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none py-2.5 pl-3 pr-8"
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
                        <div className="font-medium text-slate-800">Room {tenant.roomNumber}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatCurrency(tenant.monthlyRent)}/mo</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-500">{new Date(tenant.startDate).toLocaleDateString()} →</div>
                        <div className="text-xs text-slate-500">{new Date(tenant.endDate).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(tenant.tenancyStatus)}`}>
                          {tenant.tenancyStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-teal-600 p-2 rounded-lg hover:bg-teal-50 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
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

                <form id="add-tenant-form" onSubmit={handleSaveTenant} className="space-y-8">

                  {/* Section A: Personal Information */}
                  <section>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                      1. Personal Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="text" required value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="Enter full legal name" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="e.g. 024 123 4567" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="tenant@example.com" />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tenant ID <span className="text-gray-400 font-normal text-xs">(Auto-generated)</span></label>
                        <input type="text" readOnly value={generatedTenantId} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-slate-400 font-mono text-sm outline-none cursor-not-allowed" />
                      </div>
                    </div>
                  </section>

                  {/* Section B: Accommodation & Tenancy */}
                  <section>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                      2. Accommodation & Tenancy
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Room Number */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Room Number <span className="text-red-500">*</span></label>
                        {vacantRooms.length === 0 ? (
                          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <BedDouble className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-sm text-amber-700">
                              {rooms.length === 0
                                ? 'No rooms added yet. Go to Rooms to add rooms first.'
                                : 'All rooms are currently occupied. No vacant rooms available.'}
                            </p>
                          </div>
                        ) : (
                          <select
                            required
                            value={formData.roomId}
                            onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                          >
                            <option value="">Select a vacant room</option>
                            {vacantRooms.map(room => (
                              <option key={room.id} value={room.id}>
                                {room.roomNumber}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Monthly Rent — read-only, auto-filled from room */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Rent (GH₵)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            readOnly
                            value={selectedRoom ? formatCurrency(selectedRoom.monthlyRent) : '— Select a room first —'}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-slate-500 outline-none cursor-not-allowed font-medium"
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Set when you added the room. Select a room to see its rent.</p>
                      </div>

                      {/* Start Date */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tenancy Start Date <span className="text-red-500">*</span></label>
                        <input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
                      </div>

                      {/* Duration */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tenancy Duration <span className="text-red-500">*</span></label>
                        <select
                          required
                          value={formData.durationMonths}
                          onChange={e => setFormData({ ...formData, durationMonths: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                        >
                          <option value="6">6 months</option>
                          <option value="12">1 year</option>
                          <option value="24">2 years</option>
                          <option value="36">3 years</option>
                          <option value="48">4 years</option>
                          <option value="60">5 years</option>
                          <option value="custom">Custom Duration</option>
                        </select>
                        {formData.durationMonths === 'custom' && (
                          <div className="flex items-center gap-2 mt-2">
                            <input type="number" required min="1" placeholder="Number of months" value={formData.customDuration} onChange={e => setFormData({ ...formData, customDuration: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                            <span className="text-sm text-gray-500 shrink-0">months</span>
                          </div>
                        )}
                      </div>

                      {/* Calculated Summary */}
                      <div className="md:col-span-2 bg-navy-50 rounded-xl p-5 border border-navy-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="block text-xs font-semibold text-navy-600 uppercase tracking-wider mb-1">Calculated End Date</span>
                            <span className="text-lg font-semibold text-slate-800">
                              {calculatedEndDate ? new Date(calculatedEndDate).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold text-navy-600 uppercase tracking-wider mb-1">Total Contractual Rent</span>
                            <span className="text-2xl font-bold text-teal-700">
                              {selectedRoom && activeDuration ? formatCurrency(totalContractualRent) : '—'}
                            </span>
                            {selectedRoom && activeDuration > 0 && (
                              <span className="block text-xs text-slate-400 mt-0.5">
                                {formatCurrency(selectedRoom.monthlyRent)} × {activeDuration} months
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Section C: Account Access */}
                  <section>
                    <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                      3. Tenant Account Access
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        {
                          value: 'now',
                          title: 'Create Tenant Login Now',
                          desc: 'Tenant will receive instructions to set up their password and access their dashboard.',
                          color: 'teal'
                        },
                        {
                          value: 'later',
                          title: 'Set Up Tenant Login Later',
                          desc: 'Save records without granting dashboard access. You can invite them at any time.',
                          color: 'navy'
                        }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-3 p-4 cursor-pointer rounded-xl border-2 transition-colors ${formData.createLogin === opt.value
                            ? `border-${opt.color}-500 bg-${opt.color}-50/40`
                            : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                          <input type="radio" name="createLogin" value={opt.value} checked={formData.createLogin === opt.value} onChange={() => setFormData({ ...formData, createLogin: opt.value })} className="sr-only" />
                          <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.createLogin === opt.value ? `border-${opt.color}-500` : 'border-gray-300'}`}>
                            {formData.createLogin === opt.value && <div className={`w-2 h-2 rounded-full bg-${opt.color}-500`} />}
                          </div>
                          <div>
                            <span className="block text-sm font-semibold text-slate-700">{opt.title}</span>
                            <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                          </div>
                        </label>
                      ))}
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
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Tenant'}
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
