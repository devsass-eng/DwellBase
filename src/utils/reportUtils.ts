// DwellBase - Report & Date Utilities

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into readable English format:
 * e.g., "10 October 2026"
 */
export const formatReadableDate = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    // Parse the date components safely to prevent timezone shift
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

/**
 * Formats a date range into readable English format:
 * e.g., "1 October 2026 – 31 October 2026"
 */
export const formatReadableDateRange = (startStr: string, endStr: string): string => {
  if (!startStr && !endStr) return 'All Recorded Dates';
  if (startStr && !endStr) return `From ${formatReadableDate(startStr)}`;
  if (!startStr && endStr) return `Up to ${formatReadableDate(endStr)}`;
  if (startStr === endStr) return formatReadableDate(startStr);
  return `${formatReadableDate(startStr)} – ${formatReadableDate(endStr)}`;
};

/**
 * Formats amount in Ghanaian Cedis (GH₵)
 */
export const formatGHS = (amount: number): string => {
  return `GH₵${(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Date Preset helpers based on current date
 */
export const getDatePresetRange = (preset: string): { startDate: string; endDate: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, '0');
  const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (preset) {
    case 'today': {
      const todayStr = toStr(now);
      return { startDate: todayStr, endDate: todayStr };
    }
    case 'this_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: toStr(start), endDate: toStr(end) };
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { startDate: toStr(start), endDate: toStr(end) };
    }
    case 'this_year': {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return { startDate: toStr(start), endDate: toStr(end) };
    }
    case 'last_year': {
      const start = new Date(year - 1, 0, 1);
      const end = new Date(year - 1, 11, 31);
      return { startDate: toStr(start), endDate: toStr(end) };
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
};

/**
 * Generates and triggers clean browser print or PDF saving
 */
export const printReportDocument = (title: string, innerHtml: string) => {
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    alert('Please allow popups for printing report documents.');
    return;
  }

  const doc = printWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title} — DwellBase</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .logo-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .tagline {
          font-size: 11px;
          color: #0d9488;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .doc-meta {
          text-align: right;
          font-size: 11px;
          color: #64748b;
          line-height: 1.5;
        }
        .report-heading {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 10px;
          margin-bottom: 4px;
        }
        .report-sub {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 20px;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .badge-pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
        .badge-overdue { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .badge-info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .summary-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          background: #f8fafc;
        }
        .summary-title {
          font-size: 11px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .summary-val {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 12px;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          text-align: left;
          padding: 8px 10px;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .font-mono { font-family: monospace; }
        
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
        .page-break {
          page-break-before: always;
        }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo-title">DwellBase</div>
          <div class="tagline">Property Management Made Simple</div>
        </div>
        <div class="doc-meta">
          <div><strong>Generated:</strong> ${formatReadableDate(new Date().toISOString().split('T')[0])}</div>
          <div><strong>System:</strong> DwellBase Property Management</div>
        </div>
      </div>
      <div>
        ${innerHtml}
      </div>
      <div class="footer">
        <div>Official report generated by DwellBase. Confidential & Proprietary.</div>
        <div>Page 1</div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();
};
