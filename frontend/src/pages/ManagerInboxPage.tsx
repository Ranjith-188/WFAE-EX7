import React, { useState, useEffect, useCallback } from 'react';
import { getPending, decide, ApiError } from '../services/api';
import type { LeaveRequest } from '../types/leave';
import { Check, X, Clock, Calendar, User, Mail, MessageSquare, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const ManagerInboxPage: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [comments, setComments] = useState<{ [key: number]: string }>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPending = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await getPending();
      setPendingRequests(data);
    } catch (err: unknown) {
      if (!isSilent) {
        if (err instanceof Error) setMessage({ type: 'error', text: err.message });
        else setMessage({ type: 'error', text: 'Failed to fetch pending requests.' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPending(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleCommentChange = (id: number, text: string) => {
    setComments((prev) => ({ ...prev, [id]: text }));
  };

  const handleDecision = async (id: number, approved: boolean) => {
    setSubmittingId(id);
    setMessage(null);

    const comment = comments[id] || '';

    try {
      await decide(id, { approved, comment });
      setMessage({
        type: 'success',
        text: `Request #${id} successfully ${approved ? 'APPROVED' : 'REJECTED'}. The workflow has resumed in Camunda 8.`,
      });
      // Clear comment
      setComments((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      // Immediate refresh
      await fetchPending();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setMessage({ type: 'error', text: err.message });
      } else if (err instanceof Error) {
        setMessage({ type: 'error', text: err.message });
      } else {
        setMessage({ type: 'error', text: 'Failed to submit decision.' });
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '960px', margin: '40px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '6px' }}>Manager Inbox</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Review pending leave requests waiting at the Camunda User Task stage.
          </p>
        </div>
        <button
          id="refresh-inbox-btn"
          onClick={() => fetchPending()}
          className="btn btn-secondary"
          style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div
          id="manager-inbox-alert"
          className="glass-panel"
          style={{
            padding: '16px 20px',
            marginBottom: '24px',
            borderColor: message.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {message.type === 'success' ? (
              <CheckCircle2 color="#10b981" size={20} />
            ) : (
              <AlertCircle color="#f43f5e" size={20} />
            )}
            <span style={{ fontSize: '0.92rem', color: message.type === 'success' ? '#10b981' : '#f43f5e', fontWeight: 500 }}>
              {message.text}
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          <p>Fetching pending approvals from Camunda...</p>
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Clock size={40} style={{ margin: '0 auto 14px auto', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '6px' }}>Inbox is Clear!</h3>
          <p style={{ fontSize: '0.9rem' }}>There are currently no leave requests pending manager review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              id={`pending-card-${req.id}`}
              className="glass-panel"
              style={{ padding: '24px', position: 'relative' }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                      Request #{req.id}
                    </span>
                    <span className="badge badge-PENDING_APPROVAL">Pending Review</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <User size={14} /> {req.employeeName}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Mail size={14} /> {req.employeeEmail}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {req.days} {req.days === 1 ? 'Day' : 'Days'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {req.leaveType} Leave
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Date Range</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--primary)" />
                    {req.startDate} &rarr; {req.endDate}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Reason</div>
                  <div style={{ fontSize: '0.88rem', color: req.reason ? 'var(--text-main)' : 'var(--text-dim)', marginTop: '2px' }}>
                    {req.reason || 'None provided'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Process Key</div>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#818cf8', marginTop: '2px' }}>
                    {req.processInstanceKey || '—'}
                  </div>
                </div>
              </div>

              {/* Decision comment & actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    id={`comment-input-${req.id}`}
                    rows={2}
                    className="form-textarea"
                    placeholder="Add a comment or feedback for the employee (e.g. 'Approved, please hand over client tasks' or rejection reason)..."
                    value={comments[req.id] || ''}
                    onChange={(e) => handleCommentChange(req.id, e.target.value)}
                  />
                  <MessageSquare
                    size={16}
                    color="var(--text-dim)"
                    style={{ position: 'absolute', right: '12px', top: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    id={`reject-btn-${req.id}`}
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDecision(req.id, false)}
                    disabled={submittingId === req.id}
                  >
                    <X size={17} />
                    <span>Reject</span>
                  </button>

                  <button
                    id={`approve-btn-${req.id}`}
                    type="button"
                    className="btn btn-success"
                    onClick={() => handleDecision(req.id, true)}
                    disabled={submittingId === req.id}
                  >
                    <Check size={17} />
                    <span>Approve Request</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
