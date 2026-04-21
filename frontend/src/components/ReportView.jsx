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
      {/* ── Generator Form ── */}
      {!report && (
        <div className="card p-4 sm:p-6 max-w-md fade-in">
          <h3 className="font-semibold text-ink-100 mb-4 text-base sm:text-lg">Generate Bill Report</h3>
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={generate} className="space-y-4">
            <div>
              <label className="label" htmlFor="flat-rent">Flat Rent (Rs)</label>
              <input
                id="flat-rent"
                type="number"
                className="input-field"
                placeholder="e.g. 14000"
                min="0"
                inputMode="numeric"
                pattern="[0-9]*"
                value={flatRent}
                onChange={e => setFlatRent(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="start-date">From (optional)</label>
                <input id="start-date" type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="end-date">To (optional)</label>
                <input id="end-date" type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner /> : 'Generate Report'}
            </button>
          </form>
        </div>
      )}

      {/* ── Report ── */}
      {report && (
        <div className="fade-in">
          {/* Actions */}
          <div className="flex items-center gap-2 mb-4 no-print">
            <button onClick={() => setReport(null)} className="btn-ghost flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden xs:inline">New Report</span>
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>

          {/* Report card */}
          <div className="card p-4 sm:p-6 print:shadow-none print:border-0">
            {/* Header */}
            <div className="border-b border-ink-800 pb-4 mb-4 sm:pb-5 sm:mb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-ink-100 truncate">{group.name}</h2>
                  <p className="text-xs sm:text-sm text-ink-500 mt-0.5 line-clamp-2">
                    {report.billingPeriod?.label || 'Billing Report'}
                    {report.billingPeriod?.startNepaliDate ? ` · ${report.billingPeriod.startNepaliDate}` : ''}
                    {report.billingPeriod?.endNepaliDate ? ` – ${report.billingPeriod.endNepaliDate}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-ink-500">Generated</p>
                  <p className="text-xs text-ink-400">{new Date(report.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Summary grid — 2 cols on mobile, 3 on sm+ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6">
              <SummaryBox label="Flat Rent" value={`Rs ${report.flatRent.toLocaleString()}`} />
              <SummaryBox label="Total Expenses" value={`Rs ${report.totalExpenses.toLocaleString()}`} />
              <SummaryBox label="Total Cost" value={`Rs ${report.totalCost.toLocaleString()}`} accent className="col-span-2 sm:col-span-1" />
              <SummaryBox label="Members" value={report.memberCount} />
              <SummaryBox label="Actual Split" value={`Rs ${report.actualDividedCost.toFixed(2)}`} />
              <SummaryBox label="Optimized Split" value={`Rs ${report.optimizedDividedCost.toLocaleString()}`} accent />
            </div>

            {/* Breakdown table */}
            <h3 className="font-semibold text-ink-200 mb-3 text-sm sm:text-base">Breakdown</h3>

            {/* Mobile: card per person */}
            <div className="sm:hidden space-y-2 mb-5">
              {report.breakdown.map((member, idx) => (
                <div key={idx} className="bg-ink-800 border border-ink-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-ink-100 text-sm truncate max-w-[60%]">{member.fullName}</span>
                    {member.toPay < 0 ? (
                      <span className="badge bg-success/10 text-success border border-success/20 text-xs">Gets Back</span>
                    ) : member.toPay === 0 ? (
                      <span className="badge bg-ink-700 text-ink-400 text-xs">Settled</span>
                    ) : (
                      <span className="badge bg-warning/10 text-warning border border-warning/20 text-xs">Owes</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-ink-500">Spent</span>
                      <p className="font-mono font-medium text-ink-300 mt-0.5">Rs {member.totalExpense.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-ink-500">To Pay</span>
                      <p className={`font-mono font-semibold mt-0.5 ${member.toPay < 0 ? 'text-success' : 'text-warning'}`}>
                        Rs {member.toPay.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-ink-800 mb-5 sm:mb-6 table-responsive">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="bg-ink-800 text-ink-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3" scope="col">Name</th>
                    <th className="text-right px-4 py-3" scope="col">Spent</th>
                    <th className="text-right px-4 py-3" scope="col">To Pay</th>
                    <th className="text-right px-4 py-3" scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {report.breakdown.map((member, idx) => (
                    <tr key={idx} className="hover:bg-ink-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink-100">{member.fullName}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-300">Rs {member.totalExpense.toLocaleString()}</td>
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
            <div className="mt-4 bg-ink-800/50 border border-ink-700 rounded-xl p-3 sm:p-4 text-xs text-ink-500 space-y-1.5">
              <p>• Total Cost = Rs {report.flatRent.toLocaleString()} (rent) + Rs {report.totalExpenses.toLocaleString()} (expenses) = <span className="text-ink-300">Rs {report.totalCost.toLocaleString()}</span></p>
              <p>• Actual Split = Rs {report.totalCost.toLocaleString()} ÷ {report.memberCount} = <span className="text-ink-300">Rs {report.actualDividedCost.toFixed(2)}</span></p>
              <p>• Optimized Split (rounded to nearest 10) = <span className="text-ink-300">Rs {report.optimizedDividedCost.toLocaleString()}</span></p>
              <p>• To Pay = Optimized Split − Person's Expenses</p>
            </div>

            {/* Detailed items */}
            <div className="mt-5 sm:mt-6">
              <h3 className="font-semibold text-ink-200 mb-3 text-sm sm:text-base">Detailed Items</h3>
              <div className="space-y-4">
                {report.breakdown.map((member, idx) => (
                  member.items.length > 0 && (
                    <div key={idx}>
                      <p className="text-sm font-medium text-ink-300 mb-1.5">{member.fullName}</p>

                      {/* Mobile: compact list */}
                      <div className="sm:hidden bg-ink-800 border border-ink-700 rounded-xl overflow-hidden">
                        {member.items.map((item, jdx) => (
                          <div key={jdx} className="flex items-center justify-between px-3 py-2.5 border-b border-ink-700 last:border-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-ink-300 truncate">{item.itemName}</p>
                              <p className="text-xs text-ink-600">{item.nepaliDate || new Date(item.date).toLocaleDateString()}</p>
                            </div>
                            <span className="font-mono text-sm text-ink-300 ml-3 shrink-0">Rs {item.price.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between px-3 py-2 bg-ink-700/50">
                          <span className="text-xs font-medium text-ink-400">Total</span>
                          <span className="font-mono font-semibold text-sm text-ink-200">Rs {member.totalExpense.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Desktop: table */}
                      <div className="hidden sm:block overflow-x-auto rounded-lg border border-ink-800 table-responsive">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-ink-800/50 text-ink-500 text-xs">
                              <th className="text-left px-3 py-2" scope="col">Date</th>
                              <th className="text-left px-3 py-2" scope="col">Item</th>
                              <th className="text-right px-3 py-2" scope="col">Price</th>
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
                              <td className="px-3 py-2 text-right font-mono font-semibold text-ink-200">Rs {member.totalExpense.toLocaleString()}</td>
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

function SummaryBox({ label, value, accent, className = '' }) {
  return (
    <div className={`rounded-xl p-2.5 sm:p-3 ${accent ? 'bg-accent/10 border border-accent/20' : 'bg-ink-800 border border-ink-700'} ${className}`}>
      <p className="text-xs text-ink-500 mb-0.5 truncate">{label}</p>
      <p className={`font-mono font-semibold text-sm sm:text-base truncate ${accent ? 'text-accent' : 'text-ink-100'}`}>{value}</p>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />;
}
