import React, { useState } from 'react';
import { submitLeave, ApiError } from '../services/api';
import type { SubmitLeavePayload, LeaveRequest } from '../types/leave';
import { Send, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface ApplyPageProps {
  onSuccessNavigate?: (email: string) => void;
}

export const ApplyPage: React.FC<ApplyPageProps> = ({ onSuccessNavigate }) => {
  const [formData, setFormData] = useState<SubmitLeavePayload>({
    employeeName: '',
    employeeEmail: localStorage.getItem('leave_user_email') || '',
    leaveType: 'Annual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState<LeaveRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage(null);
  };

  const calculateDaysPreview = () => {
    if (!formData.startDate || !formData.endDate) return null;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) return -1;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorDetails([]);
    setSuccessResult(null);

    // Client-side validations
    if (!formData.employeeName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!formData.employeeEmail.trim() || !formData.employeeEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setErrorMessage('Please select both start and end dates.');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setErrorMessage('End date cannot be earlier than start date.');
      return;
    }

    setLoading(true);
    try {
      // Store email for user convenience
      localStorage.setItem('leave_user_email', formData.employeeEmail.trim());

      const result = await submitLeave({
        ...formData,
        employeeName: formData.employeeName.trim(),
        employeeEmail: formData.employeeEmail.trim(),
        reason: formData.reason?.trim(),
      });

      setSuccessResult(result);
      setFormData((prev) => ({
        ...prev,
        startDate: '',
        endDate: '',
        reason: '',
      }));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        if (err.details && err.details.length > 0) {
          setErrorDetails(err.details);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred while submitting the request.');
      }
    } finally {
      setLoading(false);
    }
  };

  const previewDays = calculateDaysPreview();

  return (
    <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.875rem', marginBottom: '8px' }}>Submit Leave Request</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Your request will be validated instantly and routed to your manager via Camunda 8.
        </p>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            marginBottom: '24px',
            borderColor: 'var(--success-border)',
            background: 'rgba(16, 185, 129, 0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <CheckCircle2 color="#10b981" size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.05rem', color: '#10b981', marginBottom: '4px' }}>
                Leave Request Submitted Successfully!
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                Request <strong>#{successResult.id}</strong> ({successResult.days} working {successResult.days === 1 ? 'day' : 'days'}) has been initiated. Current status: <strong>{successResult.status}</strong>.
              </p>
              {onSuccessNavigate && (
                <button
                  id="view-in-my-requests-btn"
                  onClick={() => onSuccessNavigate(successResult.employeeEmail)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  View in My Requests &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div
          id="apply-error-alert"
          className="glass-panel"
          style={{
            padding: '16px 20px',
            marginBottom: '24px',
            borderColor: 'var(--danger-border)',
            background: 'rgba(244, 63, 94, 0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertCircle color="#f43f5e" size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#f43f5e', fontSize: '0.95rem', marginBottom: '2px' }}>
                {errorMessage}
              </div>
              {errorDetails.length > 0 && (
                <ul style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {errorDetails.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Application Form */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="employeeName" className="form-label">
                Full Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="employeeName"
                name="employeeName"
                type="text"
                className="form-input"
                placeholder="e.g. Alice Smith"
                value={formData.employeeName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="employeeEmail" className="form-label">
                Email Address <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="employeeEmail"
                name="employeeEmail"
                type="email"
                className="form-input"
                placeholder="alice@company.com"
                value={formData.employeeEmail}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="leaveType" className="form-label">
              Leave Type <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              id="leaveType"
              name="leaveType"
              className="form-select"
              value={formData.leaveType}
              onChange={handleChange}
              required
            >
              <option value="Annual">Annual Leave (Paid, 20 days default balance)</option>
              <option value="Sick">Sick Leave</option>
              <option value="Unpaid">Unpaid Leave</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="startDate" className="form-label">
                Start Date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="form-input"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate" className="form-label">
                End Date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="form-input"
                value={formData.endDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Working Days Preview */}
          {previewDays !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: previewDays > 0 ? 'rgba(99, 102, 241, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                color: previewDays > 0 ? '#a5b4fc' : '#fda4af',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}
            >
              <Info size={16} />
              {previewDays > 0 ? (
                <span>
                  Calculated: <strong>{previewDays}</strong> working {previewDays === 1 ? 'weekday' : 'weekdays'} (weekends excluded).
                </span>
              ) : previewDays === 0 ? (
                <span>Warning: Selected date range contains 0 weekdays (weekends only).</span>
              ) : (
                <span>Warning: End date is before start date.</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reason" className="form-label">
              Reason / Notes (Optional)
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              className="form-textarea"
              placeholder="Provide context for your manager..."
              value={formData.reason}
              onChange={handleChange}
            />
          </div>

          <button
            id="submit-leave-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', height: '44px' }}
            disabled={loading}
          >
            {loading ? (
              <span>Submitting workflow...</span>
            ) : (
              <>
                <Send size={18} />
                <span>Submit Leave Request</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
