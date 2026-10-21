import React from 'react';
import { Calendar, Inbox, PlusCircle, CheckCircle, ExternalLink } from 'lucide-react';

interface NavbarProps {
  currentTab: 'apply' | 'my-requests' | 'manager-inbox';
  onTabChange: (tab: 'apply' | 'my-requests' | 'manager-inbox') => void;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, pendingCount = 0 }) => {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 14, 23, 0.8)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px',
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
             onClick={() => onTabChange('apply')}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          }}>
            <CheckCircle size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LeaveFlow
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 500 }}>
              Camunda 8 Powered
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            id="nav-apply-btn"
            onClick={() => onTabChange('apply')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              background: currentTab === 'apply' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
              color: currentTab === 'apply' ? '#818cf8' : 'var(--text-muted)',
              outline: 'none',
            }}
          >
            <PlusCircle size={17} />
            Apply Leave
          </button>

          <button
            id="nav-my-requests-btn"
            onClick={() => onTabChange('my-requests')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              background: currentTab === 'my-requests' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
              color: currentTab === 'my-requests' ? '#818cf8' : 'var(--text-muted)',
              outline: 'none',
            }}
          >
            <Calendar size={17} />
            My Requests
          </button>

          <button
            id="nav-manager-inbox-btn"
            onClick={() => onTabChange('manager-inbox')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              background: currentTab === 'manager-inbox' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
              color: currentTab === 'manager-inbox' ? '#818cf8' : 'var(--text-muted)',
              outline: 'none',
              position: 'relative',
            }}
          >
            <Inbox size={17} />
            Manager Inbox
            {pendingCount > 0 && (
              <span style={{
                background: '#f59e0b',
                color: '#000',
                borderRadius: '9999px',
                padding: '2px 7px',
                fontSize: '0.7rem',
                fontWeight: 700,
                marginLeft: '4px',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        </nav>

        {/* Operate link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href="http://localhost:8080/operate"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
            title="Open Camunda Operate Console"
          >
            Operate
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </header>
  );
};
