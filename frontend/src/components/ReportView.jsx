import { useState } from 'react';
import api from '../utils/api';

export default function ReportView({ groupId, group }) {
  const [flatRent, setFlatRent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { flatRent: Number(flatRent) };
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      const { data } = await api.post(`/reports/group/${groupId}/generate`, payload);
      setReport(data.report);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div>
      {/* Generator form */}
      {!report && (
        <div className="card p-6 max-w-md">
          <h3 className="font-semibold text-ink-100 mb-4">Generate Bill Report</h3>
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
          <form onSubmit={generate} className="space-y-4">
            <div>
              <label className="label">Flat Rent (Rs)</label>
              <input
                type="number"
                className="input-field"
                placeholder="e.g. 14000"
                min="0"
                value={flatRent}
                onChange={e => setFlatRent(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">From Date (optional)</label>
                <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">To Date (optional)</label>
                <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full flex justify-center" disabled={loading}>
              {loading ? <Spinner /> : 'Generate Report'}
            </button>
          </form>
        </div>
      )}

      {/* Report */}
      {report && (
        <div>
          {/* Actions */}
          <div className="flex items-center gap-2 mb-4 no-print">
            <button onClick={() => setReport(null)} className="btn-ghost flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              New Report
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
          </div>

          {/* Report card */}
          <div className="card p-6 print:shadow-none print:border-0">
            {/* Header */}
            <div className="border-b border-ink-800 pb-5 mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-ink-100">{group.name}</h2>
                  <p className="text-sm text-ink-500 mt-0.5">
                    {report.billingPeriod?.label || 'Billing Report'} •{' '}
                    {report.billingPeriod?.startNepaliDate || ''}{report.billingPeriod?.endNepaliDate ? ` – ${report.billingPeriod.endNepaliDate}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-500">Generated</p>
                  <p className="text-xs text-ink-400">{new Date(report.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <SummaryBox label="Flat Rent" value={`Rs ${report.flatRent.toLocaleString()}`} />
              <SummaryBox label="Total Expenses" value={`Rs ${report.totalExpenses.toLocaleString()}`} />
              <SummaryBox label="Total Cost" value={`Rs ${report.totalCost.toLocaleString()}`} accent />
              <SummaryBox label="Members" value={report.memberCount} />
              <SummaryBox label="Actual Split" value={`Rs ${report.actualDividedCost.toFixed(2)}`} />
              <SummaryBox label="Optimized Split" value={`Rs ${report.optimizedDividedCost.toLocaleString()}`} accent />
            </div>

            {/* Per-person table */}
            <h3 className="font-semibold text-ink-200 mb-3">Breakdown</h3>
            <div className="overflow-x-auto rounded-lg border border-ink-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-800 text-ink-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-right px-4 py-3">Spent</th>
                    <th className="text-right px-4 py-3">To Pay</th>
                    <th className="text-right px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {report.breakdown.map((member, idx) => (
                    <tr key={idx} className="hover:bg-ink-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink-100">{member.fullName}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-300">
                        Rs {member.totalExpense.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${member.toPay < 0 ? 'text-success' : 'text-warning'}`}>
                        Rs {member.toPay.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {member.toPay < 0 ? (
                          <span className="badge bg-success/10 text-success border border-success/20">Gets Back</span>
                        ) : member.toPay === 0 ? (
                          <span className="badge bg-ink-700 text-ink-400">Settled</span>
                        ) : (
                          <span className="badge bg-warning/10 text-warning border border-warning/20">Owes</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculation note */}
            <div className="mt-4 bg-ink-800/50 border border-ink-700 rounded-lg p-4 text-xs text-ink-500 space-y-1">
              <p>• Total Cost = Flat Rent (Rs {report.flatRent.toLocaleString()}) + Total Expenses (Rs {report.totalExpenses.toLocaleString()}) = <span className="text-ink-300">Rs {report.totalCost.toLocaleString()}</span></p>
              <p>• Actual Split = Rs {report.totalCost.toLocaleString()} ÷ {report.memberCount} members = <span className="text-ink-300">Rs {report.actualDividedCost.toFixed(2)}</span></p>
              <p>• Optimized Split (rounded to nearest 10) = <span className="text-ink-300">Rs {report.optimizedDividedCost.toLocaleString()}</span></p>
              <p>• To Pay = Optimized Split − Person's Expenses</p>
            </div>

            {/* Detailed items per person */}
            <div className="mt-6">
              <h3 className="font-semibold text-ink-200 mb-3">Detailed Items</h3>
              <div className="space-y-4">
                {report.breakdown.map((member, idx) => (
                  member.items.length > 0 && (
                    <div key={idx}>
                      <p className="text-sm font-medium text-ink-300 mb-1.5">{member.fullName}</p>
                      <div className="overflow-x-auto rounded-lg border border-ink-800">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-ink-800/50 text-ink-500 text-xs">
                              <th className="text-left px-3 py-2">Date</th>
                              <th className="text-left px-3 py-2">Item</th>
                              <th className="text-right px-3 py-2">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-800">
                            {member.items.map((item, jdx) => (
                              <tr key={jdx} className="hover:bg-ink-800/30">
                                <td className="px-3 py-2 text-ink-500 text-xs whitespace-nowrap">
                                  {item.nepaliDate || new Date(item.date).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-ink-300">{item.itemName}</td>
                                <td className="px-3 py-2 text-right font-mono text-ink-300">Rs {item.price.toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="bg-ink-800/30">
                              <td colSpan={2} className="px-3 py-2 text-right text-xs font-medium text-ink-400">Total</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-ink-200">
                                Rs {member.totalExpense.toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBox({ label, value, accent }) {
  return (
    <div className={`rounded-lg p-3 ${accent ? 'bg-accent/10 border border-accent/20' : 'bg-ink-800 border border-ink-700'}`}>
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className={`font-mono font-semibold ${accent ? 'text-accent' : 'text-ink-100'}`}>{value}</p>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
