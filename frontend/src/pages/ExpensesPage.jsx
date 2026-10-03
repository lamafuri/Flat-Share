import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PersonalExpenseSheet from '../components/PersonalExpenseSheet';
import ServerWakeNotice from '../components/ServerWakeNotice';
import Toast from '../components/Toast';
import BreakdownList from '../components/insights/BreakdownList';
import MonthComparison from '../components/insights/MonthComparison';
import PaceChart from '../components/insights/PaceChart';
import SpendingOverTimeChart from '../components/insights/SpendingOverTimeChart';
import api from '../utils/api';
import { SOURCE_COLORS, formatRs } from '../utils/expenses';
import {
  COMPARE_MONTH_CHOICES, MAX_COMPARE_MONTHS, MAX_CUSTOM_RANGE_DAYS, RANGE_PRESETS, SOURCE_FILTERS, addProjection, biggestMovers, breakdown, bucketize,
  compareBreakdown, comparePeriods, cumulativeSeries, entriesInRange, entryCategory, filterBySource, granularityFor,
  previousAtSamePoint, projectTotal, recentMonths, resolveRange, summarize
} from '../utils/insights';
import { addDays, daysBetween, formatBS, parseISODate, toISODate } from '../utils/nepaliDate';

const PERIOD_NAMES = {
  thisMonth: ['This month', 'Last month'],
  lastMonth: ['Last month', 'Month before'],
  last3: ['These 3 months', 'Previous 3 months'],
  last6: ['These 6 months', 'Previous 6 months'],
  thisYear: ['This year', 'Last year'],
  custom: ['This period', 'Previous period']
};

const TRANSACTIONS_PAGE = 15;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Filters live in the URL so refresh, back/forward and shared links keep them.
const useInsightFilters = () => {
  const [params, setParams] = useSearchParams();
  const today = toISODate(new Date());

  const preset = RANGE_PRESETS.some(p => p.key === params.get('range')) ? params.get('range') : 'thisMonth';
  const source = SOURCE_FILTERS.some(s => s.key === params.get('source')) ? params.get('source') : 'all';
  const from = ISO_DAY.test(params.get('from') || '') ? params.get('from') : toISODate(addDays(new Date(), -29));
  const to = ISO_DAY.test(params.get('to') || '') ? params.get('to') : today;
  const view = params.get('view') === 'compare' ? 'compare' : 'overview';
  // Recomputed when the day changes, so a new month shows up.
  const monthChoices = useMemo(() => recentMonths(COMPARE_MONTH_CHOICES, parseISODate(today)), [today]);
  const months = useMemo(() => {
    const valid = (params.get('months') || '').split(',').filter(key => monthChoices.some(m => m.key === key));
    const unique = [...new Set(valid)].slice(0, MAX_COMPARE_MONTHS);
    // Default: this month next to last month.
    return params.has('months') ? unique : monthChoices.slice(0, 2).map(m => m.key);
  }, [params, monthChoices]);

  const update = (changes) => {
    const next = {
      range: preset, source, view, ...(preset === 'custom' ? { from, to } : {}),
      ...(params.has('months') ? { months: months.join(',') } : {}),
      ...changes
    };
    if (Array.isArray(next.months)) next.months = next.months.join(',');
    if (next.range !== 'custom') { delete next.from; delete next.to; }
    if (next.range === 'custom') { next.from ??= from; next.to ??= to; }
    if (next.range === 'thisMonth') delete next.range;
    if (next.source === 'all') delete next.source;
    if (next.view === 'overview') delete next.view;
    setParams(next, { replace: true });
  };

  return { preset, source, from, to, today, view, months, monthChoices, update };
};

const describeChange = (change) => {
  if (change === null) return null;
  const abs = Math.abs(change);
  if (abs < 0.005) return { direction: 'same', text: 'About the same as' };
  if (change >= 9) return { direction: 'up', text: `${Math.round(1 + change)}× more than` };
  return { direction: change > 0 ? 'up' : 'down', text: `${Math.round(abs * 100)}% ${change > 0 ? 'more' : 'less'} than` };
};

