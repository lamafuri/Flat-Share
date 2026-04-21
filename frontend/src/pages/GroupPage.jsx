import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import AddExpenseModal from '../components/AddExpenseModal';
import InviteMemberModal from '../components/InviteMemberModal';
import ReportView from '../components/ReportView';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const TABS = { MY_ITEMS: 'my', ALL_ITEMS: 'all', REPORT: 'report' };

export default function GroupPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(TABS.MY_ITEMS);
  const [myExpenses, setMyExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroup();
  }, [id]);

  useEffect(() => {
    if (group && !expensesLoaded) {
      fetchExpenses();
    }
  }, [group]);

  const fetchGroup = async () => {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data.group);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Failed to load group';
      setError(msg);
      // Only navigate away for true not-found, not auth/server errors
      if (status === 404) {
        navigate('/dashboard');
      }
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
          <Link to="/dashboard" className="btn-ghost">← Back to Dashboard</Link>
        </div>
      </Layout>
    );
  }

  if (!group) return null;

  // Safe admin ID extraction — works whether populated or not
  const adminId = group.admin?._id ? group.admin._id.toString() : group.admin?.toString();
  const isAdmin = adminId === user._id.toString();
  const memberCount = group.members.length;

  // Group all expenses by user for the "All Members" tab
  const byMember = {};
  allExpenses.forEach(exp => {
    const uid = exp.user._id;
    if (!byMember[uid]) {
      byMember[uid] = { user: exp.user, expenses: [], total: 0 };
    }
    byMember[uid].expenses.push(exp);
    byMember[uid].total += exp.totalAmount;
  });

  return (
    <Layout>
      {/* Group header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-ink-500 hover:text-ink-300 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-ink-100">{group.name}</h1>
                {isAdmin && (
                  <span className="badge bg-accent/10 text-accent border border-accent/20">Admin</span>
                )}
              </div>
              <p className="text-sm text-ink-500 mt-0.5">
                {group.country} · {memberCount} member{memberCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="btn-ghost flex items-center gap-1.5 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite
              </button>
            )}
            <button
              onClick={() => setShowAddExpense(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Expenses
            </button>
          </div>
        </div>

        {/* Members pills */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {group.members.map(m => {
            const memberId = m.user?._id ? m.user._id.toString() : m.user?.toString();
            const memberIsAdmin = memberId === adminId;
            return (
              <span
                key={memberId}
                className="flex items-center gap-1 bg-ink-800 border border-ink-700 rounded-full px-2.5 py-1 text-xs text-ink-300"
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

      {/* Tabs */}
      <div className="border-b border-ink-800 mb-5">
        <div className="flex">
          <TabBtn active={tab === TABS.MY_ITEMS} onClick={() => setTab(TABS.MY_ITEMS)}>My Items</TabBtn>
          <TabBtn active={tab === TABS.ALL_ITEMS} onClick={() => setTab(TABS.ALL_ITEMS)}>All Members</TabBtn>
          {isAdmin && (
            <TabBtn active={tab === TABS.REPORT} onClick={() => setTab(TABS.REPORT)}>Report</TabBtn>
          )}
        </div>
      </div>

      {/* Tab: My Items */}
      {tab === TABS.MY_ITEMS && (
        <div>
          {myExpenses.length === 0 ? (
            <div className="text-center py-12 card">
              <div className="text-3xl mb-2">🛒</div>
              <p className="text-ink-400">No expenses yet</p>
              <p className="text-ink-600 text-sm mt-1">Add your grocery and household purchases</p>
              <button
                onClick={() => setShowAddExpense(true)}
                className="btn-primary mt-4 inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add First Expense
              </button>
            </div>
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

      {/* Tab: All Members */}
      {tab === TABS.ALL_ITEMS && (
        <div>
          {Object.keys(byMember).length === 0 ? (
            <div className="text-center py-12 card">
              <div className="text-3xl mb-2">👥</div>
              <p className="text-ink-400">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.values(byMember).map(({ user: expUser, expenses, total }) => (
                <div key={expUser._id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-accent/20 text-accent rounded-full flex items-center justify-center text-xs font-bold">
                        {expUser.fullName?.[0]?.toUpperCase()}
                      </span>
                      <span className="font-medium text-ink-200">{expUser.fullName}</span>
                    </div>
                    <span className="text-sm font-mono text-ink-400">Rs {total.toLocaleString()}</span>
                  </div>
                  <div className="space-y-1.5 pl-8">
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

      {/* Tab: Report (admin only) */}
      {tab === TABS.REPORT && isAdmin && (
        <ReportView groupId={id} group={group} />
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          groupId={id}
          onClose={() => setShowAddExpense(false)}
          onAdded={handleExpenseAdded}
        />
      )}
      {showInvite && (
        <InviteMemberModal
          groupId={id}
          onClose={() => setShowInvite(false)}
        />
      )}
    </Layout>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-accent text-accent'
          : 'border-transparent text-ink-500 hover:text-ink-300'
      }`}
    >
      {children}
    </button>
  );
}

function ExpenseCard({ expense, canDelete, onDelete, country, compact }) {
  const [expanded, setExpanded] = useState(false);

  const displayDate =
    country === 'Nepal' && expense.nepaliDate?.fullDate
      ? expense.nepaliDate.fullDate
      : new Date(expense.date).toLocaleDateString('en-US', {
          day: 'numeric', month: 'short', year: 'numeric'
        });

  return (
    <div className={`card ${compact ? 'p-3' : 'p-4'}`}>
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 font-mono">{displayDate}</span>
            <span className="text-xs text-ink-600">·</span>
            <span className="text-xs text-ink-500">
              {expense.items.length} item{expense.items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-ink-200 mt-0.5 font-medium">
            {expense.items.slice(0, 2).map(i => i.itemName).join(', ')}
            {expense.items.length > 2 ? ` +${expense.items.length - 2} more` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-sm font-semibold text-ink-100">
            Rs {expense.totalAmount.toLocaleString()}
          </span>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(expense._id); }}
              className="text-ink-700 hover:text-danger transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-ink-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-1">
          {expense.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-ink-400">{item.itemName}</span>
              <span className="font-mono text-ink-300">Rs {item.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}