import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ReceiptModal from '../components/ReceiptModal';
import { useAppData } from '../context/AppDataContext';
import type { PaymentRecord, Charge, Tenant } from '../context/AppDataContext';
import {
  formatReadableDate,
  formatReadableDateRange,
  formatGHS,
  getDatePresetRange,
  printReportDocument
} from '../utils/reportUtils';
import {
  Search, Filter, Download, Printer,
  CheckCircle2, Clock, AlertTriangle, FileText,
  DollarSign, Users, DoorOpen, CreditCard,
  X, Eye, History, Edit3,
  RotateCcw, AlertCircle
} from 'lucide-react';

type ReportTab = 'financial' | 'payments' | 'tenants' | 'bills' | 'rooms' | 'former_tenants';

const AdminReports = () => {
  const {
    tenants, rooms, charges, payments, categories, auditLogs,
    landlordProfile, recordCorrection, reversePayment
  } = useAppData();

  // ── Tab State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ReportTab>('financial');

  // ── Global Instant Search ────────────────────────────────────────────────────
  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearchQuery.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [rawSearchQuery]);

  // ── Date Filters ─────────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<string>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');

  // ── Additional Filters ───────────────────────────────────────────────────────
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── Modals State ─────────────────────────────────────────────────────────────
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentRecord | null>(null);
  const [historicalTenant, setHistoricalTenant] = useState<Tenant | null>(null);
  
  // Correction modal
  const [correctingCharge, setCorrectingCharge] = useState<Charge | null>(null);
  const [correctionNewAmount, setCorrectionNewAmount] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  
  // Reversal modal
  const [reversingPayment, setReversingPayment] = useState<PaymentRecord | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  // Compute effective date range
  const { startDate, endDate } = useMemo(() => {
    if (datePreset === 'custom') {
      if (customStartDate && customEndDate && customEndDate < customStartDate) {
        setDateError('End date cannot be earlier than start date.');
      } else {
        setDateError('');
      }
      return { startDate: customStartDate, endDate: customEndDate };
    }
    setDateError('');
    return getDatePresetRange(datePreset);
  }, [datePreset, customStartDate, customEndDate]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== 'all') count++;
    if (tenantFilter !== 'all') count++;
    if (roomFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (methodFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    return count;
  }, [datePreset, tenantFilter, roomFilter, categoryFilter, methodFilter, statusFilter]);

  const clearAllFilters = () => {
    setDatePreset('this_month');
    setCustomStartDate('');
    setCustomEndDate('');
    setTenantFilter('all');
    setRoomFilter('all');
    setCategoryFilter('all');
    setMethodFilter('all');
    setStatusFilter('all');
    setDateError('');
  };

  // Helper date checker
  const isDateInRange = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // ── Filtered Data ────────────────────────────────────────────────────────────

  // 1. Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (!isDateInRange(p.paymentDate)) return false;
      if (tenantFilter !== 'all' && p.tenantId !== tenantFilter) return false;
      if (roomFilter !== 'all' && p.roomId !== roomFilter) return false;
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [payments, startDate, endDate, tenantFilter, roomFilter, categoryFilter, methodFilter, statusFilter]);

  // 2. Charges
  const filteredCharges = useMemo(() => {
    return charges.filter(c => {
      if (!isDateInRange(c.issueDate)) return false;
      if (tenantFilter !== 'all' && c.tenantId !== tenantFilter) return false;
      if (roomFilter !== 'all' && c.roomId !== roomFilter) return false;
      if (categoryFilter !== 'all' && c.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [charges, startDate, endDate, tenantFilter, roomFilter, categoryFilter, statusFilter]);

  // 3. Tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      if (tenantFilter !== 'all' && t.id !== tenantFilter) return false;
      if (roomFilter !== 'all' && t.roomId !== roomFilter) return false;
      if (statusFilter !== 'all' && t.tenancyStatus !== statusFilter) return false;
      return true;
    });
  }, [tenants, tenantFilter, roomFilter, statusFilter]);

  // 4. Former Tenants
  const formerTenants = useMemo(() => {
    return tenants.filter(t => t.tenancyStatus === 'Ended');
  }, [tenants]);

  // ── Summary Cards Calculations ───────────────────────────────────────────────
  // Confirmed collections: only confirmed/successful within reporting period
  const confirmedCollections = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'successful')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  // Outstanding charges: unpaid portion of actual issued charges within reporting period
  const outstandingChargesTotal = useMemo(() => {
    return filteredCharges
      .filter(c => c.status !== 'paid')
      .reduce((sum, c) => sum + c.remainingBalance, 0);
  }, [filteredCharges]);

  // Overdue charges: overdue charges within reporting period
  const overdueChargesTotal = useMemo(() => {
    return filteredCharges
      .filter(c => c.status === 'overdue')
      .reduce((sum, c) => sum + c.remainingBalance, 0);
  }, [filteredCharges]);

  // Awaiting verification: manual momo submissions awaiting confirmation
  const awaitingVerificationTotal = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  // Total charges issued
  const totalChargesIssued = useMemo(() => {
    return filteredCharges.reduce((sum, c) => sum + c.amount, 0);
  }, [filteredCharges]);

  // Collections by category
  const categoryCollections = useMemo(() => {
    const map: Record<string, { name: string; charged: number; collected: number; balance: number }> = {};
    categories.forEach(cat => {
      map[cat.id] = { name: cat.name, charged: 0, collected: 0, balance: 0 };
    });

    filteredCharges.forEach(c => {
      if (!map[c.categoryId]) {
        map[c.categoryId] = { name: c.categoryName, charged: 0, collected: 0, balance: 0 };
      }
      map[c.categoryId].charged += c.amount;
      map[c.categoryId].balance += c.remainingBalance;
    });

    filteredPayments.filter(p => p.status === 'successful').forEach(p => {
      if (!map[p.categoryId]) {
        map[p.categoryId] = { name: p.categoryName, charged: 0, collected: 0, balance: 0 };
      }
      map[p.categoryId].collected += p.amount;
    });

    return Object.values(map);
  }, [categories, filteredCharges, filteredPayments]);

  // Reversed payments
  const reversedPaymentsTotal = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'reversed')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  // Failed payments
  const failedPaymentsTotal = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'failed')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  // ── Global Instant Search Results ───────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!debouncedSearch) return [];
    const q = debouncedSearch;
    const results: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      date: string;
      amount?: string;
      status: string;
      raw: any;
      onClick: () => void;
    }> = [];

    // Search payments & receipts
    payments.forEach(p => {
      const match =
        p.referenceNumber.toLowerCase().includes(q) ||
        (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)) ||
        p.tenantName.toLowerCase().includes(q) ||
        p.roomNumber.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q);

      if (match) {
        if (p.receiptNumber) {
          results.push({
            id: `rec-${p.id}`,
            type: 'Receipt',
            title: `Receipt ${p.receiptNumber}`,
            subtitle: `${p.tenantName} • Room ${p.roomNumber} (${p.categoryName})`,
            date: formatReadableDate(p.paymentDate),
            amount: formatGHS(p.amount),
            status: p.status,
            raw: p,
            onClick: () => setSelectedReceiptPayment(p),
          });
        }
        results.push({
          id: `pay-${p.id}`,
          type: 'Payment',
          title: `Payment Ref ${p.referenceNumber}`,
          subtitle: `${p.tenantName} • ${p.categoryName} (${p.paymentMethod.toUpperCase()})`,
          date: formatReadableDate(p.paymentDate),
          amount: formatGHS(p.amount),
          status: p.status,
          raw: p,
          onClick: () => {
            if (p.receiptNumber) setSelectedReceiptPayment(p);
            else setActiveTab('payments');
          },
        });
      }
    });

    // Search tenants
    tenants.forEach(t => {
      const match =
        t.fullName.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q) ||
        t.phone.includes(q) ||
        t.roomNumber.toLowerCase().includes(q);

      if (match) {
        const isFormer = t.tenancyStatus === 'Ended';
        results.push({
          id: `tent-${t.id}`,
          type: isFormer ? 'Former Tenant' : 'Tenant',
          title: t.fullName,
          subtitle: `${t.tenantId} • ${t.roomNumber} • ${t.phone}`,
          date: `${formatReadableDate(t.startDate)} – ${formatReadableDate(t.endDate)}`,
          amount: `Balance: ${formatGHS(t.outstandingBalance)}`,
          status: t.tenancyStatus,
          raw: t,
          onClick: () => setHistoricalTenant(t),
        });
      }
    });

    // Search charges/bills
    charges.forEach(c => {
      const match =
        c.categoryName.toLowerCase().includes(q) ||
        c.tenantName.toLowerCase().includes(q) ||
        c.roomNumber.toLowerCase().includes(q) ||
        c.billingPeriod.toLowerCase().includes(q);

      if (match) {
        results.push({
          id: `chg-${c.id}`,
          type: `${c.categoryName} Charge`,
          title: `${c.categoryName} (${c.billingPeriod})`,
          subtitle: `${c.tenantName} • Room ${c.roomNumber}`,
          date: `Due: ${formatReadableDate(c.dueDate)}`,
          amount: `Rem: ${formatGHS(c.remainingBalance)} / ${formatGHS(c.amount)}`,
          status: c.status,
          raw: c,
          onClick: () => setActiveTab('bills'),
        });
      }
    });

    // Search rooms
    rooms.forEach(r => {
      if (r.roomNumber.toLowerCase().includes(q) || r.roomCode.toLowerCase().includes(q)) {
        results.push({
          id: `room-${r.id}`,
          type: 'Room Record',
          title: r.roomNumber,
          subtitle: `Monthly Rent: ${formatGHS(r.monthlyRent)}`,
          date: formatReadableDate(r.createdAt),
          status: r.status,
          raw: r,
          onClick: () => setActiveTab('rooms'),
        });
      }
    });

    return results;
  }, [debouncedSearch, payments, tenants, charges, rooms]);

  // ── Traceable Correction Handler ─────────────────────────────────────────────
  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingCharge) return;
    const val = parseFloat(correctionNewAmount);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    if (!correctionReason.trim()) {
      alert('Please provide a reason for the traceable correction.');
      return;
    }
    recordCorrection(correctingCharge.id, val, correctionReason, landlordProfile.fullName);
    setCorrectingCharge(null);
    setCorrectionNewAmount('');
    setCorrectionReason('');
  };

  // ── Traceable Reversal Handler ───────────────────────────────────────────────
  const handleSaveReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment) return;
    if (!reversalReason.trim()) {
      alert('Please provide a reason for the reversal.');
      return;
    }
    reversePayment(reversingPayment.id, reversalReason, landlordProfile.fullName);
    setReversingPayment(null);
    setReversalReason('');
  };

  // ── PDF Document Generators ──────────────────────────────────────────────────
  const periodLabel = formatReadableDateRange(startDate, endDate);

  const printCurrentTab = () => {
    if (activeTab === 'financial') downloadFinancialPDF();
    else if (activeTab === 'payments') downloadPaymentPDF();
    else if (activeTab === 'tenants') downloadTenantReportPDF();
    else if (activeTab === 'bills') downloadBillsReportPDF();
    else if (activeTab === 'rooms') downloadRoomReportPDF();
    else if (activeTab === 'former_tenants') downloadFormerTenantsPDF();
  };

  const downloadFinancialPDF = () => {
    const html = `
      <div class="report-heading">Financial Summary Report</div>
      <div class="report-sub">Reporting Period: ${periodLabel}</div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-title">Confirmed Collections</div>
          <div class="summary-val">${formatGHS(confirmedCollections)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Outstanding Charges</div>
          <div class="summary-val">${formatGHS(outstandingChargesTotal)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Overdue Charges</div>
          <div class="summary-val" style="color: #b91c1c;">${formatGHS(overdueChargesTotal)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">Awaiting Verification</div>
          <div class="summary-val" style="color: #b45309;">${formatGHS(awaitingVerificationTotal)}</div>
        </div>
      </div>

      <h3 style="margin-top: 20px; font-size: 15px; font-weight: 700;">Financial Metrics Overview</h3>
      <table>
        <thead>
          <tr>
            <th>Metric Item</th>
            <th class="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Total Charges Issued</td><td class="text-right font-bold">${formatGHS(totalChargesIssued)}</td></tr>
          <tr><td>Successfully Confirmed Collections</td><td class="text-right font-bold" style="color:#047857;">${formatGHS(confirmedCollections)}</td></tr>
          <tr><td>Remaining Outstanding Balances</td><td class="text-right">${formatGHS(outstandingChargesTotal)}</td></tr>
          <tr><td>Total Overdue Charges</td><td class="text-right" style="color:#b91c1c;">${formatGHS(overdueChargesTotal)}</td></tr>
          <tr><td>Manual MoMo Awaiting Verification</td><td class="text-right" style="color:#b45309;">${formatGHS(awaitingVerificationTotal)}</td></tr>
          <tr><td>Reversed Payments & Refunds (Separated)</td><td class="text-right">${formatGHS(reversedPaymentsTotal)}</td></tr>
          <tr><td>Failed Payments Total</td><td class="text-right">${formatGHS(failedPaymentsTotal)}</td></tr>
          <tr><td>Total Number of Charges Issued</td><td class="text-right">${filteredCharges.length}</td></tr>
          <tr><td>Total Number of Successful Payments</td><td class="text-right">${filteredPayments.filter(p => p.status === 'successful').length}</td></tr>
        </tbody>
      </table>

      <h3 style="margin-top: 24px; font-size: 15px; font-weight: 700;">Collections by Billing Category</h3>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="text-right">Charged (GH₵)</th>
            <th class="text-right">Collected (GH₵)</th>
            <th class="text-right">Outstanding (GH₵)</th>
            <th class="text-right">Recovery Rate</th>
          </tr>
        </thead>
        <tbody>
          ${categoryCollections.map(cat => {
            const rate = cat.charged > 0 ? ((cat.collected / cat.charged) * 100).toFixed(1) : '100.0';
            return `
              <tr>
                <td class="font-bold">${cat.name}</td>
                <td class="text-right">${formatGHS(cat.charged)}</td>
                <td class="text-right font-bold" style="color:#047857;">${formatGHS(cat.collected)}</td>
                <td class="text-right">${formatGHS(cat.balance)}</td>
                <td class="text-right">${rate}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Financial Summary (${periodLabel})`, html);
  };

  const downloadPaymentPDF = () => {
    const html = `
      <div class="report-heading">Payment Transactions Report</div>
      <div class="report-sub">Reporting Period: ${periodLabel} • Total Collections: ${formatGHS(confirmedCollections)}</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref #</th>
            <th>Tenant</th>
            <th>Room</th>
            <th>Category</th>
            <th>Method</th>
            <th class="text-right">Amount</th>
            <th class="text-center">Status</th>
            <th>Receipt #</th>
          </tr>
        </thead>
        <tbody>
          ${filteredPayments.map(p => `
            <tr>
              <td>${formatReadableDate(p.paymentDate)}</td>
              <td class="font-mono">${p.referenceNumber}</td>
              <td class="font-bold">${p.tenantName}</td>
              <td>${p.roomNumber}</td>
              <td>${p.categoryName}</td>
              <td style="text-transform: uppercase;">${p.paymentMethod}${p.momoNetwork ? ` (${p.momoNetwork})` : ''}</td>
              <td class="text-right font-bold">${formatGHS(p.amount)}</td>
              <td class="text-center"><span class="badge ${p.status === 'successful' ? 'badge-success' : p.status === 'pending' ? 'badge-pending' : 'badge-overdue'}">${p.status}</span></td>
              <td class="font-mono">${p.receiptNumber || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Payment Report (${periodLabel})`, html);
  };

  const downloadTenantReportPDF = () => {
    const html = `
      <div class="report-heading">Tenant Directory & Tenancy Records</div>
      <div class="report-sub">Generated on ${formatReadableDate(new Date().toISOString().split('T')[0])}</div>
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>ID</th>
            <th>Room</th>
            <th>Tenancy Period</th>
            <th class="text-right">Monthly Rent</th>
            <th class="text-right">Total Paid</th>
            <th class="text-right">Outstanding</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${filteredTenants.map(t => `
            <tr>
              <td class="font-bold">${t.fullName}</td>
              <td class="font-mono">${t.tenantId}</td>
              <td>${t.roomNumber}</td>
              <td>${formatReadableDate(t.startDate)} – ${formatReadableDate(t.endDate)}</td>
              <td class="text-right">${formatGHS(t.monthlyRent)}</td>
              <td class="text-right font-bold" style="color:#047857;">${formatGHS(t.amountPaid)}</td>
              <td class="text-right font-bold" style="color:${t.outstandingBalance > 0 ? '#b91c1c' : '#334155'};">${formatGHS(t.outstandingBalance)}</td>
              <td class="text-center"><span class="badge ${t.tenancyStatus === 'Active' ? 'badge-success' : t.tenancyStatus === 'Ended' ? 'badge-overdue' : 'badge-info'}">${t.tenancyStatus}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Tenant Report`, html);
  };

  const downloadBillsReportPDF = () => {
    const html = `
      <div class="report-heading">Bills & Issued Charges Report</div>
      <div class="report-sub">Reporting Period: ${periodLabel} • Outstanding Balances: ${formatGHS(outstandingChargesTotal)}</div>
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Room</th>
            <th>Category</th>
            <th>Period</th>
            <th>Due Date</th>
            <th class="text-right">Original Amount</th>
            <th class="text-right">Paid</th>
            <th class="text-right">Remaining Balance</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${filteredCharges.map(c => `
            <tr>
              <td class="font-bold">${c.tenantName}</td>
              <td>${c.roomNumber}</td>
              <td>${c.categoryName}</td>
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
    printReportDocument(`Bills Report (${periodLabel})`, html);
  };

  const downloadRoomReportPDF = () => {
    const html = `
      <div class="report-heading">Room Occupancy & Historical Allocation</div>
      <div class="report-sub">Generated on ${formatReadableDate(new Date().toISOString().split('T')[0])}</div>
      <table>
        <thead>
          <tr>
            <th>Room Number</th>
            <th>Code</th>
            <th>Current Status</th>
            <th class="text-right">Monthly Rent</th>
            <th>Current Tenant</th>
            <th>Historical Tenants</th>
          </tr>
        </thead>
        <tbody>
          ${rooms.map(r => {
            const currentT = tenants.find(t => t.roomId === r.id && (t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming'));
            const pastT = tenants.filter(t => t.roomId === r.id && t.tenancyStatus === 'Ended');
            return `
              <tr>
                <td class="font-bold">${r.roomNumber}</td>
                <td class="font-mono">${r.roomCode}</td>
                <td><span class="badge ${r.status === 'Occupied' ? 'badge-success' : r.status === 'Vacant' ? 'badge-info' : 'badge-pending'}">${r.status}</span></td>
                <td class="text-right font-bold">${formatGHS(r.monthlyRent)}</td>
                <td>${currentT ? `${currentT.fullName} (${currentT.tenantId})` : 'None (Vacant)'}</td>
                <td>${pastT.length > 0 ? pastT.map(pt => `${pt.fullName} (${formatReadableDate(pt.startDate)} – ${formatReadableDate(pt.endDate)})`).join('<br/>') : 'No previous tenancies'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Room Report`, html);
  };

  const downloadFormerTenantsPDF = () => {
    const html = `
      <div class="report-heading">Former Tenants & Historical Accounts</div>
      <div class="report-sub">Debts and tenancy history preserved per application regulations</div>
      <table>
        <thead>
          <tr>
            <th>Former Tenant</th>
            <th>Tenant ID</th>
            <th>Previous Room</th>
            <th>Tenancy Period</th>
            <th>Contact</th>
            <th class="text-right">Preserved Balance</th>
          </tr>
        </thead>
        <tbody>
          ${formerTenants.map(ft => `
            <tr>
              <td class="font-bold">${ft.fullName}</td>
              <td class="font-mono">${ft.tenantId}</td>
              <td>${ft.roomNumber}</td>
              <td>${formatReadableDate(ft.startDate)} – ${formatReadableDate(ft.endDate)}</td>
              <td>${ft.phone} • ${ft.email}</td>
              <td class="text-right font-bold" style="color:${ft.outstandingBalance > 0 ? '#b91c1c' : '#334155'};">${formatGHS(ft.outstandingBalance)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Former Tenants Report`, html);
  };

  const downloadCombinedReportPDF = () => {
    const html = `
      <div style="text-align: center; padding: 40px 20px; border-bottom: 2px solid #0f172a; margin-bottom: 30px;">
        <h1 style="font-size: 28px; margin: 0; color: #0f172a;">DWELLBASE COMPREHENSIVE PROPERTY REPORT</h1>
        <p style="color: #0d9488; font-weight: 700; margin: 8px 0; letter-spacing: 1px;">PROPERTY MANAGEMENT MADE SIMPLE</p>
        <p style="color: #64748b; font-size: 13px;">Property: ${landlordProfile.propertyName} • Landlord: ${landlordProfile.fullName}</p>
        <p style="color: #0f172a; font-size: 14px; font-weight: 600; margin-top: 15px;">Reporting Period: ${periodLabel}</p>
      </div>

      <h2 style="font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">SECTION 1: FINANCIAL OVERVIEW</h2>
      <div class="summary-grid">
        <div class="summary-card"><div class="summary-title">Confirmed Collections</div><div class="summary-val">${formatGHS(confirmedCollections)}</div></div>
        <div class="summary-card"><div class="summary-title">Outstanding Balances</div><div class="summary-val">${formatGHS(outstandingChargesTotal)}</div></div>
        <div class="summary-card"><div class="summary-title">Overdue Charges</div><div class="summary-val" style="color: #b91c1c;">${formatGHS(overdueChargesTotal)}</div></div>
        <div class="summary-card"><div class="summary-title">Awaiting Verification</div><div class="summary-val" style="color: #b45309;">${formatGHS(awaitingVerificationTotal)}</div></div>
      </div>

      <div class="page-break"></div>
      <h2 style="font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">SECTION 2: RECENT PAYMENT TRANSACTIONS</h2>
      <table>
        <thead><tr><th>Date</th><th>Ref</th><th>Tenant</th><th>Room</th><th>Category</th><th class="text-right">Amount</th><th>Status</th><th>Receipt #</th></tr></thead>
        <tbody>
          ${filteredPayments.map(p => `
            <tr>
              <td>${formatReadableDate(p.paymentDate)}</td>
              <td class="font-mono">${p.referenceNumber}</td>
              <td class="font-bold">${p.tenantName}</td>
              <td>${p.roomNumber}</td>
              <td>${p.categoryName}</td>
              <td class="text-right font-bold">${formatGHS(p.amount)}</td>
              <td>${p.status}</td>
              <td class="font-mono">${p.receiptNumber || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="page-break"></div>
      <h2 style="font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">SECTION 3: TENANTS & CHARGES DIRECTORY</h2>
      <table>
        <thead><tr><th>Tenant</th><th>ID</th><th>Room</th><th>Agreed Rent</th><th class="text-right">Paid</th><th class="text-right">Remaining Balance</th><th>Status</th></tr></thead>
        <tbody>
          ${filteredTenants.map(t => `
            <tr>
              <td class="font-bold">${t.fullName}</td>
              <td class="font-mono">${t.tenantId}</td>
              <td>${t.roomNumber}</td>
              <td>${formatGHS(t.monthlyRent)}/mo</td>
              <td class="text-right">${formatGHS(t.amountPaid)}</td>
              <td class="text-right font-bold" style="color:${t.outstandingBalance > 0 ? '#b91c1c' : '#334155'};">${formatGHS(t.outstandingBalance)}</td>
              <td>${t.tenancyStatus}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="page-break"></div>
      <h2 style="font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">SECTION 4: AUDIT TRAIL APPENDIX</h2>
      <table>
        <thead><tr><th>Timestamp</th><th>Actor</th><th>Field / Entity</th><th>Original Value</th><th>Corrected Value</th><th>Reason</th></tr></thead>
        <tbody>
          ${auditLogs.map(a => `
            <tr>
              <td>${formatReadableDate(a.timestamp)}</td>
              <td class="font-bold">${a.actor}</td>
              <td>${a.entityType.toUpperCase()}: ${a.field}</td>
              <td style="color:#64748b;">${a.originalValue}</td>
              <td class="font-bold" style="color:#047857;">${a.correctedValue}</td>
              <td>${a.reason}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printReportDocument(`Comprehensive Report (${periodLabel})`, html);
  };

  return (
    <DashboardLayout userType="landlord" userName={landlordProfile.fullName}>
      <div className="max-w-7xl mx-auto space-y-6 print:p-0">

        {/* ── Top Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">History & Reports</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">Review financial activity, tenancy records, bills, and historical reports.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadCombinedReportPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white hover:bg-navy-800 rounded-xl font-medium text-sm transition-colors shadow-sm"
              title="Download full 5-section combined PDF with audit appendix"
            >
              <Download className="w-4 h-4 text-teal-400" />
              Download Combined PDF
            </button>
            <button
              onClick={printCurrentTab}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-slate-700 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors shadow-sm"
              title="Open print view for currently active report"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Print Report
            </button>
          </div>
        </div>

        {/* ── Global Instant Search Bar ─────────────────────────────────────── */}
        <div className="relative">
          <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search payments, tenants, rooms, bills, receipts…"
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

          {/* Instant Search Dropdown Results */}
          {debouncedSearch && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-96 overflow-y-auto divide-y divide-gray-100">
              <div className="p-3 bg-gray-50 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Matching Records ({searchResults.length})</span>
                <span>Select to open details</span>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No matching records found.</p>
                  <p className="text-xs text-slate-400 mt-1">Try searching by tenant name, room number, reference, or receipt number.</p>
                </div>
              ) : (
                searchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick();
                      setRawSearchQuery('');
                    }}
                    className="w-full p-4 text-left hover:bg-teal-50/50 transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-navy-100 text-navy-800">
                          {item.type}
                        </span>
                        <span className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.subtitle}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.amount && <p className="font-bold text-slate-800 text-sm">{item.amount}</p>}
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-slate-600">
                        {item.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Summary Cards (Landlord) ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* A. Confirmed Collections */}
          <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Confirmed Collections</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{formatGHS(confirmedCollections)}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-gray-50">
              Non-reversed confirmed payments in period
            </p>
          </div>

          {/* B. Outstanding Charges */}
          <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Outstanding Charges</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{formatGHS(outstandingChargesTotal)}</h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-gray-50">
              Unpaid balance on issued charges
            </p>
          </div>

          {/* C. Overdue Charges */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Overdue Charges</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-2">{formatGHS(overdueChargesTotal)}</h3>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-gray-50">
              Charges past due date + grace period
            </p>
          </div>

          {/* D. Awaiting Verification */}
          <div className="bg-white rounded-2xl p-5 border border-teal-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Awaiting Verification</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{formatGHS(awaitingVerificationTotal)}</h3>
              </div>
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-gray-50">
              Manual Mobile Money pending landlord check
            </p>
          </div>
        </div>

        {/* ── Landlord Report Filters Bar ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-teal-600" />
              <span className="font-bold text-slate-800 text-sm">Report Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                Reporting Period: <strong className="text-slate-800">{periodLabel}</strong>
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {dateError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2 border border-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {dateError}
            </div>
          )}

          {/* Filter Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Date Preset */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date Preset</label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="today">Today</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
                <option value="custom">Custom Date Range</option>
                <option value="all">All Dates</option>
              </select>
            </div>

            {/* Custom Date Range Start */}
            {datePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </>
            )}

            {/* Tenant Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tenant</label>
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Tenants</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.fullName} ({t.tenantId})</option>
                ))}
              </select>
            </div>

            {/* Room Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Room</label>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Rooms</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.roomNumber}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Charge Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="momo">Mobile Money</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="successful">Confirmed / Successful</option>
                <option value="pending">Pending / Awaiting</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Visual Charts Section (Collection Trends & Category Breakdown) ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart A: Category Breakdown Comparison */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Charge Category Breakdown</h3>
                  <p className="text-xs text-slate-400">Comparing total charged vs actual confirmed collections</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-navy-800 inline-block" /> Charged</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500 inline-block" /> Collected</span>
                </div>
              </div>

              {categoryCollections.length === 0 || categoryCollections.every(c => c.charged === 0 && c.collected === 0) ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-xs">No charge category records for the selected filters.</p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {categoryCollections.map(cat => {
                    const max = Math.max(...categoryCollections.map(c => Math.max(c.charged, c.collected)), 1);
                    const chargedWidth = (cat.charged / max) * 100;
                    const collectedWidth = (cat.collected / max) * 100;
                    return (
                      <div key={cat.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span>{cat.name}</span>
                          <span>{formatGHS(cat.collected)} collected of {formatGHS(cat.charged)}</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex flex-col gap-1">
                          <div className="h-1.5 bg-navy-800 rounded-full transition-all duration-500" style={{ width: `${chargedWidth}%` }} />
                          <div className="h-1.5 bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${collectedWidth}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-slate-400 flex justify-between">
              <span>Includes Rent, Utilities, and custom fees</span>
              <span>Values in GH₵</span>
            </div>
          </div>

          {/* Chart C: Payment Status Breakdown */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Payment Status Breakdown</h3>
              <p className="text-xs text-slate-400 mb-4">Transaction distribution across verification statuses</p>

              {filteredPayments.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400">
                  <CreditCard className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-xs">No payment records found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Confirmed / Successful', count: filteredPayments.filter(p => p.status === 'successful').length, color: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Awaiting Verification', count: filteredPayments.filter(p => p.status === 'pending' || p.status === 'processing').length, color: 'bg-amber-500', text: 'text-amber-700' },
                    { label: 'Reversed Transactions', count: filteredPayments.filter(p => p.status === 'reversed').length, color: 'bg-gray-400', text: 'text-slate-600' },
                    { label: 'Failed Attempts', count: filteredPayments.filter(p => p.status === 'failed').length, color: 'bg-rose-500', text: 'text-rose-700' },
                  ].map(item => {
                    const pct = filteredPayments.length > 0 ? ((item.count / filteredPayments.length) * 100).toFixed(0) : '0';
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className={item.text}>{item.label}</span>
                          <span className="font-bold text-slate-800">{item.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-slate-400">
              Total Transactions: <strong>{filteredPayments.length}</strong>
            </div>
          </div>
        </div>

        {/* ── Report Tabs Header & Navigation ───────────────────────────────── */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto pb-px">
            {[
              { id: 'financial', label: 'Financial Summary', icon: DollarSign, count: undefined },
              { id: 'payments', label: 'Payment Report', icon: CreditCard, count: filteredPayments.length },
              { id: 'tenants', label: 'Tenant Report', icon: Users, count: filteredTenants.length },
              { id: 'bills', label: 'Bills Report', icon: FileText, count: filteredCharges.length },
              { id: 'rooms', label: 'Room Report', icon: DoorOpen, count: rooms.length },
              { id: 'former_tenants', label: 'Former Tenants', icon: History, count: formerTenants.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ReportTab)}
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

        {/* ── REPORT TAB 1: FINANCIAL SUMMARY ───────────────────────────────── */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Comprehensive Financial Statement</h2>
              <button
                onClick={downloadFinancialPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Financial Summary PDF
              </button>
            </div>

            {/* Financial Metrics Cards */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Total Charges Issued</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{formatGHS(totalChargesIssued)}</p>
                  <span className="text-xs text-slate-500">{filteredCharges.length} issued charge records</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Confirmed Collections</span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatGHS(confirmedCollections)}</p>
                  <span className="text-xs text-slate-500">{filteredPayments.filter(p => p.status === 'successful').length} successful payments</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Outstanding Balances</span>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{formatGHS(outstandingChargesTotal)}</p>
                  <span className="text-xs text-slate-500">Uncollected issued fees</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Overdue Balances</span>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{formatGHS(overdueChargesTotal)}</p>
                  <span className="text-xs text-slate-500">Subject to grace expiry</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Awaiting Verification</span>
                  <p className="text-xl font-bold text-amber-600 mt-1">{formatGHS(awaitingVerificationTotal)}</p>
                  <span className="text-xs text-slate-500">Unconfirmed manual MoMo</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Reversed Payments</span>
                  <p className="text-xl font-bold text-slate-700 mt-1">{formatGHS(reversedPaymentsTotal)}</p>
                  <span className="text-xs text-slate-500">Traceable historical audit</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Failed Transactions</span>
                  <p className="text-xl font-bold text-rose-500 mt-1">{formatGHS(failedPaymentsTotal)}</p>
                  <span className="text-xs text-slate-500">Declined/aborted transactions</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Recovery Ratio</span>
                  <p className="text-xl font-bold text-teal-600 mt-1">
                    {totalChargesIssued > 0 ? `${((confirmedCollections / totalChargesIssued) * 100).toFixed(1)}%` : '100%'}
                  </p>
                  <span className="text-xs text-slate-500">Collected vs issued</span>
                </div>
              </div>
            </div>

            {/* Category Performance Breakdown Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-200 font-bold text-slate-800 text-sm">
                Category Financial Breakdown
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Billing Category</th>
                      <th className="px-6 py-3.5 text-right">Charges Issued</th>
                      <th className="px-6 py-3.5 text-right">Confirmed Collected</th>
                      <th className="px-6 py-3.5 text-right">Remaining Balance</th>
                      <th className="px-6 py-3.5 text-right">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categoryCollections.map(cat => {
                      const rate = cat.charged > 0 ? ((cat.collected / cat.charged) * 100).toFixed(1) : '100.0';
                      return (
                        <tr key={cat.name} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-bold text-slate-800">{cat.name}</td>
                          <td className="px-6 py-4 text-right font-medium">{formatGHS(cat.charged)}</td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatGHS(cat.collected)}</td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700">{formatGHS(cat.balance)}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-800">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 2: PAYMENT REPORT ──────────────────────────────────── */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">All Payment Transactions</h2>
              <button
                onClick={downloadPaymentPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Payment Report PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Payment Date</th>
                      <th className="px-5 py-3.5">Reference #</th>
                      <th className="px-5 py-3.5">Tenant & Room</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Method</th>
                      <th className="px-5 py-3.5 text-right">Amount</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5">Receipt #</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                          No payment records found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                            {formatReadableDate(p.paymentDate)}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                            {p.referenceNumber}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-800">{p.tenantName}</div>
                            <div className="text-xs text-slate-400 font-mono">Room {p.roomNumber}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-medium text-slate-800">{p.categoryName}</span>
                            <div className="text-xs text-slate-400">{p.billingPeriod}</div>
                          </td>
                          <td className="px-5 py-3.5 text-xs">
                            <span className="uppercase font-semibold text-slate-700">{p.paymentMethod}</span>
                            {p.momoNetwork && <span className="block text-slate-400 font-mono">{p.momoNetwork}</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right font-extrabold text-slate-900">
                            {formatGHS(p.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === 'successful' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              p.status === 'pending' || p.status === 'processing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              p.status === 'reversed' ? 'bg-gray-100 text-slate-600' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {p.status === 'pending' ? 'Awaiting Verification' : p.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-teal-700">
                            {p.receiptNumber || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                            {p.status === 'successful' && (
                              <button
                                onClick={() => setSelectedReceiptPayment(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" /> Receipt
                              </button>
                            )}
                            {p.status === 'successful' && (
                              <button
                                onClick={() => {
                                  setReversingPayment(p);
                                  setReversalReason('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Reverse payment with traceable audit trail"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reversal
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

        {/* ── REPORT TAB 3: TENANT REPORT ───────────────────────────────────── */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Current & Historical Tenants Directory</h2>
              <button
                onClick={downloadTenantReportPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Tenant Report PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Tenant Details</th>
                      <th className="px-6 py-3.5">Room & Rent</th>
                      <th className="px-6 py-3.5">Tenancy Timeline</th>
                      <th className="px-6 py-3.5 text-right">Total Paid</th>
                      <th className="px-6 py-3.5 text-right">Outstanding Balance</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Historical Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          No tenant records match your current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{t.fullName}</div>
                            <div className="text-xs text-slate-400 font-mono">{t.tenantId} • {t.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{t.roomNumber}</div>
                            <div className="text-xs text-slate-500">{formatGHS(t.monthlyRent)}/month</div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            <div>{formatReadableDate(t.startDate)} →</div>
                            <div>{formatReadableDate(t.endDate)}</div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600">
                            {formatGHS(t.amountPaid)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold">
                            <span className={t.outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-800'}>
                              {formatGHS(t.outstandingBalance)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              t.tenancyStatus === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                              t.tenancyStatus === 'Ended' ? 'bg-rose-50 text-rose-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              {t.tenancyStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setHistoricalTenant(t)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 text-white hover:bg-navy-800 rounded-lg text-xs font-medium transition-colors"
                            >
                              <History className="w-3.5 h-3.5 text-teal-400" />
                              View History
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

        {/* ── REPORT TAB 4: BILLS REPORT ────────────────────────────────────── */}
        {activeTab === 'bills' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Bills & Issued Charges</h2>
              <button
                onClick={downloadBillsReportPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Bills Report PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Tenant & Room</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Billing Period</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5 text-right">Original Amount</th>
                      <th className="px-5 py-3.5 text-right">Paid</th>
                      <th className="px-5 py-3.5 text-right">Remaining Balance</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCharges.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                          No bills found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredCharges.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">{c.tenantName}</div>
                            <div className="text-xs text-slate-400 font-mono">Room {c.roomNumber}</div>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-800">
                            {c.categoryName}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">
                            {c.billingPeriod}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600">
                            {formatReadableDate(c.dueDate)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                            {formatGHS(c.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                            {formatGHS(c.amountPaid)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-extrabold text-slate-900">
                            <span className={c.remainingBalance > 0 ? 'text-rose-600' : 'text-slate-700'}>
                              {formatGHS(c.remainingBalance)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              c.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              c.status === 'overdue' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setCorrectingCharge(c);
                                setCorrectionNewAmount(c.amount.toString());
                                setCorrectionReason('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                              title="Audit-traceable amount correction"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Correct
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredCharges.length > 0 && (
                    <tfoot className="bg-gray-50 border-t border-gray-200 font-bold text-xs uppercase text-slate-700">
                      <tr>
                        <td colSpan={4} className="px-5 py-3">Totals</td>
                        <td className="px-5 py-3 text-right">{formatGHS(totalChargesIssued)}</td>
                        <td className="px-5 py-3 text-right text-emerald-600">{formatGHS(filteredCharges.reduce((s, c) => s + c.amountPaid, 0))}</td>
                        <td className="px-5 py-3 text-right text-rose-600">{formatGHS(outstandingChargesTotal)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 5: ROOM REPORT ─────────────────────────────────────── */}
        {activeTab === 'rooms' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Room Occupancy & Historical Allocation</h2>
              <button
                onClick={downloadRoomReportPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Room Report PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Room</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Agreed Rent</th>
                      <th className="px-6 py-3.5">Current Tenant</th>
                      <th className="px-6 py-3.5">Historical Tenancy Assignments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rooms.map(room => {
                      const currentTenant = tenants.find(t => t.roomId === room.id && (t.tenancyStatus === 'Active' || t.tenancyStatus === 'Upcoming'));
                      const historicalList = tenants.filter(t => t.roomId === room.id && t.tenancyStatus === 'Ended');

                      return (
                        <tr key={room.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{room.roomNumber}</div>
                            <div className="text-xs text-slate-400 font-mono">{room.roomCode}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              room.status === 'Occupied' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              room.status === 'Vacant' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {room.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-800">
                            {formatGHS(room.monthlyRent)}/mo
                          </td>
                          <td className="px-6 py-4">
                            {currentTenant ? (
                              <div>
                                <span className="font-bold text-slate-800">{currentTenant.fullName}</span>
                                <span className="block text-xs text-slate-400 font-mono">{currentTenant.tenantId}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">No active tenant (Vacant)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {historicalList.length > 0 ? (
                              <div className="space-y-1">
                                {historicalList.map(ht => (
                                  <div key={ht.id} className="flex items-center gap-2 text-slate-600">
                                    <span className="font-medium text-slate-800">{ht.fullName}</span>
                                    <span className="text-slate-400">({formatReadableDate(ht.startDate)} – {formatReadableDate(ht.endDate)})</span>
                                    {ht.outstandingBalance > 0 && (
                                      <span className="text-rose-600 font-semibold">[Debt: {formatGHS(ht.outstandingBalance)}]</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No previous tenancy history recorded</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORT TAB 6: FORMER TENANTS SEARCH & DISCOVERY ───────────────── */}
        {activeTab === 'former_tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Former Tenants Directory</h2>
                <p className="text-xs text-slate-500">Historical records, debts, and tenancy agreements are permanently preserved.</p>
              </div>
              <button
                onClick={downloadFormerTenantsPDF}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Former Tenants PDF
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-gray-50 text-slate-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Former Tenant</th>
                      <th className="px-6 py-3.5">Tenant ID</th>
                      <th className="px-6 py-3.5">Previous Room</th>
                      <th className="px-6 py-3.5">Tenancy Period</th>
                      <th className="px-6 py-3.5">Contact Details</th>
                      <th className="px-6 py-3.5 text-right">Outstanding Debt</th>
                      <th className="px-6 py-3.5 text-right">Full Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {formerTenants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="font-medium">No former tenants in historical database yet.</p>
                        </td>
                      </tr>
                    ) : (
                      formerTenants.map(ft => (
                        <tr key={ft.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{ft.fullName}</div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-slate-600">
                              Access Revoked
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-700">
                            {ft.tenantId}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {ft.roomNumber}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {formatReadableDate(ft.startDate)} – {formatReadableDate(ft.endDate)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            <div>{ft.phone}</div>
                            <div className="text-slate-400">{ft.email}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-extrabold ${ft.outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {formatGHS(ft.outstandingBalance)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setHistoricalTenant(ft)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 text-white hover:bg-navy-800 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <History className="w-3.5 h-3.5 text-teal-400" />
                              Historical Record
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

        {/* ── MODAL: FULL HISTORICAL TENANT RECORD ───────────────────────────── */}
        {historicalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setHistoricalTenant(null)} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              
              {/* Header */}
              <div className="px-6 py-5 bg-navy-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-navy-800 rounded-xl text-teal-400">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Historical Record: {historicalTenant.fullName}</h3>
                    <p className="text-xs text-navy-200">
                      ID: {historicalTenant.tenantId} • Status: {historicalTenant.tenancyStatus} • Account: {historicalTenant.accountStatus}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoricalTenant(null)}
                  className="p-2 text-navy-200 hover:text-white rounded-full hover:bg-navy-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                {/* Section A: Tenant Identity & Contact */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">1. Tenant Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="block text-xs text-slate-400">Full Legal Name</span>
                      <strong className="text-slate-800">{historicalTenant.fullName}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">Phone Contact</span>
                      <strong className="text-slate-800">{historicalTenant.phone}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">Email Address</span>
                      <strong className="text-slate-800">{historicalTenant.email}</strong>
                    </div>
                  </div>
                </div>

                {/* Section B: Tenancy Timeline */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">2. Tenancy Timeline & Room Allocation</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="block text-xs text-slate-400">Assigned Room</span>
                      <strong className="text-slate-800">{historicalTenant.roomNumber}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">Start Date</span>
                      <strong className="text-slate-800">{formatReadableDate(historicalTenant.startDate)}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">End Date</span>
                      <strong className="text-slate-800">{formatReadableDate(historicalTenant.endDate)}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">Agreed Rent</span>
                      <strong className="text-slate-800">{formatGHS(historicalTenant.monthlyRent)}/mo</strong>
                    </div>
                  </div>
                </div>

                {/* Section C & D: Associated Payments & Bills */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">3. Bills & Outstanding Balances</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-slate-700 font-semibold">
                        <tr>
                          <th className="p-3">Category</th>
                          <th className="p-3">Period</th>
                          <th className="p-3">Due Date</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-right">Paid</th>
                          <th className="p-3 text-right">Balance</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {charges.filter(c => c.tenantId === historicalTenant.id).map(c => (
                          <tr key={c.id}>
                            <td className="p-3 font-bold text-slate-800">{c.categoryName}</td>
                            <td className="p-3 text-slate-500">{c.billingPeriod}</td>
                            <td className="p-3 text-slate-500">{formatReadableDate(c.dueDate)}</td>
                            <td className="p-3 text-right">{formatGHS(c.amount)}</td>
                            <td className="p-3 text-right text-emerald-600 font-bold">{formatGHS(c.amountPaid)}</td>
                            <td className="p-3 text-right font-bold text-rose-600">{formatGHS(c.remainingBalance)}</td>
                            <td className="p-3 text-center">{c.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">4. Associated Payments & Confirmed Receipts</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-slate-700 font-semibold">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Reference #</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Method</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3">Receipt #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {payments.filter(p => p.tenantId === historicalTenant.id).map(p => (
                          <tr key={p.id}>
                            <td className="p-3 text-slate-500">{formatReadableDate(p.paymentDate)}</td>
                            <td className="p-3 font-mono">{p.referenceNumber}</td>
                            <td className="p-3 font-medium text-slate-800">{p.categoryName}</td>
                            <td className="p-3 uppercase">{p.paymentMethod}</td>
                            <td className="p-3 text-right font-bold text-emerald-600">{formatGHS(p.amount)}</td>
                            <td className="p-3 text-center">{p.status}</td>
                            <td className="p-3 font-mono text-teal-700">
                              {p.receiptNumber ? (
                                <button
                                  onClick={() => setSelectedReceiptPayment(p)}
                                  className="underline font-bold"
                                >
                                  {p.receiptNumber}
                                </button>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section F: Audit History */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">5. Traceable Audit History</h4>
                  <div className="space-y-2">
                    {auditLogs.filter(a => a.entityId === historicalTenant.id || charges.some(c => c.tenantId === historicalTenant.id && c.id === a.entityId)).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No historical corrections or modifications recorded for this tenant.</p>
                    ) : (
                      auditLogs.filter(a => a.entityId === historicalTenant.id || charges.some(c => c.tenantId === historicalTenant.id && c.id === a.entityId)).map(a => (
                        <div key={a.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between text-slate-400">
                            <span>Actor: <strong className="text-slate-700">{a.actor}</strong></span>
                            <span>{formatReadableDate(a.timestamp)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Field Adjusted: <strong>{a.field}</strong></span>
                            <span className="mx-2">•</span>
                            <span className="text-slate-400">From: <del>{a.originalValue}</del></span>
                            <span className="mx-1">→</span>
                            <span className="text-emerald-700 font-bold">To: {a.correctedValue}</span>
                          </div>
                          <p className="text-slate-600 italic">Reason: "{a.reason}"</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-500">Permanent record preserved under DwellBase audit security.</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const ht = historicalTenant;
                      const html = `
                        <div class="report-heading">Historical Tenancy Record: ${ht.fullName}</div>
                        <div class="report-sub">Tenant ID: ${ht.tenantId} • Status: ${ht.tenancyStatus}</div>
                        <div class="summary-grid">
                          <div class="summary-card"><div class="summary-title">Room</div><div class="summary-val">${ht.roomNumber}</div></div>
                          <div class="summary-card"><div class="summary-title">Monthly Rent</div><div class="summary-val">${formatGHS(ht.monthlyRent)}</div></div>
                          <div class="summary-card"><div class="summary-title">Total Paid</div><div class="summary-val" style="color:#047857;">${formatGHS(ht.amountPaid)}</div></div>
                          <div class="summary-card"><div class="summary-title">Outstanding Debt</div><div class="summary-val" style="color:#b91c1c;">${formatGHS(ht.outstandingBalance)}</div></div>
                        </div>
                        <p><strong>Tenancy Period:</strong> ${formatReadableDate(ht.startDate)} – ${formatReadableDate(ht.endDate)}</p>
                        <p><strong>Contact:</strong> Phone: ${ht.phone} | Email: ${ht.email}</p>
                      `;
                      printReportDocument(`Tenant Record - ${ht.fullName}`, html);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Print / Save Tenant Record PDF
                  </button>
                  <button
                    onClick={() => setHistoricalTenant(null)}
                    className="px-4 py-2 bg-white border border-gray-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── MODAL: TRACEABLE CHARGE CORRECTION ─────────────────────────────── */}
        {correctingCharge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setCorrectingCharge(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Traceable Financial Correction</h3>
              <p className="text-xs text-slate-500 mb-4">
                Updating {correctingCharge.categoryName} ({correctingCharge.billingPeriod}) for {correctingCharge.tenantName}.
              </p>
              <form onSubmit={handleSaveCorrection} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Original Charge Amount</label>
                  <input
                    type="text"
                    disabled
                    value={formatGHS(correctingCharge.amount)}
                    className="w-full py-2 px-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">New Corrected Amount (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={correctionNewAmount}
                    onChange={(e) => setCorrectionNewAmount(e.target.value)}
                    className="w-full py-2.5 px-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Adjustment (Required for Audit Trail)</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g., Verified meter reading correction against ECG submeter bill"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-gray-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCorrectingCharge(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700"
                  >
                    Apply & Log to Audit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: TRACEABLE PAYMENT REVERSAL ──────────────────────────────── */}
        {reversingPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setReversingPayment(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden">
              <h3 className="text-lg font-bold text-rose-700 mb-1">Traceable Payment Reversal</h3>
              <p className="text-xs text-slate-500 mb-4">
                Reversing Ref: {reversingPayment.referenceNumber} ({formatGHS(reversingPayment.amount)})
              </p>
              <form onSubmit={handleSaveReversal} className="space-y-4">
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-100">
                  <p className="font-semibold">Important:</p>
                  <p className="mt-0.5">Reversal will mark payment as reversed, restore the charge balance, update tenant balance, and record an indelible audit entry.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Reversal (Required)</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g., Bank chargeback or incorrect Mobile Money payment duplicated"
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-gray-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReversingPayment(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700"
                  >
                    Confirm Reversal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: PAYMENT RECEIPT ────────────────────────────────────────── */}
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

export default AdminReports;