export default function ExpensesPage() {
  const { preset, source, from, to, today, view: mode, months, monthChoices, update } = useInsightFilters();
  const isCompare = mode === 'compare';

  const customError = useMemo(() => {
    if (preset !== 'custom') return '';
    if (from > to) return 'The start date must be on or before the end date.';
    if (daysBetween(parseISODate(from), parseISODate(to)) + 1 > MAX_CUSTOM_RANGE_DAYS) {
      return 'Custom ranges can be up to one year. Use "This year" for longer views.';
    }
    return '';
  }, [preset, from, to]);

  const range = useMemo(
    () => (customError ? null : resolveRange(preset, { start: parseISODate(from), end: parseISODate(to) })),
    [preset, from, to, customError]
  );

  const [entries, setEntries] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const requestRef = useRef(0);

  const fetchFrom = range ? toISODate(range.previous.start) : null;
  const fetchTo = range ? toISODate(range.end) : null;

  const load = useCallback(async () => {
    if (isCompare || !fetchFrom || !fetchTo) return;
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      const { data } = await api.get('/insights/expenses', { params: { from: fetchFrom, to: fetchTo } });
      if (requestId !== requestRef.current) return;
      setEntries(data.entries);
      setStatus('ready');
    } catch {
      if (requestId === requestRef.current) setStatus(s => (s === 'ready' ? 'ready' : 'error'));
      if (requestId === requestRef.current) setToast({ id: Date.now(), message: 'Could not load your expenses' });
    } finally {
      if (requestId === requestRef.current) setRefreshing(false);
    }
  }, [fetchFrom, fetchTo, isCompare]);

  useEffect(() => { load(); }, [load]);

  const showError = useCallback((message) => setToast({ id: Date.now(), message }), []);

  const view = useMemo(() => {
    if (!range || !entries) return null;
    const current = filterBySource(entriesInRange(entries, range), source);
    const previous = filterBySource(entriesInRange(entries, range.previous), source);
    const granularity = granularityFor(range);
    const summary = summarize(current);
    const projected = projectTotal(summary.total, range);
    const series = cumulativeSeries(current, previous, range);
    // Categories are compared with the previous period at the same point,
    // like the headline total.
    const comparable = previousAtSamePoint(previous, range);
    const { rows, dropped } = compareBreakdown(breakdown(current), breakdown(comparable));
    return {
      current,
      hasPreviousSpending: previous.length > 0,
      hasComparableSpending: comparable.length > 0,
      previousFullTotal: summarize(previous).total,
      summary,
      projected,
      granularity,
      buckets: bucketize(current, range, granularity),
      breakdown: rows,
      movers: comparable.length ? biggestMovers([...rows, ...dropped]) : [],
      series: addProjection(series, range, projected),
      comparison: comparePeriods(summary.total, series, range)
    };
  }, [entries, range, source]);

  const [currentName, previousName] = PERIOD_NAMES[preset];

  // Bumped after a save so the month comparison refetches too.
  const [dataVersion, setDataVersion] = useState(0);
  const handleSheetDone = (message) => {
    setSheet(null);
    setToast({ id: Date.now(), message });
    setDataVersion(v => v + 1);
    load();
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-ink-100">Expenses</h1>
            <p className="text-xs sm:text-sm text-ink-500 mt-0.5 hidden xs:block">Your personal spending plus what you paid in groups</p>
          </div>
          <button onClick={() => setSheet({})} className="btn-primary flex items-center gap-1 sm:gap-1.5 shrink-0">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline">Add Expense</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>

        <div className="flex p-1 bg-ink-900 border border-ink-800 rounded-xl" role="group" aria-label="View">
          {[['overview', 'Overview'], ['compare', 'Compare months']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => update({ view: key })}
              aria-pressed={mode === key}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                mode === key ? 'bg-ink-800 text-ink-100 shadow-sm' : 'text-ink-500 hover:text-ink-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filters: one row that scopes everything below */}
        <div className="space-y-2.5">
          {!isCompare && (
            <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-0.5" role="group" aria-label="Time range">
              {RANGE_PRESETS.map(p => (
                <FilterChip key={p.key} selected={preset === p.key} onClick={() => update({ range: p.key })}>{p.label}</FilterChip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex p-0.5 bg-ink-900 border border-ink-800 rounded-lg" role="group" aria-label="Expense source">
              {SOURCE_FILTERS.map(s => (
                <button
                  key={s.key}
                  onClick={() => update({ source: s.key })}
                  aria-pressed={source === s.key}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors touch-manipulation min-h-[32px] ${
                    source === s.key ? 'bg-ink-800 text-ink-100' : 'text-ink-500 hover:text-ink-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {range && !isCompare && (
              <p className="text-xs text-ink-400" aria-live="polite">
                {range.label}
              </p>
            )}
          </div>

          {preset === 'custom' && !isCompare && (
            <div className="card p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-3">
                <DateField id="range-from" label="From" value={from} max={today} onChange={value => update({ from: value })} />
                <DateField id="range-to" label="To" value={to} max={today} onChange={value => update({ to: value })} />
              </div>
              {customError && <p className="text-xs text-danger mt-2" role="alert">{customError}</p>}
            </div>
          )}
        </div>

        {/* Content */}
        {isCompare ? (
          <MonthComparison
            key={`compare-${today}`}
            choices={monthChoices}
            selected={months}
            onChange={keys => update({ months: keys })}
            source={source}
            dataVersion={dataVersion}
            onError={showError}
          />
        ) : !range ? (
          !customError && <p className="text-sm text-ink-500">These dates are outside the supported Nepali calendar range.</p>
        ) : status === 'loading' && !view ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-label="Loading" />
            <ServerWakeNotice active />
          </div>
        ) : status === 'error' && !view ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-300">Could not load your expenses.</p>
            <button onClick={load} className="btn-ghost mt-3">Try again</button>
          </div>
        ) : view && (
          <div className={`space-y-4 sm:space-y-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing}>
            {/* All-zero tiles add nothing for someone who has not tracked anything yet. */}
            {(view.current.length > 0 || view.hasPreviousSpending) && (
              <SummaryTiles
                view={view}
                range={range}
                source={source}
                currentName={currentName}
                previousName={previousName}
              />
            )}

            {view.movers.length > 0 && (
              <BiggestMovers
                movers={view.movers}
                comparedWith={range.inProgress ? `${previousName.toLowerCase()} at this point` : previousName.toLowerCase()}
                showSource={source === 'all'}
              />
            )}

            {view.current.length === 0 ? (
              <div className="card text-center py-10 px-4 fade-in">
                <div className="text-4xl mb-3" aria-hidden>📊</div>
                <p className="text-ink-300 font-medium text-sm sm:text-base">No spending recorded for {range.label}</p>
                <p className="text-ink-500 text-xs sm:text-sm mt-1">
                  {source === 'group'
                    ? 'Items you add in your groups will show up here.'
                    : 'Add expenses from your dashboard or right here to see your charts.'}
                </p>
                {source !== 'group' && (
                  <button onClick={() => setSheet({})} className="btn-primary mt-4">Add expense</button>
                )}
              </div>
            ) : (
              <>
                <SpendingOverTimeChart buckets={view.buckets} source={source} granularity={view.granularity} />
                <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                  <PaceChart
                    points={view.series}
                    currentName={currentName}
                    previousName={previousName}
                    currentTotal={view.summary.total}
                    previousAtSamePoint={view.comparison.previousTotal}
                    projected={view.projected}
                  />
                  <BreakdownList
                    rows={view.breakdown}
                    showSourceLegend={source === 'all'}
                    compareLabel={view.hasComparableSpending ? (range.inProgress ? `${previousName.toLowerCase()} at this point` : previousName.toLowerCase()) : null}
                  />
                </div>
                <Transactions key={`${range.label}-${source}`} entries={view.current} onEdit={expense => setSheet({ expense })} />
              </>
            )}
          </div>
        )}
      </div>

      {sheet && (
        <PersonalExpenseSheet
          expense={sheet.expense}
          onClose={() => setSheet(null)}
          onSaved={(saved, { isEdit }) => handleSheetDone(isEdit ? 'Expense updated' : saved.length > 1 ? `${saved.length} expenses added` : 'Expense added')}
          onDeleted={() => handleSheetDone('Expense deleted')}
        />
      )}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />}
    </Layout>
  );
}

function FilterChip({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors touch-manipulation min-h-[36px] ${
        selected
          ? 'bg-accent/15 border-accent/40 text-ink-100'
          : 'bg-ink-900 border-ink-800 text-ink-400 hover:text-ink-200 hover:border-ink-700'
      }`}
    >
      {children}
    </button>
  );
}

function DateField({ id, label, value, max, onChange }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        className="input-field"
        value={value}
        max={max}
        onChange={e => e.target.value && onChange(e.target.value)}
      />
      <p className="text-xs text-ink-500 mt-1">{formatBS(parseISODate(value))}</p>
    </div>
  );
}

function SummaryTiles({ view, range, source, currentName, previousName }) {
  const { summary, comparison } = view;
  const change = describeChange(comparison.change);
  const averageDays = Math.max(range.elapsedDays, 1);
  const comparedWith = range.inProgress ? `${previousName.toLowerCase()} at this point` : previousName.toLowerCase();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="card p-4 col-span-2">
        <p className="text-xs text-ink-500">Total spent</p>
        <p className="text-3xl sm:text-4xl font-semibold text-ink-100 mt-1 break-words">{formatRs(summary.total)}</p>
        <p className="text-xs mt-2 flex items-center gap-1.5">
          {change ? (
            <>
              <span
                className={change.direction === 'up' ? 'text-warning' : change.direction === 'down' ? 'text-success' : 'text-ink-400'}
                aria-hidden
              >
                {change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '●'}
              </span>
              <span className="text-ink-300">
                {change.text} {comparedWith}
                <span className="text-ink-500"> ({formatRs(comparison.previousTotal)})</span>
              </span>
            </>
          ) : (
            <span className="text-ink-500">No spending in {comparedWith} to compare with</span>
          )}
        </p>
        {view.projected !== null && (
          <p className="text-xs text-ink-400 mt-1">
            On pace for about <span className="text-ink-200 font-medium">{formatRs(Math.round(view.projected))}</span> by the end of {currentName.toLowerCase()}
            {view.previousFullTotal > 0 && <span className="text-ink-500"> · {previousName} {formatRs(view.previousFullTotal)}</span>}
          </p>
        )}
      </div>

      <StatTile label="Daily average" value={formatRs(Math.round(summary.total / averageDays))} hint={`over ${averageDays} day${averageDays !== 1 ? 's' : ''}`} />

      {source === 'all' ? (
        <div className="card p-4">
          <p className="text-xs text-ink-500">Split</p>
          <dl className="mt-1.5 space-y-1">
            {[['personal', 'Personal'], ['group', 'In groups']].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-xs text-ink-400">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SOURCE_COLORS[key] }} aria-hidden />
                  {label}
                </dt>
                <dd className="text-sm font-semibold text-ink-100">{formatRs(summary[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <StatTile
          label="Largest expense"
          value={summary.largest ? formatRs(summary.largest.amount) : '—'}
          hint={summary.largest ? summary.largest.title : `${summary.count} expenses`}
        />
      )}
    </div>
  );
}

// The categories behind the change in the total, largest difference first.
function BiggestMovers({ movers, comparedWith, showSource }) {
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="movers-title">
      <h2 id="movers-title" className="text-sm font-semibold text-ink-100">What changed</h2>
      <p className="text-xs text-ink-500 mt-0.5 mb-3">Biggest differences from {comparedWith}</p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {movers.map(row => (
          <li key={row.id} className="rounded-lg bg-ink-800/50 border border-ink-800 px-3 py-2.5 min-w-0">
            <p className="flex items-center gap-1.5 text-xs text-ink-400 min-w-0">
              <span aria-hidden>{row.emoji}</span>
              <span className="truncate">{row.label}</span>
              {showSource && (
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: SOURCE_COLORS[row.source] }} title={row.source === 'personal' ? 'Personal' : 'In groups'} aria-hidden />
              )}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-100 flex items-center gap-1.5">
              <ChangeMark delta={row.delta} />
              {row.delta > 0 ? '+' : '−'}{formatRs(Math.abs(row.delta))}
            </p>
            <p className="text-xs text-ink-500 mt-0.5 tabular-nums">
              {formatRs(row.previousAmount)} → {formatRs(row.amount)}
              {row.previousAmount === 0 ? ' · new' : row.amount === 0 ? ' · none now' : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChangeMark({ delta }) {
  return (
    <span className={delta > 0 ? 'text-warning' : 'text-success'} aria-label={delta > 0 ? 'Up' : 'Down'}>
      {delta > 0 ? '▲' : '▼'}
    </span>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="card p-4 min-w-0">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-lg sm:text-xl font-semibold text-ink-100 mt-1 truncate">{value}</p>
      {hint && <p className="text-xs text-ink-500 mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

function Transactions({ entries, onEdit }) {
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(TRANSACTIONS_PAGE);

  const sorted = useMemo(() => {
    const list = [...entries];
    return sort === 'largest'
      ? list.sort((a, b) => b.amount - a.amount)
      : list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [entries, sort]);

  return (
    <section className="card overflow-hidden" aria-labelledby="transactions-title">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
        <div>
          <h2 id="transactions-title" className="text-sm font-semibold text-ink-100">Transactions</h2>
          <p className="text-xs text-ink-500 mt-0.5">{entries.length} in this period</p>
        </div>
        <div className="flex p-0.5 bg-ink-800 rounded-lg shrink-0" role="group" aria-label="Sort transactions">
          {[['newest', 'Newest'], ['largest', 'Largest']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors touch-manipulation ${
                sort === key ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-ink-800 border-t border-ink-800">
        {sorted.slice(0, limit).map(entry => (
          <li key={entry.id}>
            <TransactionRow entry={entry} onEdit={onEdit} />
          </li>
        ))}
      </ul>

      {sorted.length > limit && (
        <button
          onClick={() => setLimit(l => l + TRANSACTIONS_PAGE)}
          className="w-full py-3 text-sm font-medium text-accent hover:text-accent-light border-t border-ink-800 touch-manipulation"
        >
          Show more ({sorted.length - limit} left)
        </button>
      )}
    </section>
  );
}

function TransactionRow({ entry, onEdit }) {
  const isPersonal = entry.source === 'personal';
  const category = entryCategory(entry);
  const detail = isPersonal ? category.label : entry.groupName;

  const content = (
    <>
      <span className="w-9 h-9 rounded-lg bg-ink-800 flex items-center justify-center text-lg shrink-0" aria-hidden>
        {category.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink-100 truncate">{entry.title}</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-500 min-w-0">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: SOURCE_COLORS[entry.source] }} aria-hidden />
          <span className="truncate">
            {formatBS(entry.date, { withYear: false })} · {isPersonal ? 'Personal' : 'Group'}{detail !== entry.title ? ` · ${detail}` : ''}
          </span>
        </span>
      </span>
      <span className="text-sm font-semibold text-ink-100 shrink-0">{formatRs(entry.amount)}</span>
    </>
  );

  const className = 'w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-ink-800/60 active:bg-ink-800 transition-colors touch-manipulation';

  if (isPersonal) {
    return (
      <button
        className={className}
        onClick={() => onEdit({ _id: entry.id, title: entry.title, amount: entry.amount, category: entry.category, note: entry.note, date: entry.date })}
        aria-label={`${entry.title}, ${formatRs(entry.amount)}. Edit`}
      >
        {content}
      </button>
    );
  }
  return entry.groupId ? (
    <Link to={`/groups/${entry.groupId}`} className={className} aria-label={`${entry.title}, ${formatRs(entry.amount)} in ${entry.groupName}. Open group`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
