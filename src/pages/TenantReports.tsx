import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ReceiptModal from '../components/ReceiptModal';
import { useAppData } from '../context/AppDataContext';
import type { PaymentRecord } from '../context/AppDataContext';
import {
  formatReadableDate,
  formatGHS,
  printReportDocument
} from '../utils/reportUtils';
import {
  Search, Download, Printer, CheckCircle2, Clock,
  FileText, CreditCard, Home, Receipt, X, Eye,
  ShieldCheck, AlertCircle
} from 'lucide-react';

type TenantTab = 'payments' | 'bills' | 'tenancy' | 'receipts';

const TenantReports = () => {
  const {
    tenants, charges, payments, landlordProfile,
    getTenantOutstandingBalance, getTenantTotalPaid
  } = useAppData();

  // Logged in tenant (in this demo, Kwesi Mensah or first active tenant)
  const myTenant = useMemo(() => {
    return tenants.find(t => t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming') || null;
  }, [tenants]);

  // Tab State
  const [activeTab, setActiveTab] = useState<TenantTab>('payments');

  // Instant Search State
  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearchQuery.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [rawSearchQuery]);

  // Modal State
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentRecord | null>(null);

  // Scoped Data (Strict isolation to logged in tenant only!)
  const myCharges = useMemo(() => {
    if (!myTenant) return [];
    return charges.filter(c => c.tenantId === myTenant.id);
  }, [charges, myTenant]);

  const myPayments = useMemo(() => {
    if (!myTenant) return [];
    return payments.filter(p => p.tenantId === myTenant.id);
  }, [payments, myTenant]);

  const myReceipts = useMemo(() => {
    return myPayments.filter(p => p.status === 'successful' && p.receiptNumber);
  }, [myPayments]);

  const totalPaid = myTenant ? getTenantTotalPaid(myTenant.id) : 0;
  const outstandingBalance = myTenant ? getTenantOutstandingBalance(myTenant.id) : 0;

  // ── Instant Search Results ───────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!debouncedSearch || !myTenant) return [];
    const q = debouncedSearch;
    const results: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      date: string;
      amount?: string;
      status: string;
      onClick: () => void;
    }> = [];

    // Search my payments
    myPayments.forEach(p => {
      const match =
        p.referenceNumber.toLowerCase().includes(q) ||
        (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.billingPeriod.toLowerCase().includes(q);

      if (match) {
        if (p.receiptNumber) {
          results.push({
            id: `rec-${p.id}`,
            type: 'Receipt',
            title: `Receipt ${p.receiptNumber}`,
            subtitle: `${p.categoryName} • ${p.billingPeriod}`,
            date: formatReadableDate(p.paymentDate),
            amount: formatGHS(p.amount),
            status: p.status,
            onClick: () => setSelectedReceiptPayment(p),
          });
        }
        results.push({
          id: `pay-${p.id}`,
          type: 'Payment',
          title: `Ref: ${p.referenceNumber}`,
          subtitle: `${p.categoryName} (${p.paymentMethod.toUpperCase()})`,
          date: formatReadableDate(p.paymentDate),
          amount: formatGHS(p.amount),
          status: p.status,
          onClick: () => {
            if (p.receiptNumber) setSelectedReceiptPayment(p);
            else setActiveTab('payments');
          },
        });
      }
    });

    // Search my bills
    myCharges.forEach(c => {
      const match =
        c.categoryName.toLowerCase().includes(q) ||
        c.billingPeriod.toLowerCase().includes(q);

      if (match) {
        results.push({
          id: `chg-${c.id}`,
          type: 'Bill',
          title: `${c.categoryName} (${c.billingPeriod})`,
          subtitle: `Due: ${formatReadableDate(c.dueDate)}`,
          date: formatReadableDate(c.issueDate),
          amount: `Balance: ${formatGHS(c.remainingBalance)} / ${formatGHS(c.amount)}`,
          status: c.status,
          onClick: () => setActiveTab('bills'),
        });
      }
    });

    return results;
  }, [debouncedSearch, myPayments, myCharges, myTenant]);

  // ── PDF Document Generators ──────────────────────────────────────────────────
  const downloadPaymentPDF = () => {
    if (!myTenant) return;
    const html = `
      <div class="report-heading">Personal Payment History</div>
      <div class="report-sub">Tenant: ${myTenant.fullName} (${myTenant.tenantId}) • Room ${myTenant.roomNumber}</div>
      <div class="summary-grid">
        <div class="summary-card"><div class="summary-title">Total Paid</div><div class="summary-val" style="color:#047857;">${formatGHS(totalPaid)}</div></div>
        <div class="summary-card"><div class="summary-title">Outstanding Balance</div><div class="summary-val" style="color:#b91c1c;">${formatGHS(outstandingBalance)}</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference #</th>
            <th>Category</th>
            <th>Method</th>
            <th class="text-right">Amount</th>
            <th class="text-center">Status</th>
            <th>Receipt #</th>
          </tr>
        </thead>
        <tbody>
          ${myPayments.map(p => `
            <tr>
              <td>${formatReadableDate(p.paymentDate)}</td>
              <td class="font-mono">${p.referenceNumber}</td>
              <td class="font-bold">${p.categoryName}</td>
              <td style="text-transform: uppercase;">${p.paymentMethod}</td>
              <td class="text-right font-bold">${formatGHS(p.amount)}</td>
              <td class="text-center"><span class="badge ${p.status === 'successful' ? 'badge-success' : 'badge-pending'}">${p.status}</span></td>
              <td class="font-mono">${p.receiptNumber || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Payment History - ${myTenant.fullName}`, html);
  };

  const downloadBillsPDF = () => {
    if (!myTenant) return;
    const html = `
      <div class="report-heading">My Issued Bills & Charges</div>
      <div class="report-sub">Tenant: ${myTenant.fullName} (${myTenant.tenantId}) • Room ${myTenant.roomNumber}</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Period</th>
            <th>Due Date</th>
            <th class="text-right">Original Amount</th>
            <th class="text-right">Paid</th>
            <th class="text-right">Balance</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${myCharges.map(c => `
            <tr>
              <td class="font-bold">${c.categoryName}</td>
              <td>${c.billingPeriod}</td>
              <td>${formatReadableDate(c.dueDate)}</td>
              <td class="text-right">${formatGHS(c.amount)}</td>
              <td class="text-right" style="color:#047857;">${formatGHS(c.amountPaid)}</td>
              <td class="text-right font-bold" style="color:${c.remainingBalance > 0 ? '#b91c1c' : '#334155'};">${formatGHS(c.remainingBalance)}</td>
              <td class="text-center"><span class="badge ${c.status === 'paid' ? 'badge-success' : c.status === 'overdue' ? 'badge-overdue' : 'badge-pending'}">${c.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Bills - ${myTenant.fullName}`, html);
  };

  const downloadTenancyPDF = () => {
    if (!myTenant) return;
    const html = `
      <div class="report-heading">Tenancy Agreement & Allocation History</div>
      <div class="report-sub">Tenant: ${myTenant.fullName} (${myTenant.tenantId})</div>
      <table>
        <thead>
          <tr>
            <th>Assigned Room</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th class="text-right">Monthly Rent</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">${myTenant.roomNumber}</td>
            <td>${formatReadableDate(myTenant.startDate)}</td>
            <td>${formatReadableDate(myTenant.endDate)}</td>
            <td class="text-right font-bold">${formatGHS(myTenant.monthlyRent)}</td>
            <td class="text-center"><span class="badge badge-success">${myTenant.tenancyStatus}</span></td>
          </tr>
        </tbody>
      </table>
    `;
    printReportDocument(`Tenancy History - ${myTenant.fullName}`, html);
  };

  const downloadCompletePersonalPDF = () => {
    if (!myTenant) return;
    const html = `
      <div style="text-align: center; padding: 20px; border-bottom: 2px solid #0f172a; margin-bottom: 25px;">
        <h1 style="font-size: 24px; margin: 0; color: #0f172a;">PERSONAL TENANCY & FINANCIAL STATEMENT</h1>
        <p style="color: #0d9488; font-weight: 700; margin: 4px 0;">DWELLBASE TENANT PORTAL</p>
        <p style="font-size: 13px; color: #64748b;">Tenant: ${myTenant.fullName} • ID: ${myTenant.tenantId} • Room: ${myTenant.roomNumber}</p>
      </div>

      <div class="summary-grid">
        <div class="summary-card"><div class="summary-title">Total Paid to Date</div><div class="summary-val" style="color:#047857;">${formatGHS(totalPaid)}</div></div>
        <div class="summary-card"><div class="summary-title">Current Outstanding Balance</div><div class="summary-val" style="color:#b91c1c;">${formatGHS(outstandingBalance)}</div></div>
      </div>

      <h3 style="margin-top: 20px;">1. Tenancy Overview</h3>
      <p style="font-size: 13px;">Room <strong>${myTenant.roomNumber}</strong> • Contract: ${formatReadableDate(myTenant.startDate)} to ${formatReadableDate(myTenant.endDate)} • Monthly Rent: ${formatGHS(myTenant.monthlyRent)}</p>

      <h3 style="margin-top: 25px;">2. All Issued Bills</h3>
      <table>
        <thead><tr><th>Category</th><th>Period</th><th>Due Date</th><th class="text-right">Amount</th><th class="text-right">Paid</th><th class="text-right">Balance</th><th>Status</th></tr></thead>
        <tbody>
          ${myCharges.map(c => `
            <tr>
              <td>${c.categoryName}</td><td>${c.billingPeriod}</td><td>${formatReadableDate(c.dueDate)}</td>
              <td class="text-right">${formatGHS(c.amount)}</td><td class="text-right">${formatGHS(c.amountPaid)}</td>
              <td class="text-right font-bold">${formatGHS(c.remainingBalance)}</td><td>${c.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3 style="margin-top: 25px;">3. Confirmed Payment Receipts</h3>
      <table>
        <thead><tr><th>Date</th><th>Receipt #</th><th>Reference #</th><th>Category</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          ${myReceipts.map(r => `
            <tr>
              <td>${formatReadableDate(r.paymentDate)}</td>
              <td class="font-mono font-bold">${r.receiptNumber}</td>
              <td class="font-mono">${r.referenceNumber}</td>
              <td>${r.categoryName}</td>
              <td class="text-right font-bold" style="color:#047857;">${formatGHS(r.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Personal Statement - ${myTenant.fullName}`, html);
  };

  const printCurrentTab = () => {
    if (activeTab === 'payments') downloadPaymentPDF();
    else if (activeTab === 'bills') downloadBillsPDF();
    else if (activeTab === 'tenancy') downloadTenancyPDF();
    else if (activeTab === 'receipts') downloadCompletePersonalPDF();
  };

  if (!myTenant) {
    return (
      <DashboardLayout userType="tenant" userName="Tenant Portal">
        <div className="max-w-4xl mx-auto py-12 text-center bg-white rounded-2xl border border-gray-100 p-8">
          <AlertCircle className="w-12 h-12 text-teal-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800">No active tenancy record found</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Your landlord has not yet associated your account with an active room or tenancy contract.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userType="tenant" userName={myTenant.fullName} tenantId={myTenant.id}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">History & Reports</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Review your personal payment transactions, bills, tenancy records, and receipts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadCompletePersonalPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white hover:bg-navy-800 rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-teal-400" />
              Download Personal Statement PDF
            </button>
            <button
              onClick={printCurrentTab}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-slate-700 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Print Report
            </button>
          </div>
        </div>

        {/* ── Instant Search ───────────────────────────────────────────────── */}
        <div className="relative">
          <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search your payments, bills, and receipts…"
              value={rawSearchQuery}
              onChange={(e) => setRawSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 bg-transparent rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none text-sm sm:text-base"
            />
            {rawSearchQuery && (
              <button
                onClick={() => setRawSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {debouncedSearch && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-80 overflow-y-auto divide-y divide-gray-100">
              <div className="p-3 bg-gray-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Matching Personal Records ({searchResults.length})
              </div>
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">
                  No matching personal records found.
                </div>
              ) : (
                searchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick();
                      setRawSearchQuery('');
                    }}
                    className="w-full p-4 text-left hover:bg-teal-50/50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-navy-100 text-navy-800">
                          {item.type}
                        </span>
                        <strong className="text-slate-800">{item.title}</strong>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.amount && <p className="font-bold text-slate-800 text-sm">{item.amount}</p>}
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-slate-600">
                        {item.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Tenant Summary Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Total Paid</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{formatGHS(totalPaid)}</h3>
              <p className="text-xs text-slate-400 mt-1">Confirmed successful payments only</p>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Outstanding Balance</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{formatGHS(outstandingBalance)}</h3>
              <p className="text-xs text-slate-400 mt-1">Unpaid balances on issued bills only</p>
            </div>
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation ──────────────────────────────────────────────── */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 sm:space-x-8">
            {[
              { id: 'payments', label: 'Payment History', icon: CreditCard, count: myPayments.length },
              { id: 'bills', label: 'My Bills', icon: FileText, count: myCharges.length },
              { id: 'tenancy', label: 'Tenancy History', icon: Home, count: undefined },
              { id: 'receipts', label: 'My Receipts', icon: Receipt, count: myReceipts.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TenantTab)}
                  className={`
                    flex items-center gap-2 py-3 px-2 border-b-2 font-bold text-sm whitespace-nowrap transition-colors
                    ${isActive
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-gray-300'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-slate-600'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── TAB 1: PAYMENT HISTORY ───────────────────────────────────────── */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Your Transaction Records</h2>
              <button
                onClick={downloadPaymentPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Payment History PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Payment Date</th>
                      <th className="px-6 py-3.5">Reference #</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Payment Method</th>
                      <th className="px-6 py-3.5 text-right">Amount</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          No payment transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      myPayments.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                            {formatReadableDate(p.paymentDate)}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-700">
                            {p.referenceNumber}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {p.categoryName}
                          </td>
                          <td className="px-6 py-4 text-xs uppercase">
                            {p.paymentMethod} {p.momoNetwork && `(${p.momoNetwork})`}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            {formatGHS(p.amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === 'successful' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              p.status === 'pending' || p.status === 'processing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {p.status === 'pending' ? 'Awaiting Verification' : p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {p.status === 'successful' && (
                              <button
                                onClick={() => setSelectedReceiptPayment(p)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MY BILLS ──────────────────────────────────────────────── */}
        {activeTab === 'bills' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Issued Bills & Charges</h2>
              <button
                onClick={downloadBillsPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download My Bills PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Billing Period</th>
                      <th className="px-6 py-3.5">Issue Date</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5 text-right">Original Amount</th>
                      <th className="px-6 py-3.5 text-right">Confirmed Paid</th>
                      <th className="px-6 py-3.5 text-right">Remaining Balance</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myCharges.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                          No bills have been issued to your account.
                        </td>
                      </tr>
                    ) : (
                      myCharges.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {c.categoryName}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {c.billingPeriod}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {formatReadableDate(c.issueDate)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {formatReadableDate(c.dueDate)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700">
                            {formatGHS(c.amount)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600">
                            {formatGHS(c.amountPaid)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold">
                            <span className={c.remainingBalance > 0 ? 'text-rose-600' : 'text-slate-700'}>
                              {formatGHS(c.remainingBalance)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              c.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              c.status === 'overdue' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: TENANCY HISTORY ───────────────────────────────────────── */}
        {activeTab === 'tenancy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Your Tenancy Agreement & History</h2>
              <button
                onClick={downloadTenancyPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Tenancy History PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Assigned Room</span>
                  <p className="text-lg font-bold text-slate-800 mt-1">{myTenant.roomNumber}</p>
                  <span className="text-xs text-slate-400">Room Code: {myTenant.roomCode}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Monthly Rent</span>
                  <p className="text-lg font-bold text-teal-600 mt-1">{formatGHS(myTenant.monthlyRent)}</p>
                  <span className="text-xs text-slate-400">Per agreed tenancy contract</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Start Date</span>
                  <p className="text-lg font-bold text-slate-800 mt-1">{formatReadableDate(myTenant.startDate)}</p>
                  <span className="text-xs text-slate-400">{myTenant.durationMonths} months duration</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">End Date</span>
                  <p className="text-lg font-bold text-slate-800 mt-1">{formatReadableDate(myTenant.endDate)}</p>
                  <span className="text-xs text-slate-400">Status: {myTenant.tenancyStatus}</span>
                </div>
              </div>

              <div className="p-4 bg-navy-50 rounded-xl border border-navy-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-navy-900 block mb-0.5">Privacy & Record Integrity Guarantee:</strong>
                  Your personal records, room assignment history, and payments are permanently preserved in your personal account under DwellBase regulations.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: MY RECEIPTS ───────────────────────────────────────────── */}
        {activeTab === 'receipts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Confirmed Payment Receipts</h2>
              <button
                onClick={downloadCompletePersonalPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Complete Personal Statement
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Receipt #</th>
                      <th className="px-6 py-3.5">Payment Date</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Reference #</th>
                      <th className="px-6 py-3.5 text-right">Amount</th>
                      <th className="px-6 py-3.5 text-right">Receipt Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          No confirmed receipts available yet.
                        </td>
                      </tr>
                    ) : (
                      myReceipts.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-mono font-bold text-teal-700">
                            {r.receiptNumber}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {formatReadableDate(r.paymentDate)}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {r.categoryName}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                            {r.referenceNumber}
                          </td>
                          <td className="px-6 py-4 text-right font-extrabold text-slate-900">
                            {formatGHS(r.amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedReceiptPayment(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> View / Print Receipt
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RECEIPT MODAL ────────────────────────────────────────────────── */}
        {selectedReceiptPayment && (
          <ReceiptModal
            payment={selectedReceiptPayment}
            onClose={() => setSelectedReceiptPayment(null)}
            landlordName={landlordProfile.propertyName}
          />
        )}

      </div>
    </DashboardLayout>
  );
};

export default TenantReports;
