import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip, { LegendItem } from './ChartTooltip';
import { StackSegment } from './SpendingOverTimeChart';
import ServerWakeNotice from '../ServerWakeNotice';
import api from '../../utils/api';
import { SOURCE_COLORS, formatRs, formatRsCompact } from '../../utils/expenses';
import { MAX_COMPARE_MONTHS, compareMonths } from '../../utils/insights';
import { bsMonthRange, toISODate } from '../../utils/nepaliDate';

const SERIES_LABELS = { personal: 'Personal', group: 'In groups' };

// Side-by-side view of the months the user picks: a totals chart, then a
// table with one column per month (headline figures, then every category).
// `selected` holds month keys; `choices` the pickable months, newest first.
export default function MonthComparison({ choices, selected, onChange, source, dataVersion, onError }) {
  // Columns run oldest to newest, left to right.
  const months = useMemo(
    () => choices.filter(m => selected.includes(m.key)).reverse(),
    [choices, selected]
  );

  const [entries, setEntries] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(0);

  const fetchFrom = months.length ? toISODate(bsMonthRange(months[0]).start) : null;
  const fetchTo = months.length ? toISODate(bsMonthRange(months[months.length - 1]).end) : null;

  const load = useCallback(async () => {
    if (!fetchFrom || !fetchTo) return;
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      const { data } = await api.get('/insights/expenses', { params: { from: fetchFrom, to: fetchTo } });
      if (requestId !== requestRef.current) return;
      setEntries(data.entries);
      setStatus('ready');
    } catch {
      if (requestId !== requestRef.current) return;
      setStatus(s => (s === 'ready' ? 'ready' : 'error'));
      onError?.('Could not load your expenses');
    } finally {
      if (requestId === requestRef.current) setRefreshing(false);
    }
  }, [fetchFrom, fetchTo, dataVersion, onError]); // dataVersion: refetch after a save

  useEffect(() => { load(); }, [load]);

  const comparison = useMemo(
    () => (entries && months.length ? compareMonths(entries, months, source) : null),
    [entries, months, source]
  );

  const toggle = (key) => {
    if (selected.includes(key)) onChange(selected.filter(k => k !== key));
    else if (selected.length < MAX_COMPARE_MONTHS) onChange([...selected, key]);
  };
  const latest = (count) => choices.slice(0, count).map(m => m.key);
  const isPreset = (count) => selected.length === count && latest(count).every(k => selected.includes(k));

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="card p-3 sm:p-4" aria-labelledby="pick-months-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2.5">
          <h2 id="pick-months-title" className="text-sm font-semibold text-ink-100">Months to compare</h2>
          <p className="text-xs text-ink-500" aria-live="polite">
            {selected.length} of {MAX_COMPARE_MONTHS} picked
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Quick choices">
          {[[2, 'This & last month'], [3, 'Last 3'], [6, 'Last 6']].map(([count, label]) => (
            <button
              key={count}
              onClick={() => onChange(latest(count))}
              aria-pressed={isPreset(count)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors touch-manipulation ${
                isPreset(count) ? 'border-accent/50 bg-accent/10 text-accent-light' : 'border-ink-800 text-ink-400 hover:text-ink-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 gap-1.5" role="group" aria-label="Months">
          {choices.map(month => {
            const on = selected.includes(month.key);
            const full = !on && selected.length >= MAX_COMPARE_MONTHS;
            return (
              <button
                key={month.key}
                onClick={() => toggle(month.key)}
                disabled={full}
                aria-pressed={on}
                className={`rounded-lg border px-2 py-2 text-xs transition-colors touch-manipulation disabled:opacity-35 ${
                  on ? 'border-accent bg-accent/10 text-ink-100' : 'border-ink-800 bg-ink-800/40 text-ink-400 hover:text-ink-200 hover:border-ink-700'
                }`}
              >
                <span className="block font-medium">{month.name}</span>
                <span className="block text-[11px] text-ink-500">{month.year}</span>
              </button>
            );
          })}
        </div>
      </section>

      {months.length < 2 ? (
        <div className="card text-center py-10 px-4">
          <div className="text-4xl mb-3" aria-hidden>🗓️</div>
          <p className="text-ink-300 font-medium text-sm">Pick at least two months</p>
          <p className="text-ink-500 text-xs mt-1">They will be shown side by side, oldest on the left.</p>
        </div>
      ) : status === 'loading' && !comparison ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          <ServerWakeNotice active />
        </div>
      ) : status === 'error' && !comparison ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-300">Could not load your expenses.</p>
          <button onClick={load} className="btn-ghost mt-3">Try again</button>
        </div>
      ) : comparison && (
        <div className={`space-y-4 sm:space-y-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing}>
          <MonthTotalsChart columns={comparison.columns} source={source} />
          <SideBySideTable comparison={comparison} source={source} />
        </div>
      )}
    </div>
  );
}

function MonthTotalsChart({ columns, source }) {
  const series = source === 'all' ? ['personal', 'group'] : [source];
  const data = columns.map(column => ({
    key: column.key,
    tick: column.short,
    column,
    personal: column.summary.personal,
    group: column.summary.group,
    total: column.summary.total
  }));

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="month-totals-title">
      <h2 id="month-totals-title" className="text-sm font-semibold text-ink-100">Monthly totals</h2>
      <p className="text-xs text-ink-500 mt-0.5 mb-3">
        {series.length === 1 ? `${SERIES_LABELS[series[0]]} spending` : 'Personal and group spending'} per month
      </p>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
          {series.map(key => <LegendItem key={key} color={SOURCE_COLORS[key]} label={SERIES_LABELS[key]} />)}
        </div>
      )}
      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#1c1c26" />
            <XAxis dataKey="tick" tickLine={false} axisLine={{ stroke: '#2a2a38' }} tick={{ fill: '#8080a0', fontSize: 11 }} />
            <YAxis tickFormatter={formatRsCompact} tickLine={false} axisLine={false} tick={{ fill: '#8080a0', fontSize: 11 }} width={64} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const { column } = payload[0].payload;
                const notes = [];
                if (series.length > 1) notes.push(`Total ${formatRs(column.summary.total)}`);
                if (column.inProgress) notes.push(`So far, day ${column.elapsedDays} of ${column.totalDays}`);
                if (column.projected !== null) notes.push(`On pace for ~${formatRs(Math.round(column.projected))}`);
                return (
                  <ChartTooltip
                    title={`${column.name} ${column.year}`}
                    rows={series.map(key => ({ name: SERIES_LABELS[key], value: column.summary[key], color: SOURCE_COLORS[key] }))}
                    footer={notes.length ? notes.join(' · ') : undefined}
                  />
                );
              }}
            />
            {series.map(key => (
              <Bar
                key={key}
                dataKey={key}
                name={SERIES_LABELS[key]}
                stackId="spend"
                fill={SOURCE_COLORS[key]}
                maxBarSize={48}
                isAnimationActive={false}
                shape={(props) => (
                  <StackSegment {...props} isTop={key === series[series.length - 1] || !(props.payload.group > 0)} />
                )}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SideBySideTable({ comparison, source }) {
  const { columns, categories } = comparison;
  const [showAll, setShowAll] = useState(false);
  const visibleCategories = showAll ? categories : categories.slice(0, 8);

  const headCell = 'sticky left-0 z-10 bg-ink-900 text-left align-top font-normal text-ink-400 py-2.5 pr-2 sm:pr-3 pl-4 sm:pl-5 whitespace-nowrap';
  const cell = 'py-2.5 px-2 sm:px-3 text-right align-top';

  return (
    <section className="card overflow-hidden" aria-labelledby="side-by-side-title">
      <div className="px-4 sm:px-5 pt-4 pb-3">
        <h2 id="side-by-side-title" className="text-sm font-semibold text-ink-100">Side by side</h2>
        <p className="text-xs text-ink-500 mt-0.5">Each month is compared with the one to its left</p>
        {columns.length > 2 && <p className="sm:hidden text-xs text-ink-500 mt-1">Swipe the table sideways to see every month →</p>}
      </div>
      <div className="overflow-x-auto border-t border-ink-800">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-ink-800">
              <th scope="col" className={`${headCell} text-xs`}><span className="sr-only">Figure</span></th>
              {columns.map(column => (
                <th key={column.key} scope="col" className="py-2.5 px-2 sm:px-3 text-right align-bottom font-medium text-ink-100 min-w-[92px] sm:min-w-[112px] whitespace-nowrap">
                  {column.name} <span className="text-ink-500 font-normal">{String(column.year).slice(-2)}</span>
                  {column.inProgress && <span className="block text-[11px] font-normal text-accent-light">so far · day {column.elapsedDays}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            <tr>
              <th scope="row" className={headCell}>Total</th>
              {columns.map(column => (
                <td key={column.key} className={cell}>
                  <span className="text-ink-100 font-semibold">{formatRs(column.summary.total)}</span>
                  {column.projected !== null && (
                    <span className="block text-[11px] text-ink-500">pace ~{formatRs(Math.round(column.projected))}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={headCell}>Change</th>
              {columns.map(column => (
                <td key={column.key} className={`${cell} text-xs`}>
                  <ChangeCell change={column.change} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={headCell}>Daily average</th>
              {columns.map(column => (
                <td key={column.key} className={`${cell} text-ink-200`}>{formatRs(Math.round(column.dailyAverage))}</td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={headCell}>Expenses</th>
              {columns.map(column => (
                <td key={column.key} className={`${cell} text-ink-200`}>{column.summary.count}</td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={headCell}>Largest</th>
              {columns.map(column => (
                <td key={column.key} className={cell}>
                  {column.summary.largest ? (
                    <>
                      <span className="text-ink-200">{formatRs(column.summary.largest.amount)}</span>
                      <span className="block text-[11px] text-ink-500 truncate max-w-[120px] ml-auto">{column.summary.largest.title}</span>
                    </>
                  ) : <span className="text-ink-600">—</span>}
                </td>
              ))}
            </tr>

            <tr className="bg-ink-800/40">
              <th scope="colgroup" colSpan={columns.length + 1} className="sticky left-0 text-left text-xs font-medium text-ink-400 uppercase tracking-wider py-2 pl-4 sm:pl-5">
                By category
                {source === 'all' && (
                  <span className="ml-3 normal-case tracking-normal font-normal inline-flex gap-3 align-middle">
                    <LegendItem color={SOURCE_COLORS.personal} label="Personal" />
                    <LegendItem color={SOURCE_COLORS.group} label="In groups" />
                  </span>
                )}
              </th>
            </tr>
            {visibleCategories.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="py-4 px-4 sm:px-5 text-xs text-ink-500">No spending in these months.</td></tr>
            )}
            {visibleCategories.map(row => {
              const max = Math.max(...row.amounts);
              return (
                <tr key={row.id}>
                  <th scope="row" className={headCell}>
                    <span className="inline-flex items-center gap-1.5 sm:gap-2 max-w-[118px] sm:max-w-none">
                      <span aria-hidden>{row.emoji}</span>
                      <span className="truncate text-ink-300">{row.label}</span>
                      {source === 'all' && (
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: SOURCE_COLORS[row.source] }} aria-label={SERIES_LABELS[row.source]} />
                      )}
                    </span>
                  </th>
                  {row.amounts.map((amount, i) => (
                    <td key={columns[i].key} className={cell}>
                      {amount > 0 ? (
                        <>
                          <span className={amount === max && row.amounts.filter(a => a > 0).length > 1 ? 'text-ink-100 font-semibold' : 'text-ink-200'}>
                            {formatRs(amount)}
                          </span>
                          <span className="mt-1 ml-auto block h-1 w-full max-w-[96px] rounded-full bg-ink-800 overflow-hidden" aria-hidden>
                            <span className="block h-full rounded-full ml-auto" style={{ width: `${Math.max((amount / max) * 100, 3)}%`, backgroundColor: SOURCE_COLORS[row.source] }} />
                          </span>
                        </>
                      ) : <span className="text-ink-600">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {categories.length > 8 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full py-3 text-sm font-medium text-accent hover:text-accent-light border-t border-ink-800 touch-manipulation"
        >
          {showAll ? 'Show fewer categories' : `Show all ${categories.length} categories`}
        </button>
      )}
    </section>
  );
}

function ChangeCell({ change }) {
  if (!change) return <span className="text-ink-600">—</span>;
  if (change.ratio === null) {
    return <span className="text-ink-500">nothing in {change.against.name}</span>;
  }
  const abs = Math.abs(change.ratio);
  const same = abs < 0.005;
  const up = change.ratio > 0;
  return (
    <span className="block">
      <span className={same ? 'text-ink-400' : up ? 'text-warning' : 'text-success'} aria-hidden>{same ? '●' : up ? '▲' : '▼'}</span>{' '}
      <span className="text-ink-200">{same ? 'Same' : `${Math.round(abs * 100)}% ${up ? 'more' : 'less'}`}</span>
      <span className="block text-[11px] text-ink-500">
        vs {change.partial ? `same days of ${change.against.name}` : change.against.name}
      </span>
    </span>
  );
}
