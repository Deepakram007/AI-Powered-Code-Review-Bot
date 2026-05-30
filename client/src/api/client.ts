// Typed API client — proxied to Express backend via Vite dev server
const BASE = '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || res.statusText);
  }
  return res.json();
}

// --- Health ---
export const fetchHealth = () =>
  apiFetch<{ status: string; services: { database: string; redis: string }; timestamp: string }>('/health');

// --- Feedback ---
export interface FeedbackStats {
  summary: {
    totalReviewsGenerated: number;
    approved: number;
    rejected: number;
    pending: number;
    accuracyRatePercentage: number;
  };
  repositories: { repo: string; reviewCount: number }[];
}

export interface ReviewComment {
  id: string;
  reviewId?: string;
  githubCommentId: string;
  repo: string;
  prNumber: number;
  filePath: string;
  line: number;
  codeSnippet: string;
  explanation: string;
  suggestion: string;
  severity: string;
  commentType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  feedbackText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackHistory {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  history: ReviewComment[];
}

export const fetchFeedbackStats = () => apiFetch<FeedbackStats>('/api/feedback/stats');
export const fetchFeedbackHistory = (params: {
  status?: string; repo?: string; page?: number; limit?: number;
}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.repo) q.set('repo', params.repo);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch<FeedbackHistory>(`/api/feedback/history?${q}`);
};

// --- Rules ---
export interface TeamRule {
  id: string;
  organizationId: string;
  repoPattern: string;
  ruleType: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const fetchRules = (organizationId?: string) => {
  const q = organizationId ? `?organizationId=${organizationId}` : '';
  return apiFetch<TeamRule[]>(`/api/rules${q}`);
};

export const createRule = (body: {
  repoPattern: string; ruleType: string; description: string; enabled: boolean; organizationId?: string;
}) => apiFetch<TeamRule>('/api/rules', { method: 'POST', body: JSON.stringify(body) });

export const updateRule = (id: string, body: Partial<TeamRule>) =>
  apiFetch<TeamRule>(`/api/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteRule = (id: string) =>
  apiFetch<{ message: string }>(`/api/rules/${id}`, { method: 'DELETE' });

// --- Billing ---
export interface BillingUsage {
  organization: { id: string; name: string; billingPlan: string };
  currentMonth: string;
  usage: { prReviewedCount: number; prReviewedLimit: number; prReviewsRemaining: number; tokensUsed: number };
}

export const fetchBillingUsage = (orgId: string) =>
  apiFetch<BillingUsage>(`/api/billing/usage/${orgId}`);

export const updateBillingTier = (orgId: string, plan: string) =>
  apiFetch<{ message: string; organization: { id: string; name: string; billingPlan: string } }>(
    `/api/billing/tier/${orgId}`,
    { method: 'POST', body: JSON.stringify({ plan }) }
  );

// --- Audit ---
export interface AuditLog {
  id: string;
  userId?: string;
  organizationId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export const fetchAuditLogs = (orgId: string, params?: { page?: number; limit?: number }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  return apiFetch<{ total: number; logs: AuditLog[] }>(`/api/audit/${orgId}?${q}`);
};
