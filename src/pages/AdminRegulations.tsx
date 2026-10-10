import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppData } from '../context/AppDataContext';
import { useNotifications } from '../context/NotificationContext';
import { ClipboardList, Plus, AlertCircle } from 'lucide-react';

const AdminRegulations = () => {
  const { regulations, addRegulation, tenants } = useAppData();
  const { notify } = useNotifications();

  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const text = inputText.trim();
    if (!text) {
      setError('Please enter a regulation before saving.');
      return;
    }

    setIsSubmitting(true);

    // Simulate network delay
    setTimeout(() => {
      addRegulation(text);
      setInputText('');
      setIsSubmitting(false);

      notify({
        recipientType: 'landlord',
        title: 'Regulation Added',
        message: 'The new regulation was saved successfully.',
        type: 'success',
      });

      // Notify all active tenants
      const activeTenants = tenants.filter(t => t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming');
      activeTenants.forEach(tenant => {
        notify({
          recipientType: 'tenant',
          recipientId: tenant.id,
          title: 'New Regulation Added',
          message: 'New regulation added. Please visit the Regulations page to read it.',
          type: 'info',
        }, true); // The true flag ensures pop-ups are created
      });
    }, 600);
  };

  return (
    <DashboardLayout userType="landlord" userName="Sarah Landlord">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Regulations</h2>
          <p className="text-slate-500 mt-1">Manage the property rules and regulations.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-slate-800">Add New Regulation</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm border border-red-100">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Enter the regulation text here…"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none resize-y"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                ) : (
                  <><Plus className="w-4 h-4" /> Add Regulation</>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
            <ClipboardList className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-800">Current Regulations</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {regulations.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p>No regulations added yet.</p>
              </div>
            ) : (
              regulations.map((reg, index) => (
                <div key={reg.id} className="p-5 flex gap-4">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-navy-50 text-navy-600 flex items-center justify-center font-bold text-sm">
                    {regulations.length - index}
                  </div>
                  <div>
                    <p className="text-slate-700 whitespace-pre-wrap">{reg.text}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Added on {new Date(reg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRegulations;
