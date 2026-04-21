import { useState } from "react";
import api from "../utils/api";
import { COMMON_ITEMS } from "../utils/items";

export default function AddExpenseModal({ groupId, onClose, onAdded }) {
	const [items, setItems] = useState([{ itemName: "", customName: "", price: "" }]);
	const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const addRow = () => setItems((i) => [...i, { itemName: "", customName: "", price: "" }]);

	const removeRow = (idx) => setItems((i) => i.filter((_, j) => j !== idx));

	const updateRow = (idx, field, value) => {
		setItems(items.map((item, j) => (j === idx ? { ...item, [field]: value } : item)));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		const payload = items
			.map((item) => ({
				itemName: item.itemName === "Other" ? item.customName || "Other" : item.itemName,
				price: parseFloat(item.price) || 0,
			}))
			.filter((i) => i.itemName && i.price > 0);

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
		<div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/60 backdrop-blur-sm overflow-y-auto">
			<div className="card p-6 w-full max-w-lg mb-8">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-lg font-semibold">Add Expenses</h2>
					<button onClick={onClose} className="text-ink-500 hover:text-ink-300 transition-colors">
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{error && (
					<div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<label className="label">Date</label>
						<input
							type="date"
							className="input-field"
							value={date}
							onChange={(e) => setDate(e.target.value)}
						/>
					</div>

					<div className="mb-3">
						<div className="flex items-center justify-between mb-2">
							<label className="label mb-0">Items</label>
							<span className="text-xs text-ink-500 font-mono">
								Total: Rs {items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0).toFixed(0)}
							</span>
						</div>

						<div className="space-y-2">
							{items.map((item, idx) => (
								<div key={idx} className="flex gap-2 items-start">
									<div className="flex-1 min-w-0">
										<input
											className="input-field"
											value={item.itemName}
											onChange={(e) => updateRow(idx, "itemName", e.target.value)}
                      list='item-name'
											required
										/>
										<datalist id="item-name">
											{COMMON_ITEMS.map((ci) => (
												<option key={ci} value={ci}>
													{ci}
												</option>
											))}
										</datalist>
										{item.itemName === "Other" && (
											<input
												type="text"
												className="input-field mt-1.5"
												placeholder="Describe the item"
												value={item.customName}
												onChange={(e) => updateRow(idx, "customName", e.target.value)}
												required
											/>
										)}
									</div>
									<div className="w-28 shrink-0">
										<input
											type="number"
											className="input-field"
											placeholder="Price"
											min="0"
											step="0.01"
											value={item.price}
											onChange={(e) => updateRow(idx, "price", e.target.value)}
											required
										/>
									</div>
									<button
										type="button"
										onClick={() => removeRow(idx)}
										disabled={items.length === 1}
										className="mt-0.5 text-ink-600 hover:text-danger transition-colors disabled:opacity-30">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>
							))}
						</div>

						<button
							type="button"
							onClick={addRow}
							className="mt-3 text-sm text-accent hover:text-accent-light flex items-center gap-1 transition-colors">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Add another item
						</button>
					</div>

					<div className="flex gap-2 pt-2">
						<button type="button" className="btn-ghost flex-1" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="btn-primary flex-1 flex justify-center" disabled={loading}>
							{loading ? <Spinner /> : "Save Expenses"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function Spinner() {
	return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
