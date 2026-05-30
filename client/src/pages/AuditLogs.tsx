import { useState } from 'react';
import type { ReactNode } from 'react';
import { fetchAuditLogs } from '../api/client';
import type { AuditLog } from '../api/client';
import { useToast } from '../components/ToastContext';
import Pagination from '../components/Pagination';
import { Search, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react';

const ACTION_META: Record<string, { icon: ReactNode; color: string }> = {
  REVIEW_COMPLETED:           { icon: <CheckCircle2 size={16} />, color: 'var(--green-400)' },
  REVIEW_FAILED:              { icon: <XCircle size={16} />,      color: 'var(--red-400)' },
  REVIEW_SKIPPED_LIMIT_EXCEEDED: { icon: <AlertCircle size={16} />, color: 'var(--amber-400)' },
  SUBSCRIPTION_PLAN_UPDATED:  { icon: <Info size={16} />,         color: 'var(--cyan-400)' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditLogs() {
  const [orgId, setOrgId]   = useState('');
  const [logs, setLogs]     = useState<AuditLog[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const { show } = useToast();
  const LIMIT = 20;

  const load = async (p = 1) => {
    if (!orgId.trim()) { show('Enter an Organization ID', 'error'); return; }
    setLoading(true);
    try {
      const d = await fetchAuditLogs(orgId.trim(), { page: p, limit: LIMIT });
      setLogs(d.logs);
      setTotal(d.total);
      setPage(p);
      setFetched(true);
    } catch (err: any) { show(err.message || 'Not found', 'error'); }
    finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-body">
      <div className="page-controls">
        <div className="filter-group">
          <label className="filter-label">Organization ID</label>
          <input
            className="filter-input"
            placeholder="Enter org UUID…"
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(1)}
            style={{ minWidth: 280 }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => load(1)} disabled={loading}>
          <Search size={14} /> {loading ? 'Loading…' : 'Load Logs'}
        </button>
        {fetched && (
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
            {total.toLocaleString()} entries
          </span>
        )}
      </div>

      {!fetched && !loading && (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <span className="empty-icon">📋</span>
          Enter an Organization ID to load the audit trail.
        </div>
      )}

      {loading && (
        <div className="audit-list">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
        </div>
      )}

      {!loading && fetched && logs.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <span className="empty-icon">📭</span>
          No audit logs found for this organization.
        </div>
      )}

      {!loading && logs.length > 0 && (
        <>
          <div className="audit-list">
            {logs.map(log => {
              const meta = ACTION_META[log.action];
              return (
                <div key={log.id} className="audit-item">
                  <span className="audit-icon" style={{ color: meta?.color ?? 'var(--text-muted)' }}>
                    {meta?.icon ?? <Info size={16} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="audit-action">{log.action}</div>
                    {log.details && (
                      <div className="audit-details">
                        {Object.entries(log.details).map(([k, v]) => (
                          <span key={k} style={{ marginRight: 14 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                              {String(v)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="audit-time">{formatDate(log.createdAt)}</span>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={p => load(p)} />
        </>
      )}
    </div>
  );
}
