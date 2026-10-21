import type {
  BalanceResponse,
  DecisionPayload,
  LeaveRequest,
  SubmitLeavePayload,
} from '../types/leave';

const BASE_URL = '/api/leaves';

export class ApiError extends Error {
  status: number;
  details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!res.ok) {
    let errorMessage = `Request failed with status ${res.status}`;
    let details: string[] | undefined;

    if (isJson) {
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
        details = errorData.details;
      } catch {
        // Fallback to text if JSON parsing fails
      }
    } else {
      const text = await res.text();
      if (text) errorMessage = text;
    }

    throw new ApiError(res.status, errorMessage, details);
  }

  return (isJson ? await res.json() : (await res.text())) as T;
}

export async function submitLeave(body: SubmitLeavePayload): Promise<LeaveRequest> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<LeaveRequest>(res);
}

export async function getMyLeaves(email: string): Promise<LeaveRequest[]> {
  if (!email || !email.trim()) return [];
  const res = await fetch(`${BASE_URL}?employeeEmail=${encodeURIComponent(email.trim())}`);
  return handleResponse<LeaveRequest[]>(res);
}

export async function getPending(): Promise<LeaveRequest[]> {
  const res = await fetch(`${BASE_URL}/pending`);
  return handleResponse<LeaveRequest[]>(res);
}

export async function decide(id: number, body: DecisionPayload): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<void>(res);
}

export async function getBalance(email: string): Promise<BalanceResponse> {
  if (!email || !email.trim()) return { remainingDays: 0 };
  const res = await fetch(`${BASE_URL}/balance?employeeEmail=${encodeURIComponent(email.trim())}`);
  return handleResponse<BalanceResponse>(res);
}
