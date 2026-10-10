import { X, Printer } from 'lucide-react';
import type { PaymentRecord } from '../context/AppDataContext';

interface ReceiptModalProps {
  payment: PaymentRecord;
  onClose: () => void;
  landlordName?: string;
}

const formatGHS = (n: number) => `GH₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

export default function ReceiptModal({ payment, onClose, landlordName = 'DwellBase Properties' }: ReceiptModalProps) {
  const isConfirmed = payment.status === 'successful';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 print:p-0 print:block">
      {/* Backdrop (hidden on print) */}
      <div 
        className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm print:hidden" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden print:w-full print:max-w-none print:shadow-none print:rounded-none print:h-auto print:block">
        
        {/* Header Actions (hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60 shrink-0 print:hidden">
          <h3 className="text-lg font-bold text-slate-800">Payment Receipt</h3>
          <div className="flex items-center gap-2">
            {isConfirmed && (
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl font-medium text-sm transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 print:p-8 print:overflow-visible">
          <div className="max-w-xl mx-auto space-y-8">
            
            {/* Receipt Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-100 pb-8">
              <div>
                <img src="/logo.svg" alt="DwellBase" className="h-10 mb-2 object-contain" />
                <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Property Management Made Simple</p>
                <div className="mt-4 text-sm text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800 text-base">{landlordName}</p>
                  {/* Additional landlord details can go here */}
                </div>
              </div>
              <div className="text-right space-y-1">
                <h1 className="text-3xl font-black text-navy-900 uppercase tracking-tight">RECEIPT</h1>
                <p className="text-sm font-semibold text-teal-600">{payment.receiptNumber || 'PENDING'}</p>
                <p className="text-sm text-slate-500">Date: {new Date(payment.paymentDate).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Status Banner */}
            {!isConfirmed && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <p className="text-sm font-bold text-amber-800 uppercase tracking-widest">Awaiting Verification</p>
                <p className="text-xs text-amber-700 mt-1">This payment has not yet been confirmed by the landlord.</p>
              </div>
            )}
            
            {isConfirmed && payment.status === 'reversed' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-sm font-bold text-red-800 uppercase tracking-widest">Reversed / Refunded</p>
                <p className="text-xs text-red-700 mt-1">This payment has been reversed and is no longer active.</p>
              </div>
            )}

            {/* Main Info Grid */}
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Received From</p>
                  <p className="font-bold text-slate-800">{payment.tenantName}</p>
                  <p className="text-slate-600">Tenant ID: {payment.tenantId}</p>
                  <p className="text-slate-600">Room: {payment.roomNumber}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Payment Details</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Method</span>
                    <span className="font-medium text-slate-800 capitalize">
                      {payment.paymentMethod === 'momo' ? `MoMo (${payment.momoNetwork?.toUpperCase()})` : 'Cash'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Txn Ref</span>
                    <span className="font-medium text-slate-800 font-mono text-xs mt-0.5">{payment.referenceNumber}</span>
                  </div>
                  {payment.providerRef && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Provider Ref</span>
                      <span className="font-medium text-slate-800">{payment.providerRef}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recorded By</span>
                    <span className="font-medium text-slate-800">{payment.recordedBy}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charge Details Table */}
            <div>
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-slate-500 border-y border-gray-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Description</th>
                    <th className="py-3 px-4 font-semibold">Period</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-800">{payment.categoryName}</p>
                    </td>
                    <td className="py-4 px-4 text-slate-600">{payment.billingPeriod}</td>
                    <td className="py-4 px-4 text-right font-bold text-slate-800 text-lg">
                      {formatGHS(payment.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-800">{formatGHS(payment.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fees</span>
                  <span className="font-medium text-slate-800">{formatGHS(0)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-gray-800 pt-3">
                  <span className="font-bold text-slate-800">Total Received</span>
                  <span className="font-black text-teal-700 text-xl">{formatGHS(payment.amount)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {payment.notes && (
              <div className="text-sm">
                <p className="font-semibold text-slate-800 mb-1">Notes</p>
                <p className="text-slate-600 italic">{payment.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-100 pt-8 text-center space-y-2 text-xs text-slate-400">
              <p>Thank you for your payment. Please keep this receipt for your records.</p>
              <p>Generated by DwellBase Property Management System</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
