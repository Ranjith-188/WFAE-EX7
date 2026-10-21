import React, { useState, useEffect, useCallback } from 'react';
import { getMyLeaves, getBalance } from '../services/api';
import type { LeaveRequest } from '../types/leave';
import { StatusBadge } from '../components/StatusBadge';
import { Search, RefreshCw, Calendar, Sparkles, AlertCircle, Clock } from 'lucide-react';

interface MyRequestsPageProps {
  initialEmail?: string;
}

export const MyRequestsPage: React.FC<MyRequestsPageProps> = ({ initialEmail = '' }) => {
  const [email, setEmail] = useState<string>(
    initialEmail || localStorage.getItem('leave_user_email') || ''
  );
  const [activeEmail, setActiveEmail] = useState<string>(
    initialEmail || localStorage.getItem('leave_user_email') || ''
  );

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [remainingDays, setRemainingDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (targetEmail: string, isSilent = false) => {
    if (!targetEmail.trim()) {
      setRequests([]);
      setRemainingDays(null);
      return;
    }

    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [leaves, bal] = await Promise.all([
        getMyLeaves(targetEmail),
        getBalance(targetEmail),
      ]);
      setRequests(leaves);
      setRemainingDays(bal.remainingDays);
    } catch (err: unknown) {
      if (!isSilent) {
        if (err instanceof Error) setError(err.message);
        else setError('Failed to load leave history.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (activeEmail) {
      fetchData(activeEmail);
    }
  }, [activeEmail, fetchData]);

  // Auto-refresh every 5s
  useEffect(() => {
    if (!activeEmail) return;
    const interval = setInterval(() => {
      fetchData(activeEmail, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeEmail, fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (clean) {
      localStorage.setItem('leave_user_email', clean);
      setActiveEmail(clean);
      fetchData(clean);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1080px', margin: '40px auto', padding: '0 16px' }}>
      {/* Header and Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '6px' }}>My Leave Requests</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Track application statuses in real-time as Camunda executes workflow tasks.
          </p>
        </div>

        {/* Email Search Form */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', minWidth: '320px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              id="my-requests-email-input"
              type="email"
              className="form-input"
              style={{ paddingLeft: '38px', height: '42px' }}
              placeholder="Search by your email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Search
              size={17}
              color="var(--text-dim)"
              style={{ position: 'absolute', left: '12px', top: '13px' }}
            />
          </div>
          <button id="my-requests-search-btn" type="submit" className="btn btn-primary" style={{ height: '42px' }}>
            Search
          </button>
        </form>
      </div>

      {/* Balance Card Banner */}
      {activeEmail && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderLeft: '4px solid var(--primary)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Annual Leave Balance
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span id="remaining-days-count" style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
                  {remainingDays !== null ? remainingDays : '--'}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>days remaining</span>
              </div>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={24} color="#818cf8" />
            </div>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderLeft: '4px solid var(--accent-cyan)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tracking Employee
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', marginTop: '6px' }}>
                {activeEmail}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Auto-refreshing every 5s {refreshing && '(syncing...)'}
              </div>
            </div>
            <button
              onClick={() => fetchData(activeEmail)}
              className="btn btn-secondary"
              style={{ padding: '8px', borderRadius: '50%' }}
              title="Refresh now"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', borderColor: 'var(--danger-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>History & Applications</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {requests.length} {requests.length === 1 ? 'record' : 'records'} found
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Loading your leave records...</p>
          </div>
        ) : !activeEmail ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Search size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>Enter your email address</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Search above to retrieve your leave requests and current balance.</p>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Calendar size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>No leave requests found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>You haven't submitted any leave requests with this email yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table" id="my-requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Status Message / Reason</th>
                  <th>Camunda Instance</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} id={`leave-row-${req.id}`}>
                    <td style={{ fontWeight: 600 }}>#{req.id}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{req.leaveType}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.88rem' }}>{req.startDate} &rarr; {req.endDate}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        Applied on {new Date(req.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{req.days}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td style={{ maxWidth: '320px' }}>
                      {req.statusMessage ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                          {req.statusMessage}
                        </div>
                      ) : req.reason ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Reason: {req.reason}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {req.processInstanceKey ? (
                        <a
                          href={`http://localhost:8080/operate`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            color: '#818cf8',
                            background: 'rgba(99, 102, 241, 0.1)',
                            padding: '3px 7px',
                            borderRadius: '4px',
                          }}
                          title="Open Operate"
                        >
                          {req.processInstanceKey}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
