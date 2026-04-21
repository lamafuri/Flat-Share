import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const { data } = await api.get('/groups/invitations/mine');
      setInvitations(data.invitations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const respond = async (groupId, action) => {
    setResponding(r => ({ ...r, [groupId]: action }));
    try {
      await api.post(`/groups/${groupId}/respond-invite`, { action });
      setInvitations(inv => inv.filter(i => i.groupId !== groupId));
      if (action === 'accept') {
        navigate(`/groups/${groupId}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to respond');
    } finally {
      setResponding(r => ({ ...r, [groupId]: null }));
    }
  };

  return (
    <Layout>
      <div className="max-w-lg">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-ink-100">Invitations</h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">Groups you've been invited to join</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-12 sm:py-16 card fade-in">
            <div className="text-4xl mb-3" aria-hidden>📭</div>
            <p className="text-ink-300 font-medium text-sm sm:text-base">No pending invitations</p>
            <p className="text-ink-500 text-xs sm:text-sm mt-1">When someone invites you to a group, it'll appear here</p>
          </div>
        ) : (
          <div className="space-y-3 fade-in">
            {invitations.map(inv => (
              <div key={inv.groupId} className="card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-accent/10 text-accent rounded-xl flex items-center justify-center font-bold shrink-0" aria-hidden>
                    {inv.groupName[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-100 text-sm sm:text-base truncate">{inv.groupName}</p>
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {inv.country} · Admin: {inv.admin?.fullName}
                    </p>
                    {inv.invitedAt && (
                      <p className="text-xs text-ink-600 mt-1">
                        Invited {new Date(inv.invitedAt).toLocaleDateString('en-US', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 sm:mt-4">
                  <button
                    onClick={() => respond(inv.groupId, 'reject')}
                    disabled={!!responding[inv.groupId]}
                    className="btn-danger flex-1 text-sm"
                    aria-label={`Decline invitation to ${inv.groupName}`}
                  >
                    {responding[inv.groupId] === 'reject' ? <Spinner /> : 'Decline'}
                  </button>
                  <button
                    onClick={() => respond(inv.groupId, 'accept')}
                    disabled={!!responding[inv.groupId]}
                    className="btn-primary flex-1 text-sm"
                    aria-label={`Accept invitation to ${inv.groupName}`}
                  >
                    {responding[inv.groupId] === 'accept' ? <Spinner /> : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" aria-hidden />;
}
