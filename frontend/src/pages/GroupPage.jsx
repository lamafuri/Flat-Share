import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import AddExpenseModal from '../components/AddExpenseModal';
import InviteMemberModal from '../components/InviteMemberModal';
import ReportView from '../components/ReportView';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSwipe } from '../utils/gestures';

const TABS = ['my', 'all', 'report'];
const TAB_LABELS = { my: 'My Items', all: 'All Members', report: 'Report' };
const COUNTRIES = ['Nepal', 'India', 'Other'];

export default function GroupPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [myExpenses, setMyExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const settingsRef = useRef(null);

  const isAdmin = group ? (
    (group.admin?._id?.toString() || group.admin?.toString()) === user._id.toString()
  ) : false;

  const availableTabs = isAdmin ? TABS : TABS.filter(t => t !== 'report');
  const tab = availableTabs[tabIndex] || 'my';

  // Swipe gesture: left = next tab, right = prev tab
  const swipeHandlers = useSwipe({
    onLeft: () => setTabIndex(i => Math.min(i + 1, availableTabs.length - 1)),
    onRight: () => setTabIndex(i => Math.max(i - 1, 0)),
  });

  // Close settings on outside click
  useEffect(() => {
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { fetchGroup(); }, [id]);
  useEffect(() => { if (group && !expensesLoaded) fetchExpenses(); }, [group]);

  const fetchGroup = async () => {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data.group);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load group');
      if (err.response?.status === 404) navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        api.get(`/expenses/group/${id}/mine`),
        api.get(`/expenses/group/${id}`)
      ]);
      setMyExpenses(myRes.data.expenses);
      setAllExpenses(allRes.data.expenses);
      setExpensesLoaded(true);
    } catch (err) {
      console.error('Expenses fetch failed:', err);
    }
  };

  const handleExpenseAdded = (expense) => {
    setMyExpenses(e => [expense, ...e]);
    setAllExpenses(e => [expense, ...e]);
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      setMyExpenses(e => e.filter(x => x._id !== expenseId));
      setAllExpenses(e => e.filter(x => x._id !== expenseId));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error && !group) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-danger mb-4">{error}</p>
          <Link to="/dashboard" className="btn-ghost">← Back</Link>
        </div>
      </Layout>
    );
  }

  if (!group) return null;

  const adminId = group.admin?._id?.toString() || group.admin?.toString();
  const memberCount = group.members.length;

  const byMember = {};
  allExpenses.forEach(exp => {
    const uid = exp.user._id;
    if (!byMember[uid]) byMember[uid] = { user: exp.user, expenses: [], total: 0 };
    byMember[uid].expenses.push(exp);
    byMember[uid].total += exp.totalAmount;
  });

  return (
    <Layout>
      {/* ── Group Header ── */}
      <div className="mb-4 sm:mb-6">
        {/* Top row: back + title + actions */}
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link
              to="/dashboard"
              className="text-ink-500 hover:text-ink-300 transition-colors shrink-0 touch-manipulation p-1 -m-1"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-semibold text-ink-100 truncate max-w-[180px] xs:max-w-[220px] sm:max-w-none">
                  {group.name}
                </h1>
                {isAdmin && (
                  <span className="badge bg-accent/10 text-accent border border-accent/20 shrink-0">Admin</span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-ink-500 mt-0.5">
                {group.country} · {memberCount} member{memberCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="btn-ghost hidden xs:flex items-center gap-1.5 text-sm px-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite
              </button>
            )}
            <button
              onClick={() => setShowAddExpense(true)}
              className="btn-primary flex items-center gap-1 sm:gap-1.5 text-sm px-3 sm:px-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden xs:inline">Add</span>
            </button>

            {/* Admin settings */}
            {isAdmin && (
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen(o => !o)}
                  className="btn-icon w-10 h-10"
                  aria-label="Group settings"
                  aria-expanded={settingsOpen}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {settingsOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 card shadow-modal py-1 z-50 scale-in" role="menu">
                    <button
                      className="xs:hidden w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors touch-manipulation"
                      role="menuitem"
                      onClick={() => { setShowInvite(true); setSettingsOpen(false); }}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Invite Member
                    </button>
                    <button
                      onClick={() => { setShowEditModal(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors touch-manipulation"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Group
                    </button>
                    <div className="border-t border-ink-800 my-1" />
                    <button
                      onClick={() => { setShowDeleteConfirm(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors touch-manipulation"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Group
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Members pills — horizontal scroll on mobile */}
        <div className="flex gap-1.5 mt-3 sm:mt-4 overflow-x-auto pb-1 sm:flex-wrap" style={{ scrollbarWidth: 'none' }}>
          {group.members.map(m => {
            const memberId = m.user?._id?.toString() || m.user?.toString();
            const memberIsAdmin = memberId === adminId;
            return (
              <span
                key={memberId}
                className="flex items-center gap-1 bg-ink-800 border border-ink-700 rounded-full px-2.5 py-1 text-xs text-ink-300 shrink-0 whitespace-nowrap"
              >
                <span className="w-4 h-4 bg-accent/20 text-accent rounded-full flex items-center justify-center text-[10px] font-bold">
                  {m.user?.fullName?.[0]?.toUpperCase() || '?'}
                </span>
                {m.user?.fullName || 'Unknown'}
                {memberIsAdmin && <span className="text-accent/70 text-[10px]">★</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-ink-800 mb-4 sm:mb-5" role="tablist" aria-label="Group sections">
        <div className="flex">
          {availableTabs.map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={i === tabIndex}
              aria-controls={`tab-panel-${t}`}
              onClick={() => setTabIndex(i)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors touch-manipulation flex-1 sm:flex-none ${
                i === tabIndex ? 'border-accent text-accent' : 'border-transparent text-ink-500 hover:text-ink-300'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content with swipe support ── */}
      <div
        className="swipe-container"
        {...swipeHandlers}
        role="tabpanel"
        id={`tab-panel-${tab}`}
        aria-label={TAB_LABELS[tab]}
      >
        {/* My Items */}
        {tab === 'my' && (
          <div className="fade-in">
            {myExpenses.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="No expenses yet"
                subtitle="Add your grocery and household purchases"
                action={<button onClick={() => setShowAddExpense(true)} className="btn-primary mt-4 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Expense
                </button>}
              />
            ) : (
              <div className="space-y-2">
                {myExpenses.map(expense => (
                  <ExpenseCard
                    key={expense._id}
                    expense={expense}
                    canDelete={true}
                    onDelete={handleDeleteExpense}
                    country={group.country}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Members */}
        {tab === 'all' && (
          <div className="fade-in">
            {Object.keys(byMember).length === 0 ? (
              <EmptyState icon="👥" title="No expenses recorded yet" />
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {Object.values(byMember).map(({ user: expUser, expenses, total }) => (
                  <div key={expUser._id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-accent/20 text-accent rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                          {expUser.fullName?.[0]?.toUpperCase()}
                        </span>
                        <span className="font-medium text-ink-200 text-sm sm:text-base truncate">{expUser.fullName}</span>
                      </div>
                      <span className="text-sm font-mono text-ink-400 shrink-0 ml-2">Rs {total.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1.5 pl-0 sm:pl-8">
                      {expenses.map(expense => (
                        <ExpenseCard
                          key={expense._id}
                          expense={expense}
                          canDelete={expUser._id === user._id}
                          onDelete={handleDeleteExpense}
                          country={group.country}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report (admin only) */}
        {tab === 'report' && isAdmin && (
          <div className="fade-in">
            <ReportView groupId={id} group={group} />
          </div>
        )}
      </div>

      {/* Swipe hint (mobile, show once) */}
      {availableTabs.length > 1 && (
        <p className="text-center text-xs text-ink-700 mt-4 sm:hidden select-none">
          ← Swipe to switch tabs →
        </p>
      )}

      {/* ── Modals ── */}
      {showAddExpense && (
        <AddExpenseModal groupId={id} onClose={() => setShowAddExpense(false)} onAdded={handleExpenseAdded} />
      )}
      {showInvite && (
        <InviteMemberModal groupId={id} onClose={() => setShowInvite(false)} />
      )}
      {showEditModal && (
        <EditGroupModal
          group={group}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updatedGroup) => { setGroup(updatedGroup); setShowEditModal(false); }}
        />
      )}
      {showDeleteConfirm && (
        <DeleteGroupModal
          groupId={id}
          groupName={group.name}
          onClose={() => setShowDeleteConfirm(false)}
          onDeleted={() => navigate('/dashboard')}
        />
      )}
    </Layout>
  );
}

/* ── Edit Group Modal ─────────────────────────────────────────────────────── */
function EditGroupModal({ group, onClose, onUpdated }) {
  const [name, setName] = useState(group.name);
  const [country, setCountry] = useState(group.country);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.put(`/groups/${group._id}`, { name: name.trim(), country });
      onUpdated(data.group);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit group"
    >
      <div
        className="w-full sm:max-w-sm bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 slide-up sm:scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-ink-800">
          <h2 className="text-base sm:text-lg font-semibold">Edit Group</h2>
          <button onClick={onClose} className="btn-icon w-8 h-8 text-ink-400" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4">
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="edit-group-name">Group Name</label>
              <input id="edit-group-name" type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="edit-country">Country</label>
              <select id="edit-country" className="input-field" value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? <Spinner /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Group Modal ───────────────────────────────────────────────────── */
function DeleteGroupModal({ groupId, groupName, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleDelete = async () => {
    if (confirmText !== groupName) { setError('Group name does not match'); return; }
    setError('');
    setLoading(true);
    try {
      await api.delete(`/groups/${groupId}`);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete group');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Delete group"
    >
      <div
        className="w-full sm:max-w-sm bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 slide-up sm:scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger/10 rounded-full flex items-center justify-center shrink-0" aria-hidden>
              <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-ink-100">Delete Group</h2>
              <p className="text-xs sm:text-sm text-ink-500">This cannot be undone</p>
            </div>
          </div>

          <p className="text-sm text-ink-400">
            This will permanently delete <span className="text-ink-200 font-medium">"{groupName}"</span> along with all expenses and reports.
          </p>

          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg" role="alert">{error}</div>}

          <div>
            <label className="label" htmlFor="delete-confirm">
              Type <span className="text-ink-200 font-mono">{groupName}</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              className="input-field"
              placeholder={groupName}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button
              className="flex-1 bg-danger hover:bg-red-600 active:bg-red-700 text-white font-medium px-5 py-2.5 rounded-lg transition-all text-sm flex justify-center items-center disabled:opacity-40 touch-manipulation"
              onClick={handleDelete}
              disabled={loading || confirmText !== groupName}
              style={{ minHeight: '44px' }}
            >
              {loading ? <Spinner /> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared components ───────────────────────────────────────────────────── */
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="text-center py-10 sm:py-12 card">
      <div className="text-3xl mb-2" aria-hidden>{icon}</div>
      <p className="text-ink-400 font-medium text-sm sm:text-base">{title}</p>
      {subtitle && <p className="text-ink-600 text-xs sm:text-sm mt-1">{subtitle}</p>}
      {action}
    </div>
  );
}

function ExpenseCard({ expense, canDelete, onDelete, country, compact }) {
  const [expanded, setExpanded] = useState(false);

  const displayDate =
    country === 'Nepal' && expense.nepaliDate?.fullDate
      ? expense.nepaliDate.fullDate
      : new Date(expense.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`card ${compact ? 'p-3' : 'p-3 sm:p-4'}`}>
      <div
        className="flex items-start justify-between cursor-pointer touch-manipulation"
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
        aria-label={`${expense.items.length} items, Rs ${expense.totalAmount}`}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(prev => !prev); }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink-500 font-mono">{displayDate}</span>
            <span className="text-xs text-ink-700">·</span>
            <span className="text-xs text-ink-600">{expense.items.length} item{expense.items.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-sm text-ink-200 mt-0.5 font-medium truncate">
            {expense.items.slice(0, 2).map(i => i.itemName).join(', ')}
            {expense.items.length > 2 ? ` +${expense.items.length - 2}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          <span className="font-mono text-sm font-semibold text-ink-100">Rs {expense.totalAmount.toLocaleString()}</span>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(expense._id); }}
              className="text-ink-700 hover:text-danger transition-colors touch-manipulation p-1"
              aria-label="Delete expense"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-ink-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-1.5 fade-in">
          {expense.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-ink-400 truncate max-w-[70%]">{item.itemName}</span>
              <span className="font-mono text-ink-300">Rs {item.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" aria-hidden />;
}
