import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { CATEGORIES, formatRs, getCategory, getLastCategory, rememberCategory } from '../utils/expenses';
import { PERSONAL_ITEMS, findItem, quickPicksFor, rememberItems, suggestionsFor } from '../utils/catalog';
import { addDays, formatBS, parseISODate, toISODate } from '../utils/nepaliDate';
import ItemSearchInput from './ItemSearchInput';
import QuickPicks from './QuickPicks';
import Spinner from './Spinner';

const MAX_ITEMS = 30;

const blankItem = (category) => ({ amount: '', title: '', category, note: '' });

// Add or edit personal expenses. Bottom sheet on mobile, dialog on desktop.
// `expense` is the entry being edited; omit it to add new ones. When adding,
// "Add another item" moves the filled-in item to a list above the form so
// several can be saved together on one date. `onSaved` receives the array of
// saved expenses.
export default function PersonalExpenseSheet({ expense, onClose, onSaved, onDeleted }) {
  const isEdit = Boolean(expense);
  const today = toISODate(new Date());
  const yesterday = toISODate(addDays(new Date(), -1));

  const [form, setForm] = useState(() => ({
    amount: expense ? String(expense.amount) : '',
    // Untitled expenses store the category name; show them as untitled so a
    // category change does not leave a stale title behind.
    title: expense && expense.title !== getCategory(expense.category).label ? expense.title : '',
    category: expense?.category || getLastCategory(),
    date: expense ? toISODate(expense.date) : today,
    note: expense?.note || ''
  }));
  const [staged, setStaged] = useState([]); // items queued with "Add another item"
  const [showNote, setShowNote] = useState(Boolean(expense?.note));
  const [choosingCategory, setChoosingCategory] = useState(false);
  const bodyRef = useRef(null);
  const listRef = useRef(null);
  const chipRowRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const amountRef = useRef(null);
  const suggestions = useMemo(() => suggestionsFor('personal', PERSONAL_ITEMS), []);
  const quickPicks = useMemo(() => quickPicksFor('personal', PERSONAL_ITEMS), []);

  const set = (field) => (value) => setForm(f => ({ ...f, [field]: value }));

  // A known item decides the category; anything else keeps the one picked.
  const matchedItem = findItem(suggestions, form.title);
  const setTitle = (title) => {
    const item = findItem(suggestions, title);
    setForm(f => ({ ...f, title, ...(item && { category: item.category }) }));
  };
  const pickItem = (item) => {
    setForm(f => ({ ...f, title: item.name, category: item.category }));
    if (!amountValid) amountRef.current?.focus();
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const row = chipRowRef.current;
    const chip = row?.querySelector('[aria-pressed="true"]');
    if (row && chip && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    }
  }, [form.category, choosingCategory, matchedItem]);

  const category = getCategory(form.category);
  const amountNumber = Number(form.amount);
  const amountValid = form.amount !== '' && Number.isFinite(amountNumber) && amountNumber > 0;

  // The form as a save payload (without the date). The title is optional;
  // fall back to the category name. A known item is saved under its list
  // name ("pathao" -> "Pathao").
  const formItem = () => ({
    amount: amountNumber,
    title: matchedItem?.name || form.title.trim() || category.label,
    category: form.category,
    note: showNote ? form.note.trim() : '',
    named: Boolean(form.title.trim())
  });
  const formTouched = form.amount !== '' || form.title.trim() !== '';

  const requireAmount = () => {
    setError('Enter an amount greater than 0');
    amountRef.current?.focus();
  };

  // Clears the form for the next item and brings it back into view.
  const resetForm = (next = blankItem(form.category)) => {
    setForm(f => ({ ...f, ...next }));
    setShowNote(Boolean(next.note));
    setChoosingCategory(false);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    amountRef.current?.focus({ preventScroll: true });
  };

  const stageCurrent = () => {
    setError('');
    if (!amountValid) return requireAmount();
    if (staged.length + 1 >= MAX_ITEMS) {
      setError(`You can add up to ${MAX_ITEMS} items at once`);
      return;
    }
    setStaged(list => [...list, { ...formItem(), key: Date.now() + Math.random() }]);
    resetForm();
  };

  // Move a queued item back into the form; a filled-in form takes its place
  // in the list so nothing is lost.
  const editStaged = (item) => {
    setError('');
    setStaged(list => {
      const rest = list.filter(i => i.key !== item.key);
      return amountValid ? [...rest, { ...formItem(), key: Date.now() + Math.random() }] : rest;
    });
    resetForm({
      amount: String(item.amount),
      title: item.named ? item.title : '',
      category: item.category,
      note: item.note
    });
  };

  const removeStaged = (key) => setStaged(list => list.filter(i => i.key !== key));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.date) {
      setError('Pick a date');
      return;
    }

    // With items queued, an untouched form is simply left out.
    const includeForm = !staged.length || formTouched;
    if (includeForm && !amountValid) return requireAmount();
    const items = [...staged, ...(includeForm ? [formItem()] : [])];

    setSaving(true);
    try {
      const payload = items.map(({ amount, title, category: key, note }) => ({ amount, title, category: key, note }));
      let saved;
      if (isEdit) {
        const { data } = await api.put(`/personal-expenses/${expense._id}`, { ...payload[0], date: form.date });
        saved = [data.expense];
      } else {
        const { data } = await api.post('/personal-expenses/bulk', { date: form.date, items: payload });
        saved = data.expenses;
      }
      rememberCategory(items[items.length - 1].category);
      const named = items.filter(i => i.named).map(i => ({ name: i.title, category: i.category }));
      if (named.length) rememberItems('personal', named);
      onSaved(saved, { isEdit });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await api.delete(`/personal-expenses/${expense._id}`);
      onDeleted(expense);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the expense.');
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const pickedDate = form.date ? parseISODate(form.date) : null;
  const saveCount = staged.length + (formTouched || !staged.length ? 1 : 0);
  const saveTotal = staged.reduce((t, i) => t + i.amount, 0) + (amountValid ? amountNumber : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-sheet-title"
    >
      {/* Header and action bar stay put; only the fields scroll, so adding
          several items never means scrolling to reach a button. */}
      <div
        className="w-full sm:max-w-md bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 slide-up sm:scale-in max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1" noValidate>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-2 sm:pt-5 pb-3 border-b border-ink-800">
            <div className="min-w-0">
              <h2 id="expense-sheet-title" className="text-base sm:text-lg font-semibold text-ink-100">
                {isEdit ? 'Edit expense' : staged.length ? 'Add expenses' : 'Add expense'}
              </h2>
              {staged.length > 0 && (
                <button
                  type="button"
                  onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                  className="text-xs text-accent hover:text-accent-light touch-manipulation"
                >
                  {staged.length} added · {formatRs(staged.reduce((t, i) => t + i.amount, 0))} · View
                </button>
              )}
            </div>
            <button type="button" onClick={onClose} className="text-ink-500 hover:text-ink-300 p-1 -mr-1 touch-manipulation shrink-0" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 sm:px-6 py-4 space-y-4">
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg" role="alert">{error}</div>
            )}

            {/* Date: one compact row, set once for every item */}
            <div className="flex items-center gap-1.5">
              {[{ label: 'Today', value: today }, { label: 'Yesterday', value: yesterday }].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => set('date')(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation shrink-0 ${
                    form.date === opt.value
                      ? 'border-accent bg-accent/10 text-accent-light'
                      : 'border-ink-700 text-ink-400 hover:text-ink-200'
                  }`}
                  aria-pressed={form.date === opt.value}
                >
                  {opt.label}
                </button>
              ))}
              <label htmlFor="expense-date" className="sr-only">Date</label>
              <input
                id="expense-date"
                type="date"
                className="flex-1 min-w-0 bg-ink-800/50 border border-ink-800 rounded-full px-3 py-1 text-xs text-ink-300 focus:outline-none focus:border-accent"
                max={today}
                value={form.date}
                onChange={e => set('date')(e.target.value)}
                required
              />
            </div>
            {pickedDate && (
              <p className="text-xs text-ink-500 -mt-2" aria-live="polite">
                {formatBS(pickedDate)} BS{saveCount > 1 ? ` · all ${saveCount} items are saved on this day` : ''}
              </p>
            )}

            {!isEdit && <QuickPicks picks={quickPicks} categoryFor={getCategory} onPick={pickItem} />}

            {/* Amount */}
            <div>
              <label className="label" htmlFor="expense-amount">{staged.length ? `Item ${staged.length + 1} · Amount` : 'Amount'}</label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-ink-500 font-medium pointer-events-none">Rs</span>
                <input
                  ref={amountRef}
                  id="expense-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="input-field pl-11 sm:pl-12 text-2xl sm:text-2xl font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => set('amount')(e.target.value)}
                  autoFocus={!isEdit}
                  required
                />
              </div>
            </div>

            {/* Item */}
            <div>
              <label className="label" htmlFor="expense-title">
                What for? <span className="normal-case tracking-normal text-ink-600">(optional)</span>
              </label>
              <ItemSearchInput
                id="expense-title"
                items={suggestions}
                categoryFor={getCategory}
                placeholder={category.placeholder}
                maxLength={100}
                value={form.title}
                onChange={setTitle}
                onPick={pickItem}
              />
            </div>

            {/* Category: a known item sets it, so show one line; otherwise a
                single scrollable row of chips instead of a tall grid. */}
            <fieldset>
              <legend className="label">Category</legend>
              {matchedItem && !choosingCategory ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-800/40 px-3 py-2" aria-live="polite">
                  <span className="text-sm text-ink-200">
                    <span aria-hidden>{category.emoji}</span> {category.label}
                    <span className="text-xs text-ink-500"> · set from the item</span>
                  </span>
                  <button type="button" onClick={() => setChoosingCategory(true)} className="text-xs font-medium text-accent hover:text-accent-light touch-manipulation shrink-0">
                    Change
                  </button>
                </div>
              ) : (
                <div ref={chipRowRef} className="relative flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-1 [scrollbar-width:none]">
                  {CATEGORIES.map(c => {
                    const selected = c.key === form.category;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => set('category')(c.key)}
                        className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors touch-manipulation ${
                          selected
                            ? 'border-accent bg-accent/10 text-ink-100'
                            : 'border-ink-800 bg-ink-800/50 text-ink-400 hover:border-ink-700 hover:text-ink-200'
                        }`}
                        aria-pressed={selected}
                      >
                        <span aria-hidden>{c.emoji}</span>{c.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            {/* Note */}
            {showNote ? (
              <div>
                <label className="label" htmlFor="expense-note">Note</label>
                <textarea
                  id="expense-note"
                  className="input-field min-h-[64px] resize-y"
                  maxLength={500}
                  value={form.note}
                  onChange={e => set('note')(e.target.value)}
                  autoFocus={!expense?.note}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowNote(true)} className="text-sm text-accent hover:text-accent-light touch-manipulation">
                + Add a note
              </button>
            )}

            {/* Items already added sit below the form, so the form never moves down. */}
            {staged.length > 0 && (
              <section ref={listRef} aria-label="Items added" className="pt-1">
                <div className="flex items-baseline justify-between mb-1.5">
                  <p className="label mb-0">Added ({staged.length})</p>
                  <p className="text-xs text-ink-500">Tap one to edit</p>
                </div>
                <ul className="rounded-lg border border-ink-800 divide-y divide-ink-800 overflow-hidden">
                  {staged.map(item => (
                    <li key={item.key} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => editStaged(item)}
                        className="flex-1 min-w-0 flex items-center gap-2.5 pl-3 py-2.5 text-left hover:bg-ink-800/60 touch-manipulation"
                        aria-label={`${item.title}, ${formatRs(item.amount)}. Edit`}
                      >
                        <span className="text-base leading-none" aria-hidden>{getCategory(item.category).emoji}</span>
                        <span className="flex-1 min-w-0 text-sm text-ink-200 truncate">{item.title}</span>
                        <span className="text-sm font-medium text-ink-100 tabular-nums shrink-0">{formatRs(item.amount)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStaged(item.key)}
                        className="w-10 h-10 flex items-center justify-center text-ink-600 hover:text-danger shrink-0 touch-manipulation"
                        aria-label={`Remove ${item.title}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Action bar: always visible */}
          <div className="flex gap-2 px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-5 border-t border-ink-800">
            {isEdit ? (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className={`px-4 rounded-lg text-sm font-medium border transition-colors touch-manipulation min-h-[44px] disabled:opacity-40 ${
                    confirmDelete ? 'bg-danger text-white border-danger' : 'border-ink-700 text-danger hover:bg-danger/10'
                  }`}
                >
                  {confirmDelete ? 'Tap to confirm' : 'Delete'}
                </button>
                <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
              </>
            ) : (
              <button
                type="button"
                onClick={stageCurrent}
                className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-accent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another
              </button>
            )}
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner /> : isEdit ? 'Save' : saveCount > 1 ? `Save ${saveCount} · ${formatRs(saveTotal)}` : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
