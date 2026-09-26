// Builds a bill report PDF and downloads it as "{group name}.pdf".
// Loaded on demand from ReportView so jsPDF stays out of the main bundle.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatRs, formatRsExact } from './expenses';

const ACCENT = [108, 99, 255];
const INK = [17, 17, 24];
const MUTED = [110, 110, 128];
const MARGIN = 40;

// Characters Windows, macOS or Android refuse in filenames.
export const reportFileName = (groupName) => {
  const safe = (groupName || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${safe || 'report'}.pdf`;
};

const statusFor = (toPay) => (toPay < 0 ? 'Gets back' : toPay === 0 ? 'Settled' : 'Owes');

export function downloadReportPdf(report, { groupName, generatedAt }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const period = report.billingPeriod || {};
  let y = MARGIN + 10;

  // Header
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK);
  doc.text(groupName, MARGIN, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
  doc.text('Generated', pageWidth - MARGIN, y - 8, { align: 'right' });
  doc.setTextColor(...INK);
  doc.text(generatedAt, pageWidth - MARGIN, y + 4, { align: 'right' });

  y += 18;
  const range = [period.startNepaliDate, period.endNepaliDate].filter(Boolean).join(' - ');
  doc.setFontSize(10).setTextColor(...MUTED);
  doc.text([period.label || 'Billing Report', range].filter(Boolean).join('  ·  '), MARGIN, y);

  y += 12;
  doc.setDrawColor(...ACCENT).setLineWidth(1.5).line(MARGIN, y, pageWidth - MARGIN, y);

  const tableDefaults = {
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, textColor: INK },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 250] }
  };

  // Summary
  autoTable(doc, {
    ...tableDefaults,
    startY: y + 16,
    theme: 'grid',
    head: [['Flat Rent', 'Total Expenses', 'Total Cost', 'Members', 'Actual Split', 'Optimized Split']],
    body: [[
      formatRs(report.flatRent),
      formatRs(report.totalExpenses),
      formatRs(report.totalCost),
      String(report.memberCount),
      formatRsExact(report.actualDividedCost),
      formatRs(report.optimizedDividedCost)
    ]],
    styles: { ...tableDefaults.styles, fontSize: 9, halign: 'center' },
    bodyStyles: { fontStyle: 'bold' }
  });

  // Breakdown
  y = doc.lastAutoTable.finalY + 26;
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK).text('Breakdown', MARGIN, y);
  autoTable(doc, {
    ...tableDefaults,
    startY: y + 8,
    head: [['Name', 'Spent', 'To Pay', 'Status']],
    body: report.breakdown.map(m => [m.fullName, formatRs(m.totalExpense), formatRs(m.toPay), statusFor(m.toPay)]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
    }
  });

  // How the split is calculated
  y = doc.lastAutoTable.finalY + 20;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
  [
    `Total Cost = ${formatRs(report.flatRent)} (rent) + ${formatRs(report.totalExpenses)} (expenses) = ${formatRs(report.totalCost)}`,
    `Actual Split = ${formatRs(report.totalCost)} / ${report.memberCount} = ${formatRsExact(report.actualDividedCost)}`,
    `Optimized Split (rounded to nearest 10) = ${formatRs(report.optimizedDividedCost)}`,
    "To Pay = Optimized Split - Person's Expenses"
  ].forEach((line, i) => doc.text(`• ${line}`, MARGIN, y + i * 13));

  // Detailed items, one table per member who bought something
  y += 4 * 13 + 18;
  const buyers = report.breakdown.filter(m => m.items.length > 0);
  if (buyers.length) {
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK).text('Detailed Items', MARGIN, y);
    y += 8;
  }
  buyers.forEach(member => {
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [[{ content: member.fullName, colSpan: 3, styles: { halign: 'left' } }], ['Date', 'Item', 'Price']],
      body: member.items.map(item => [
        item.nepaliDate || new Date(item.date).toLocaleDateString(),
        item.itemName,
        formatRs(item.price)
      ]),
      foot: [[{ content: 'Total', colSpan: 2, styles: { halign: 'right' } }, formatRs(member.totalExpense)]],
      footStyles: { fillColor: [236, 236, 244], textColor: INK, fontStyle: 'bold', halign: 'right' },
      columnStyles: { 0: { cellWidth: 110 }, 2: { halign: 'right', cellWidth: 90 } },
      showHead: 'firstPage'
    });
    y = doc.lastAutoTable.finalY + 14;
  });

  // Page footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    const bottom = doc.internal.pageSize.getHeight() - 20;
    doc.text('FlatShare', MARGIN, bottom);
    doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, bottom, { align: 'right' });
  }

  doc.save(reportFileName(groupName));
}
