import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import AddExpenseModal from '../components/AddExpenseModal';
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
  const [showManageMembers, setShowManageMembers] = useState(false);
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

  const swipeHandlers = useSwipe({
    onLeft: () => setTabIndex(i => Math.min(i + 1, availableTabs.length - 1)),
    onRight: () => setTabIndex(i => Math.max(i - 1, 0)),
  });

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
            <button
              onClick={() => setShowAddExpense(true)}
              className="btn-primary flex items-center gap-1 sm:gap-1.5 text-sm px-3 sm:px-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden xs:inline">Add</span>
            </button>

            {/* Admin settings ⋯ */}
            {isAdmin && (
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen(o => !o)}
                  className="btn-ghost px-2.5 py-2.5"
                  aria-label="Group settings"
                  aria-expanded={settingsOpen}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {settingsOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 card shadow-modal py-1 z-50" role="menu">
                    <button
                      onClick={() => { setShowManageMembers(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors touch-manipulation"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Manage Members
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

        {/* Members pills */}
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
      <div className="border-b border-ink-800 mb-4 sm:mb-5" role="tablist">
        <div className="flex">
          {availableTabs.map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={i === tabIndex}
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

      {/* ── Tab content ── */}
      <div className="swipe-container" {...swipeHandlers}>
        {tab === 'my' && (
          <div className="fade-in">
            {myExpenses.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="No expenses yet"
                subtitle="Add your grocery and household purchases"
                action={
                  <button onClick={() => setShowAddExpense(true)} className="btn-primary mt-4 inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Expense
                  </button>
                }
              />
            ) : (
              <div className="space-y-2">
                {myExpenses.map(expense => (
                  <ExpenseCard key={expense._id} expense={expense} canDelete={true} onDelete={handleDeleteExpense} country={group.country} />
                ))}
              </div>
            )}
          </div>
        )}

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
                        <ExpenseCard key={expense._id} expense={expense} canDelete={expUser._id === user._id} onDelete={handleDeleteExpense} country={group.country} compact />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'report' && isAdmin && (
          <div className="fade-in">
            <ReportView groupId={id} group={group} />
          </div>
        )}
      </div>

      {availableTabs.length > 1 && (
        <p className="text-center text-xs text-ink-700 mt-4 sm:hidden select-none">← Swipe to switch tabs →</p>
      )}

      {/* ── Modals ── */}
      {showAddExpense && (
        <AddExpenseModal groupId={id} onClose={() => setShowAddExpense(false)} onAdded={handleExpenseAdded} />
      )}
      {showManageMembers && (
        <ManageMembersModal
          group={group}
          adminId={adminId}
          onClose={() => setShowManageMembers(false)}
          onGroupUpdated={(updatedGroup) => setGroup(updatedGroup)}
        />
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

/* ── Manage Members Modal ─────────────────────────────────────────────────── */
function ManageMembersModal({ group, adminId, onClose, onGroupUpdated }) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchResults([]);
    if (query.includes('@') || query.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        const memberIds = new Set(group.members.map(m => m.user?._id?.toString() || m.user?.toString()));
        setSearchResults(data.users.filter(u => !memberIds.has(u._id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query]);

  const addMember = async (targetUser) => {
    setError(''); setSuccess(''); setAdding(targetUser._id);
    try {
      const { data } = await api.post(`/groups/${group._id}/add-member`, { userId: targetUser._id });
      onGroupUpdated(data.group);
      setSuccess(`${targetUser.fullName} added to the group!`);
      setQuery(''); setSearchResults([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add member');
    } finally { setAdding(null); }
  };

  const addByEmail = async () => {
    if (!query.includes('@')) { setError('Enter a valid email'); return; }
    setError(''); setSuccess(''); setAdding('email');
    try {
      const { data } = await api.post(`/groups/${group._id}/add-member`, { email: query });
      onGroupUpdated(data.group);
      setSuccess('Member added successfully!');
      setQuery('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add member');
    } finally { setAdding(null); }
  };

  const removeMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from the group?`)) return;
    setError(''); setSuccess(''); setRemoving(memberId);
    try {
      const { data } = await api.delete(`/groups/${group._id}/members/${memberId}`);
      onGroupUpdated(data.group);
      setSuccess(`${memberName} removed from the group`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    } finally { setRemoving(null); }
  };

  const isEmail = query.includes('@') && query.includes('.');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-ink-700 rounded-full" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-ink-800 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Manage Members</h2>
            <p className="text-xs text-ink-500 mt-0.5">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2.5 py-2 text-ink-400" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-5">
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg" role="alert">{error}</div>}
          {success && <div className="bg-success/10 border border-success/20 text-success text-sm px-3 py-2 rounded-lg">✓ {success}</div>}

          {/* Add Member */}
          <div>
            <p className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-2">Add Member</p>
            <div className="relative">
              <input
                type="text"
                className="input-field pr-10"
                placeholder="Search by name or enter email..."
                value={query}
                onChange={e => { setQuery(e.target.value); setError(''); setSuccess(''); }}
                autoFocus
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 bg-ink-800 border border-ink-700 rounded-lg overflow-hidden">
                {searchResults.map(u => (
                  <div key={u._id} className="flex items-center justify-between px-3 py-2.5 border-b border-ink-700 last:border-0 hover:bg-ink-700 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-100 truncate">{u.fullName}</p>
                      <p className="text-xs text-ink-500 truncate">{u.email}</p>
                    </div>
                    <button
                      onClick={() => addMember(u)}
                      disabled={adding === u._id}
                      className="btn-primary text-xs px-3 py-1.5 ml-2 shrink-0 flex items-center gap-1"
                    >
                      {adding === u._id ? <Spinner /> : (<><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add</>)}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {query.length >= 2 && !query.includes('@') && !searching && searchResults.length === 0 && (
              <p className="text-xs text-ink-500 mt-2">No users found. Try their full email address.</p>
            )}

            {isEmail && (
              <div className="mt-2 bg-ink-800 border border-ink-700 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-ink-300 truncate">Add <span className="text-accent font-medium">{query}</span></p>
                <button onClick={addByEmail} disabled={adding === 'email'} className="btn-primary text-xs px-3 py-1.5 shrink-0 flex items-center gap-1">
                  {adding === 'email' ? <Spinner /> : (<><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add</>)}
                </button>
              </div>
            )}
          </div>

          {/* Current Members */}
          <div>
            <p className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-2">Current Members</p>
            <div className="space-y-1.5">
              {group.members.map(m => {
                const memberId = m.user?._id?.toString() || m.user?.toString();
                const memberIsAdmin = memberId === adminId;
                const fullName = m.user?.fullName || 'Unknown';
                const email = m.user?.email || '';
                return (
                  <div key={memberId} className="flex items-center justify-between gap-3 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 bg-accent/20 text-accent rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                        {fullName[0]?.toUpperCase() || '?'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-ink-100 truncate">{fullName}</p>
                          {memberIsAdmin && (
                            <span className="badge bg-accent/10 text-accent border border-accent/20 text-[10px] px-1.5 shrink-0">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-ink-500 truncate">{email}</p>
                      </div>
                    </div>
                    {!memberIsAdmin && (
                      <button
                        onClick={() => removeMember(memberId, fullName)}
                        disabled={removing === memberId}
                        className="shrink-0 flex items-center gap-1 text-xs text-danger hover:bg-danger/10 border border-danger/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        aria-label={`Remove ${fullName}`}
                      >
                        {removing === memberId ? <Spinner /> : (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>Remove</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
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
    setError(''); setLoading(true);
    try {
      const { data } = await api.put(`/groups/${group._id}`, { name: name.trim(), country });
      onUpdated(data.group);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update group');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-sm bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 bg-ink-700 rounded-full" /></div>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-ink-800">
          <h2 className="text-base sm:text-lg font-semibold">Edit Group</h2>
          <button onClick={onClose} className="btn-ghost px-2.5 py-2 text-ink-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="px-4 sm:px-6 py-4">
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Group Name</label>
              <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Country</label>
              <select className="input-field" value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? <Spinner /> : 'Save Changes'}</button>
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
    setError(''); setLoading(true);
    try {
      await api.delete(`/groups/${groupId}`);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete group');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-sm bg-ink-900 border-t sm:border border-ink-800 rounded-t-2xl sm:rounded-xl sm:mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 bg-ink-700 rounded-full" /></div>
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger/10 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Delete Group</h2>
              <p className="text-xs sm:text-sm text-ink-500">This cannot be undone</p>
            </div>
          </div>
          <p className="text-sm text-ink-400">Permanently deletes <span className="text-ink-200 font-medium">"{groupName}"</span> and all its expenses and reports.</p>
          {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="label">Type <span className="text-ink-200 font-mono">{groupName}</span> to confirm</label>
            <input type="text" className="input-field" placeholder={groupName} value={confirmText} onChange={e => setConfirmText(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button className="flex-1 bg-danger hover:bg-red-600 text-white font-medium px-5 py-2.5 rounded-lg transition-all text-sm flex justify-center items-center disabled:opacity-40" onClick={handleDelete} disabled={loading || confirmText !== groupName}>
              {loading ? <Spinner /> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────────────────────── */
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
      <div className="flex items-start justify-between cursor-pointer touch-manipulation" onClick={() => setExpanded(e => !e)} role="button" aria-expanded={expanded} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(p => !p); }}>
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
            <button onClick={e => { e.stopPropagation(); onDelete(expense._id); }} className="text-ink-700 hover:text-danger transition-colors touch-manipulation p-1" aria-label="Delete expense">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
          <svg className={`w-4 h-4 text-ink-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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