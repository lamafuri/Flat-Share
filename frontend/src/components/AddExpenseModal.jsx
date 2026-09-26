import { useState, useEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import api from "../utils/api";
import { GROUP_CATEGORIES, GROUP_ITEMS, findItem, getGroupCategory, quickPicksFor, rememberItems, suggestionsFor } from "../utils/catalog";
import { toISODate } from "../utils/nepaliDate";
import ItemSearchInput from "./ItemSearchInput";
import QuickPicks from "./QuickPicks";
import Spinner from "./Spinner";

const emptyRow = () => ({ itemName: "", price: "", category: "other" });

export default function AddExpenseModal({ groupId, onClose, onAdded }) {
  const [items, setItems] = useState([emptyRow()]);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef(null);
  const priceRefs = useRef([]);
  const suggestions = useMemo(() => suggestionsFor("group", GROUP_ITEMS), []);
  const quickPicks = useMemo(() => quickPicksFor("group", GROUP_ITEMS), []);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const addRow = () => setItems(i => [...i, emptyRow()]);
  const removeRow = (idx) => setItems(i => i.filter((_, j) => j !== idx));
  const updateRow = (idx, changes) => {
    setItems(rows => rows.map((row, j) => (j === idx ? { ...row, ...changes } : row)));
  };

  // A known item decides the category; anything else keeps the one picked.
  const setItemName = (idx, itemName) => {
    const known = findItem(suggestions, itemName);
    updateRow(idx, { itemName, ...(known && { category: known.category }) });
  };

  // After a pick, move straight to that row's price. The row is rendered
  // synchronously and focused right here: a focus deferred to an effect could
  // land after the user has moved on and pull the cursor away from them.
  const pickItem = (idx, item) => {
    flushSync(() => updateRow(idx, { itemName: item.name, category: item.category }));
    priceRefs.current[idx]?.focus();
  };

  // Quick picks fill the first empty row, or add a new one.
  const quickAdd = (item) => {
    const empty = items.findIndex(row => !row.itemName.trim());
    const idx = empty === -1 ? items.length : empty;
    flushSync(() => setItems(rows => {
      const next = empty === -1 ? [...rows, emptyRow()] : [...rows];
      next[idx] = { ...next[idx], itemName: item.name, category: item.category };
      return next;
    }));
    priceRefs.current[idx]?.focus();
  };

  const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = items
      .map(item => ({
        // A known item is saved under its list name ("pathao" -> "Pathao").
        itemName: findItem(suggestions, item.itemName)?.name || item.itemName.trim() || "Other",
        price: parseFloat(item.price) || 0,
        category: item.category,
      }))
      .filter(i => i.itemName && i.price > 0);

    if (!payload.length) {
      setError("Add at least one item with a price");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post(`/expenses/group/${groupId}`, { items: payload, date });
      rememberItems("group", payload.map(i => ({ name: i.itemName, category: i.category })));
      onAdded(data.expense);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add expenses");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Add expenses"
    >
      {/* Modal panel — bottom sheet on mobile, centered on desktop */}
      <div
        ref={modalRef}
        className="w-full sm:max-w-lg bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 max-h-[92vh] sm:max-h-[85vh] flex flex-col slide-up sm:scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-ink-800">
          <h2 className="text-base sm:text-lg font-semibold">Add Expenses</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-accent font-semibold">Rs {total.toFixed(0)}</span>
            <button onClick={onClose} className="btn-icon w-8 h-8 sm:w-9 sm:h-9 text-ink-400 touch-manipulation" aria-label="Close">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4" role="alert">
              {error}
            </div>
          )}

          <form id="expense-form" onSubmit={handleSubmit}>
            {/* Date */}
            <div className="mb-4">
              <label className="label" htmlFor="expense-date">Date</label>
              <input
                id="expense-date"
                type="date"
                className="input-field"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <QuickPicks picks={quickPicks} categoryFor={getGroupCategory} onPick={quickAdd} />
            </div>

            {/* Items */}
            <div className="mb-3">
              <label className="label">Items</label>
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const known = Boolean(item.itemName.trim() && findItem(suggestions, item.itemName));
                  return (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Item name */}
                        <ItemSearchInput
                          items={suggestions}
                          categoryFor={getGroupCategory}
                          value={item.itemName}
                          onChange={name => setItemName(idx, name)}
                          onPick={picked => pickItem(idx, picked)}
                          placeholder="Search items, e.g. Milk"
                          required
                          aria-label={`Item ${idx + 1} name`}
                        />
                        {/* Category: set by a known item, chosen by hand otherwise */}
                        <select
                          value={item.category}
                          onChange={e => updateRow(idx, { category: e.target.value })}
                          disabled={known}
                          className="w-full bg-transparent text-xs text-ink-400 border border-ink-800 rounded-md px-2 py-1.5 focus:outline-none focus:border-accent disabled:opacity-100 disabled:border-transparent disabled:px-0 disabled:appearance-none"
                          aria-label={`Item ${idx + 1} category`}
                          title={known ? "Set from the item list" : "Choose a category"}
                        >
                          {GROUP_CATEGORIES.map(c => (
                            <option key={c.key} value={c.key} className="bg-ink-900">{c.emoji} {c.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* Price */}
                      <div className="w-24 sm:w-28 shrink-0">
                        <input
                          ref={el => { priceRefs.current[idx] = el; }}
                          type="number"
                          className="input-field"
                          placeholder="Price"
                          min="0"
                          step="1"
                          value={item.price}
                          onChange={e => updateRow(idx, { price: e.target.value })}
                          required
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={`Item ${idx + 1} price`}
                        />
                      </div>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={items.length === 1}
                        className="mt-1 btn-icon w-10 h-10 text-ink-600 hover:text-danger disabled:opacity-30 touch-manipulation shrink-0"
                        aria-label={`Remove item ${idx + 1}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add row */}
              <button
                type="button"
                onClick={addRow}
                className="mt-3 text-sm text-accent hover:text-accent-light flex items-center gap-1.5 transition-colors touch-manipulation py-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another item
              </button>
            </div>
          </form>
        </div>

        {/* Footer actions */}
        <div className="px-4 sm:px-6 py-4 border-t border-ink-800 flex gap-2.5">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="expense-form"
            className="btn-primary flex-1"
            disabled={loading}
          >
            {loading ? <Spinner /> : `Save Rs ${total.toFixed(0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
