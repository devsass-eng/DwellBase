import { useState, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import type { Room } from '../context/AppDataContext';
import {
  Plus, Search, Filter, DoorOpen,
  CheckCircle2, AlertTriangle, Wrench,
  X, AlertCircle, Eye, DollarSign,
  LayoutGrid, RotateCcw
} from 'lucide-react';

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({
  title, value, icon: Icon, colorClass, subtitle
}: {
  title: string; value: string | number; icon: React.ElementType;
  colorClass: string; subtitle?: string
}) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 mt-1">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    {subtitle && <p className="text-xs text-slate-400 border-t border-gray-50 pt-2">{subtitle}</p>}
  </div>
);

const StatusBadge = ({ status }: { status: Room['status'] }) => {
  const map: Record<Room['status'], string> = {
    Vacant: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    Occupied: 'bg-blue-50 text-blue-700 border border-blue-100',
    Maintenance: 'bg-amber-50 text-amber-700 border border-amber-100',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${map[status]}`}>
      {status === 'Vacant' && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === 'Occupied' && <DoorOpen className="w-3 h-3 mr-1" />}
      {status === 'Maintenance' && <Wrench className="w-3 h-3 mr-1" />}
      {status}
    </span>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

const RoomsManagement = () => {
  const { rooms, tenants, nextRoomSequence, addRoom, updateRoom, archiveRoom } = useAppData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Room['status']>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditRentModalOpen, setIsEditRentModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Add Room form
  const [rentInput, setRentInput] = useState('');
  const [addFormError, setAddFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Rent form
  const [editRentInput, setEditRentInput] = useState('');
  const [editRentError, setEditRentError] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const activeRooms = useMemo(() => rooms.filter(r => !r.archived), [rooms]);

  const stats = useMemo(() => ({
    total: activeRooms.length,
    occupied: activeRooms.filter(r => r.status === 'Occupied').length,
    vacant: activeRooms.filter(r => r.status === 'Vacant').length,
    maintenance: activeRooms.filter(r => r.status === 'Maintenance').length,
  }), [activeRooms]);

  // Map roomId → tenant for quick lookup
  const tenantByRoom = useMemo(() => {
    const map: Record<string, typeof tenants[0]> = {};
    tenants.forEach(t => {
      if (t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming') {
        map[t.roomId] = t;
      }
    });
    return map;
  }, [tenants]);

  const filteredRooms = useMemo(() => {
    return activeRooms.filter(room => {
      const tenant = tenantByRoom[room.id];
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        room.roomNumber.toLowerCase().includes(searchLower) ||
        room.roomCode.toLowerCase().includes(searchLower) ||
        (tenant?.fullName.toLowerCase().includes(searchLower)) ||
        (tenant?.tenantId.toLowerCase().includes(searchLower));
      const matchesFilter = statusFilter === 'All' || room.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeRooms, searchQuery, statusFilter, tenantByRoom]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError('');
    const rent = parseFloat(rentInput);
    if (!rentInput || isNaN(rent) || rent <= 0) {
      return setAddFormError('Please enter a valid monthly rent amount greater than GH₵0.');
    }
    setIsSubmitting(true);
    // Simulate async save
    setTimeout(() => {
      addRoom(rent);
      setRentInput('');
      setIsSubmitting(false);
      setIsAddModalOpen(false);
    }, 600);
  };

  const openDetail = (room: Room) => {
    setSelectedRoom(room);
    setIsDetailModalOpen(true);
  };

  const openEditRent = (room: Room) => {
    setSelectedRoom(room);
    setEditRentInput(room.monthlyRent.toString());
    setEditRentError('');
    setIsEditRentModalOpen(true);
  };

  const handleEditRent = (e: React.FormEvent) => {
    e.preventDefault();
    setEditRentError('');
    if (!selectedRoom) return;
    const rent = parseFloat(editRentInput);
    if (isNaN(rent) || rent <= 0) {
      return setEditRentError('Rent must be greater than GH₵0.');
    }
    setIsEditSubmitting(true);
    setTimeout(() => {
      updateRoom(selectedRoom.id, { monthlyRent: rent });
      setIsEditSubmitting(false);
      setIsEditRentModalOpen(false);
      setSelectedRoom(null);
    }, 500);
  };

  const handleToggleMaintenance = (room: Room) => {
    if (room.status === 'Occupied') return; // guarded
    const newStatus: Room['status'] = room.status === 'Maintenance' ? 'Vacant' : 'Maintenance';
    updateRoom(room.id, { status: newStatus });
  };

  const handleArchive = (room: Room) => {
    if (!confirm(`Archive ${room.roomNumber}? This cannot be undone.`)) return;
    const success = archiveRoom(room.id);
    if (!success) {
      alert(`Cannot archive ${room.roomNumber} — it still has an active tenant.`);
    }
  };

  const formatCurrency = (amount: number) =>
    `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout userType="landlord" userName="Sarah Landlord">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Rooms Management</h2>
            <p className="text-slate-500 mt-1">Manage your rooms, occupancy, and monthly rent.</p>
          </div>
          <button
            onClick={() => { setRentInput(''); setAddFormError(''); setIsAddModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium shadow-sm shrink-0"
          >
            <Plus className="w-5 h-5" />
            Add Room
          </button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Rooms" value={stats.total} icon={LayoutGrid} colorClass="bg-navy-50 text-navy-700" />
          <StatCard title="Occupied" value={stats.occupied} icon={DoorOpen} colorClass="bg-blue-50 text-blue-600" subtitle="Rooms with active tenants" />
          <StatCard title="Vacant" value={stats.vacant} icon={CheckCircle2} colorClass="bg-emerald-50 text-emerald-600" subtitle="Available for new tenants" />
          <StatCard title="Maintenance" value={stats.maintenance} icon={Wrench} colorClass="bg-amber-50 text-amber-600" subtitle="Temporarily unavailable" />
        </div>

        {/* ── Search & Filters ── */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by room number or tenant name / ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-gray-50 border border-gray-200 text-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none py-2.5 pl-3 pr-8"
            >
              <option value="All">All Rooms</option>
              <option value="Vacant">Vacant</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Under Maintenance</option>
            </select>
            {(searchQuery || statusFilter !== 'All') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Clear filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Rooms Table ── */}
        {activeRooms.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <DoorOpen className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No rooms added yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">Add your first room to start managing occupancy and rent. Room numbers are generated automatically.</p>
            <button
              onClick={() => { setRentInput(''); setAddFormError(''); setIsAddModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Your First Room
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-100 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-4">Room Number</th>
                    <th className="px-6 py-4">Monthly Rent</th>
                    <th className="px-6 py-4">Current Tenant</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRooms.map(room => {
                    const tenant = tenantByRoom[room.id];
                    return (
                      <tr key={room.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Room Number */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{room.roomNumber}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{room.roomCode}</div>
                        </td>

                        {/* Rent */}
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {formatCurrency(room.monthlyRent)}
                          <div className="text-xs text-slate-400 font-normal">per month</div>
                        </td>

                        {/* Current Tenant */}
                        <td className="px-6 py-4">
                          {tenant ? (
                            <>
                              <div className="font-medium text-slate-800">{tenant.fullName}</div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5">{tenant.tenantId}</div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic text-xs">No tenant assigned</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <StatusBadge status={room.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button
                              onClick={() => openDetail(room)}
                              title="View Details"
                              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditRent(room)}
                              title="Edit Monthly Rent"
                              className="p-2 text-slate-400 hover:text-navy-700 hover:bg-navy-50 rounded-lg transition-colors"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            {room.status !== 'Occupied' && (
                              <button
                                onClick={() => handleToggleMaintenance(room)}
                                title={room.status === 'Maintenance' ? 'Restore Availability' : 'Mark Under Maintenance'}
                                className={`p-2 rounded-lg transition-colors ${
                                  room.status === 'Maintenance'
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-amber-600 hover:bg-amber-50'
                                }`}
                              >
                                {room.status === 'Maintenance' ? <RotateCcw className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                              </button>
                            )}
                            {room.status !== 'Occupied' && (
                              <button
                                onClick={() => handleArchive(room)}
                                title="Archive Room"
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRooms.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-14 text-center">
                        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No rooms match your search.</p>
                        <button
                          onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                          className="mt-2 text-sm text-teal-600 hover:underline"
                        >
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ADD ROOM MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Add New Room</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Room number is assigned automatically</p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRoom} className="p-6 space-y-5">
                {addFormError && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{addFormError}</p>
                  </div>
                )}

                {/* Room Number Preview */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Room Number <span className="text-gray-400 font-normal text-xs">(Auto-generated)</span>
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-navy-50 border border-navy-100 rounded-xl">
                    <DoorOpen className="w-5 h-5 text-navy-600 shrink-0" />
                    <div>
                      <span className="font-bold text-navy-800">ROOM {nextRoomSequence} (R{nextRoomSequence})</span>
                      <span className="text-xs text-navy-500 ml-2">— next available number</span>
                    </div>
                  </div>
                </div>

                {/* Monthly Rent */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monthly Rent (GH₵) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">GH₵</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={rentInput}
                      onChange={e => setRentInput(e.target.value)}
                      className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-lg font-semibold"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    This is the room's default monthly rent. It will appear automatically when assigning a tenant.
                  </p>
                </div>

                {/* Room Status Note */}
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  New rooms are set to <strong>Vacant</strong> by default.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : 'Save Room'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            VIEW ROOM DETAIL MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {isDetailModalOpen && selectedRoom && (() => {
          const tenant = tenantByRoom[selectedRoom.id];
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                  <h3 className="text-lg font-bold text-slate-800">Room Details</h3>
                  <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Room identity */}
                  <div className="flex items-center gap-4 p-4 bg-navy-50 rounded-xl border border-navy-100">
                    <div className="w-14 h-14 rounded-xl bg-navy-900 text-teal-400 flex items-center justify-center text-xl font-bold shrink-0">
                      {selectedRoom.roomCode}
                    </div>
                    <div>
                      <div className="text-xl font-bold text-navy-900">{selectedRoom.roomNumber}</div>
                      <StatusBadge status={selectedRoom.status} />
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monthly Rent</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(selectedRoom.monthlyRent)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Room Code</p>
                      <p className="text-lg font-bold text-slate-800 font-mono">{selectedRoom.roomCode}</p>
                    </div>
                  </div>

                  {/* Tenant info */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Tenant</p>
                    {tenant ? (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                        <div className="font-semibold text-slate-800">{tenant.fullName}</div>
                        <div className="text-xs text-slate-500 font-mono">{tenant.tenantId}</div>
                        <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-600">
                          <div><span className="font-medium">Start:</span> {new Date(tenant.startDate).toLocaleDateString()}</div>
                          <div><span className="font-medium">End:</span> {new Date(tenant.endDate).toLocaleDateString()}</div>
                          <div><span className="font-medium">Agreed rent:</span> {formatCurrency(tenant.monthlyRent)}/mo</div>
                          <div><span className="font-medium">Status:</span> {tenant.tenancyStatus}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-slate-400 italic text-sm text-center">
                        No tenant currently assigned to this room.
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 border-t border-gray-100 pt-3">
                    Added: {new Date(selectedRoom.createdAt).toLocaleDateString()}
                    &nbsp;·&nbsp;
                    Updated: {new Date(selectedRoom.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════════
            EDIT RENT MODAL
        ══════════════════════════════════════════════════════════════════════ */}
        {isEditRentModalOpen && selectedRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsEditRentModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Edit Monthly Rent</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedRoom.roomNumber}</p>
                </div>
                <button onClick={() => setIsEditRentModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditRent} className="p-6 space-y-5">
                {editRentError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 border border-red-100 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {editRentError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    New Monthly Rent (GH₵) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">GH₵</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={editRentInput}
                      onChange={e => setEditRentInput(e.target.value)}
                      className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none text-lg font-semibold"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg p-2 border border-amber-100">
                    ⚠ This updates the room's default rent only. Existing tenant agreements and historical payment records are not altered.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setIsEditRentModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEditSubmitting}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors flex items-center gap-2"
                  >
                    {isEditSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : 'Update Rent'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default RoomsManagement;
