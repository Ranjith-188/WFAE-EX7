import React from 'react';
import type { LeaveStatus } from '../types/leave';
import { Clock, CheckCircle2, XCircle, Send } from 'lucide-react';

interface StatusBadgeProps {
  status: LeaveStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getIcon = () => {
    switch (status) {
      case 'SUBMITTED':
        return <Send size={12} />;
      case 'PENDING_APPROVAL':
        return <Clock size={12} />;
      case 'APPROVED':
        return <CheckCircle2 size={12} />;
      case 'REJECTED':
        return <XCircle size={12} />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'SUBMITTED':
        return 'Submitted';
      case 'PENDING_APPROVAL':
        return 'Pending Approval';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  };

  return (
    <span className={`badge badge-${status}`}>
      {getIcon()}
      {getLabel()}
    </span>
  );
};
