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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink-100">Invitations</h1>
          <p className="text-sm text-ink-500 mt-0.5">Groups you've been invited to join</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-16 card">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-ink-300 font-medium">No pending invitations</p>
            <p className="text-ink-500 text-sm mt-1">When someone invites you to a group, it'll show up here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map(inv => (
              <div key={inv.groupId} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-8 h-8 bg-accent/10 text-accent rounded-lg flex items-center justify-center font-bold">
                        {inv.groupName[0].toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium text-ink-100">{inv.groupName}</p>
                        <p className="text-xs text-ink-500">
                          {inv.country} · Admin: {inv.admin?.fullName}
                        </p>
                      </div>
                    </div>
                    {inv.invitedAt && (
                      <p className="text-xs text-ink-600 mt-2">
                        Invited {new Date(inv.invitedAt).toLocaleDateString('en-US', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => respond(inv.groupId, 'reject')}
                      disabled={!!responding[inv.groupId]}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      {responding[inv.groupId] === 'reject' ? <Spinner /> : 'Decline'}
                    </button>
                    <button
                      onClick={() => respond(inv.groupId, 'accept')}
                      disabled={!!responding[inv.groupId]}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center justify-center gap-1"
                    >
                      {responding[inv.groupId] === 'accept' ? <Spinner /> : 'Accept'}
                    </button>
                  </div>
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
  return <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
}
