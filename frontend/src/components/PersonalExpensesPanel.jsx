import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import PersonalExpenseSheet from './PersonalExpenseSheet';
import Toast from './Toast';
import { formatRs, getCategory } from '../utils/expenses';
import { addDays, bsMonthRange, formatBS, shiftBSMonth, toBS, toISODate } from '../utils/nepaliDate';

const PAGE_SIZE = 100;

const currentBSMonth = () => {
  const bs = toBS(new Date());
  return bs ? { year: bs.year, monthIndex: bs.monthIndex } : null;
};

const sameMonth = (a, b) => a && b && a.year === b.year && a.monthIndex === b.monthIndex;

const byNewest = (a, b) =>
  new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt);

// Personal expenses for one BS month, grouped by day. The parent opens the
// add sheet through the ref (`openAdd`).
const PersonalExpensesPanel = forwardRef(function PersonalExpensesPanel(_, ref) {
  const [month, setMonth] = useState(currentBSMonth);
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState(null); // { expense? }
  const [toast, setToast] = useState(null);

  const range = useMemo(() => (month ? bsMonthRange(month) : null), [month]);
  const isCurrentMonth = sameMonth(month, currentBSMonth());
  // Latest range for callbacks that finish later (Undo), and a counter so a
  // slow response for a previous month cannot overwrite the current one.
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const requestRef = useRef(0);

  useImperativeHandle(ref, () => ({ openAdd: () => setSheet({}) }), []);

  const fetchPage = useCallback(async (skip) => {
    const { data } = await api.get('/personal-expenses', {
      params: { from: toISODate(range.start), to: toISODate(range.end), limit: PAGE_SIZE, skip }
    });
    return data;
  }, [range]);

  const load = useCallback(async () => {
    if (!range) return;
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      const data = await fetchPage(0);
      if (requestId !== requestRef.current) return;
      setExpenses(data.expenses);
      setTotal(data.total);
      setTotalAmount(data.totalAmount);
      setStatus('ready');
    } catch {
      if (requestId === requestRef.current) setStatus('error');
    } finally {
      if (requestId === requestRef.current) setRefreshing(false);
    }
  }, [fetchPage, range]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    const requestId = requestRef.current;
    setLoadingMore(true);
    try {
      const data = await fetchPage(expenses.length);
      if (requestId !== requestRef.current) return;
      setExpenses(list => [...list, ...data.expenses]);
      setTotal(data.total);
      setTotalAmount(data.totalAmount);
    } catch {
      showToast({ message: 'Could not load more expenses' });
    } finally {
      setLoadingMore(false);
    }
  };

  // ISO day strings compare correctly as text.
  const inShownMonth = (expense) => {
    const shown = rangeRef.current;
    const day = toISODate(expense.date);
    return Boolean(shown) && day >= toISODate(shown.start) && day <= toISODate(shown.end);
  };

  const showToast = (next) => setToast({ id: Date.now(), ...next });

  const handleSaved = (saved, { isEdit }) => {
    setSheet(null);
    const previous = expenses.find(e => e._id === saved._id);

    if (inShownMonth(saved)) {
      setExpenses(list => [...list.filter(e => e._id !== saved._id), saved].sort(byNewest));
      setTotal(t => t + (previous ? 0 : 1));
      setTotalAmount(a => a - (previous?.amount || 0) + saved.amount);
      showToast({ message: isEdit ? 'Expense updated' : 'Expense added' });
    } else {
      // Saved to a different month: drop it from this view and offer to go there.
      if (previous) {
        setExpenses(list => list.filter(e => e._id !== saved._id));
        setTotal(t => t - 1);
        setTotalAmount(a => a - previous.amount);
      }
      const bs = toBS(saved.date);
      showToast({
        message: bs ? `Saved to ${bs.monthName} ${bs.year}` : 'Expense saved',
        actionLabel: bs ? 'View' : undefined,
        onAction: () => bs && setMonth({ year: bs.year, monthIndex: bs.monthIndex })
      });
    }
  };

  const handleDeleted = (deleted) => {
    setSheet(null);
    setExpenses(list => list.filter(e => e._id !== deleted._id));
    setTotal(t => t - 1);
    setTotalAmount(a => a - deleted.amount);
    showToast({
      message: 'Expense deleted',
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          const { data } = await api.post('/personal-expenses', {
            title: deleted.title,
            amount: deleted.amount,
            category: deleted.category,
            date: toISODate(deleted.date),
            note: deleted.note
          });
          if (inShownMonth(data.expense)) {
            setExpenses(list => [...list, data.expense].sort(byNewest));
            setTotal(t => t + 1);
            setTotalAmount(a => a + data.expense.amount);
          }
        } catch {
          showToast({ message: 'Could not restore the expense' });
        }
      }
    });
  };

  const days = useMemo(() => {
    const groups = new Map();
    for (const expense of expenses) {
      const key = toISODate(expense.date);
      if (!groups.has(key)) groups.set(key, { key, date: new Date(expense.date), items: [], total: 0 });
      const group = groups.get(key);
      group.items.push(expense);
      group.total += expense.amount;
    }
    return [...groups.values()];
  }, [expenses]);

  if (!month || !range) {
    return <p className="text-sm text-ink-500">Personal expenses are not available for this date.</p>;
  }

  const bsLabel = `${toBS(range.start).monthName} ${month.year}`;
  const todayKey = toISODate(new Date());
  const yesterdayKey = toISODate(addDays(new Date(), -1));

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(m => shiftBSMonth(m, -1))}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-800 touch-manipulation"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-sm sm:text-base font-semibold text-ink-100 min-w-[120px] text-center" aria-live="polite">{bsLabel}</h2>
          <button
            onClick={() => setMonth(m => shiftBSMonth(m, 1))}
            disabled={isCurrentMonth}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-800 touch-manipulation disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={() => setMonth(currentBSMonth())} className="text-xs font-medium text-accent hover:text-accent-light touch-manipulation px-2 py-1.5">
            Back to this month
          </button>
        )}
      </div>

      {/* Month summary */}
      <div className="card p-4 sm:p-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-500">Spent in {bsLabel}</p>
          <p className="text-2xl sm:text-3xl font-semibold text-ink-100 mt-1 truncate">{formatRs(totalAmount)}</p>
          <p className="text-xs text-ink-500 mt-1">
            {total} expense{total !== 1 ? 's' : ''} · {formatBS(range.start, { withYear: false })} – {formatBS(range.end, { withYear: false })}
          </p>
        </div>
        <Link to="/expenses" className="shrink-0 text-xs sm:text-sm font-medium text-accent hover:text-accent-light flex items-center gap-1 touch-manipulation py-1">
          Insights
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>

      {/* List */}
      {status === 'loading' ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-label="Loading" />
        </div>
      ) : status === 'error' ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-300">Could not load your expenses.</p>
          <button onClick={load} className="btn-ghost mt-3">Try again</button>
        </div>
      ) : days.length === 0 ? (
        <div className="card text-center py-10 px-4 fade-in">
          <div className="text-4xl mb-3" aria-hidden>🧾</div>
          <p className="text-ink-300 font-medium text-sm sm:text-base">No expenses in {bsLabel}</p>
          <p className="text-ink-500 text-xs sm:text-sm mt-1">
            {isCurrentMonth ? 'Track your daily spending to see where your money goes.' : 'Nothing was recorded this month.'}
          </p>
          <button onClick={() => setSheet({})} className="btn-primary mt-4 inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add expense
          </button>
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
          {days.map(day => (
            <section key={day.key} className="card overflow-hidden" aria-label={formatBS(day.date)}>
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-ink-800 bg-ink-900">
                <h3 className="text-xs font-medium text-ink-400">
                  {formatBS(day.date, { withYear: false })}
                  <span className="text-ink-600">
                    {' · '}
                    {day.key === todayKey ? 'Today' : day.key === yesterdayKey ? 'Yesterday' : day.date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </h3>
                <span className="text-xs font-medium text-ink-300">{formatRs(day.total)}</span>
              </header>
              <ul className="divide-y divide-ink-800">
                {day.items.map(expense => {
                  const category = getCategory(expense.category);
                  // Untitled expenses use the category name as their title; don't repeat it.
                  const details = [expense.title !== category.label && category.label, expense.note].filter(Boolean).join(' · ');
                  return (
                    <li key={expense._id}>
                      <button
                        onClick={() => setSheet({ expense })}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-800/60 active:bg-ink-800 transition-colors touch-manipulation"
                        aria-label={`${expense.title}, ${formatRs(expense.amount)}. Edit`}
                      >
                        <span className="w-9 h-9 rounded-lg bg-ink-800 flex items-center justify-center text-lg shrink-0" aria-hidden>{category.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink-100 truncate">{expense.title}</span>
                          {details && <span className="block text-xs text-ink-500 truncate">{details}</span>}
                        </span>
                        <span className="text-sm font-semibold text-ink-100 shrink-0">{formatRs(expense.amount)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {expenses.length < total && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-ghost w-full">
              {loadingMore ? 'Loading…' : `Show more (${total - expenses.length} left)`}
            </button>
          )}
        </div>
      )}

      {sheet && (
        <PersonalExpenseSheet
          expense={sheet.expense}
          onClose={() => setSheet(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
});

export default PersonalExpensesPanel;
