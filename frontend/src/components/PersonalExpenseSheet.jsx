import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { CATEGORIES, getCategory, getLastCategory, rememberCategory } from '../utils/expenses';
import { PERSONAL_ITEMS, findItem, quickPicksFor, rememberItems, suggestionsFor } from '../utils/catalog';
import { addDays, formatBS, parseISODate, toISODate } from '../utils/nepaliDate';
import ItemSearchInput from './ItemSearchInput';
import QuickPicks from './QuickPicks';
import Spinner from './Spinner';

// Add or edit a personal expense. Bottom sheet on mobile, dialog on desktop.
// `expense` is the entry being edited; omit it to add a new one.
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
  const [showNote, setShowNote] = useState(Boolean(expense?.note));
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

  const category = getCategory(form.category);
  const amountNumber = Number(form.amount);
  const amountValid = form.amount !== '' && Number.isFinite(amountNumber) && amountNumber > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!amountValid) {
      setError('Enter an amount greater than 0');
      amountRef.current?.focus();
      return;
    }
    if (!form.date) {
      setError('Pick a date');
      return;
    }

    setSaving(true);
    const payload = {
      amount: amountNumber,
      // The title is optional in the form; fall back to the category name. A
      // known item is saved under its list name ("pathao" -> "Pathao").
      title: matchedItem?.name || form.title.trim() || category.label,
      category: form.category,
      date: form.date,
      note: showNote ? form.note.trim() : ''
    };
    try {
      const { data } = isEdit
        ? await api.put(`/personal-expenses/${expense._id}`, payload)
        : await api.post('/personal-expenses', payload);
      rememberCategory(form.category);
      if (form.title.trim()) rememberItems('personal', [{ name: payload.title, category: form.category }]);
      onSaved(data.expense, { isEdit });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the expense. Please try again.');
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-sheet-title"
    >
      <div
        className="w-full sm:max-w-md bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 slide-up sm:scale-in max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-3 sm:pt-6 pb-6 space-y-5" noValidate>
          <div className="flex items-center justify-between">
            <h2 id="expense-sheet-title" className="text-base sm:text-lg font-semibold text-ink-100">
              {isEdit ? 'Edit expense' : 'Add expense'}
            </h2>
            <button type="button" onClick={onClose} className="text-ink-500 hover:text-ink-300 p-1 -mr-1 touch-manipulation" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg" role="alert">{error}</div>
          )}

          {!isEdit && <QuickPicks picks={quickPicks} categoryFor={getCategory} onPick={pickItem} />}

          {/* Amount */}
          <div>
            <label className="label" htmlFor="expense-amount">Amount</label>
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
            {form.title.trim() && (
              <p className="text-xs text-ink-500 mt-1.5" aria-live="polite">
                {matchedItem
                  ? `${category.emoji} Category set to ${category.label}`
                  : 'Not in the list. Pick a category below.'}
              </p>
            )}
          </div>

          {/* Category */}
          <fieldset>
            <legend className="label">Category</legend>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => {
                const selected = c.key === form.category;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => set('category')(c.key)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors touch-manipulation min-h-[60px] ${
                      selected
                        ? 'border-accent bg-accent/10 text-ink-100'
                        : 'border-ink-800 bg-ink-800/50 text-ink-400 hover:border-ink-700 hover:text-ink-200'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="text-lg leading-none" aria-hidden>{c.emoji}</span>
                    <span className="text-center leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Date */}
          <div>
            <label className="label" htmlFor="expense-date">Date</label>
            <div className="flex gap-2 mb-2">
              {[{ label: 'Today', value: today }, { label: 'Yesterday', value: yesterday }].map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => set('date')(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation ${
                    form.date === opt.value
                      ? 'border-accent bg-accent/10 text-accent-light'
                      : 'border-ink-700 text-ink-400 hover:text-ink-200'
                  }`}
                  aria-pressed={form.date === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              id="expense-date"
              type="date"
              className="input-field"
              max={today}
              value={form.date}
              onChange={e => set('date')(e.target.value)}
              required
            />
            {pickedDate && (
              <p className="text-xs text-ink-500 mt-1.5" aria-live="polite">
                {formatBS(pickedDate)} BS
              </p>
            )}
          </div>

          {/* Note */}
          {showNote ? (
            <div>
              <label className="label" htmlFor="expense-note">Note</label>
              <textarea
                id="expense-note"
                className="input-field min-h-[80px] resize-y"
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

          <div className="flex gap-2 pt-1">
            {isEdit && (
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
            )}
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner /> : isEdit ? 'Save' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
