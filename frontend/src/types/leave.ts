export type LeaveStatus = 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: number;
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  statusMessage?: string;
  processInstanceKey?: number;
  createdAt: string;
}

export interface SubmitLeavePayload {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface DecisionPayload {
  approved: boolean;
  comment?: string;
}

export interface BalanceResponse {
  remainingDays: number;
}

export interface ApiErrorResponse {
  message: string;
  details?: string[];
}
