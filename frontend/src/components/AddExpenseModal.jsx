import { useState, useEffect, useRef } from "react";
import api from "../utils/api";
import { COMMON_ITEMS } from "../utils/items";

export default function AddExpenseModal({ groupId, onClose, onAdded }) {
  const [items, setItems] = useState([{ itemName: "", price: "" }]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef(null);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const addRow = () => setItems(i => [...i, { itemName: "", price: "" }]);
  const removeRow = (idx) => setItems(i => i.filter((_, j) => j !== idx));
  const updateRow = (idx, field, value) => {
    setItems(items.map((item, j) => (j === idx ? { ...item, [field]: value } : item)));
  };

  const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const payload = items
      .map(item => ({
        itemName: item.itemName.trim() || "Other",
        price: parseFloat(item.price) || 0,
      }))
      .filter(i => i.itemName && i.price > 0);

    if (!payload.length) {
      setError("Add at least one item with a price");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post(`/expenses/group/${groupId}`, { items: payload, date });
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

            {/* Items */}
            <div className="mb-3">
              <label className="label">Items</label>
              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    {/* Item name */}
                    <div className="flex-1 min-w-0">
                      <input
                        className="input-field"
                        value={item.itemName}
                        onChange={e => updateRow(idx, "itemName", e.target.value)}
                        list="item-name-list"
                        placeholder="Item name"
                        required
                        aria-label={`Item ${idx + 1} name`}
                      />
                    </div>
                    {/* Price */}
                    <div className="w-24 sm:w-28 shrink-0">
                      <input
                        type="number"
                        className="input-field"
                        placeholder="Price"
                        min="0"
                        step="1"
                        value={item.price}
                        onChange={e => updateRow(idx, "price", e.target.value)}
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
                ))}
              </div>

              {/* Datalist for suggestions */}
              <datalist id="item-name-list">
                {COMMON_ITEMS.map(ci => <option key={ci} value={ci} />)}
              </datalist>

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

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />;
}
