import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ApplyPage } from './pages/ApplyPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { ManagerInboxPage } from './pages/ManagerInboxPage';
import { getPending } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<'apply' | 'my-requests' | 'manager-inbox'>('apply');
  const [selectedEmail, setSelectedEmail] = useState<string>(
    localStorage.getItem('leave_user_email') || ''
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Poll pending count for the badge
  useEffect(() => {
    const updateCount = async () => {
      try {
        const pending = await getPending();
        setPendingCount(pending.length);
      } catch {
        // Ignore polling errors for the badge
      }
    };

    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApplySuccess = (email: string) => {
    setSelectedEmail(email);
    setCurrentTab('my-requests');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        pendingCount={pendingCount}
      />

      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {currentTab === 'apply' && (
          <ApplyPage onSuccessNavigate={handleApplySuccess} />
        )}
        {currentTab === 'my-requests' && (
          <MyRequestsPage initialEmail={selectedEmail} />
        )}
        {currentTab === 'manager-inbox' && (
          <ManagerInboxPage />
        )}
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(10, 14, 23, 0.7)',
        padding: '24px',
        textAlign: 'center',
        fontSize: '0.82rem',
        color: 'var(--text-dim)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>LeaveFlow</strong> &bull; End-to-End Workflow-Driven Leave Management
          </div>
          <div>
            Camunda 8 (Self-Managed) &bull; Spring Boot 3.5 &bull; React + TypeScript &bull; Vite
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
