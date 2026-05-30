import { useEffect, useState, useCallback } from 'react';
import { fetchFeedbackHistory } from '../api/client';
import type { FeedbackHistory } from '../api/client';
import FeedbackCard from '../components/FeedbackCard';
import Pagination from '../components/Pagination';
import { Search } from 'lucide-react';

export default function FeedbackLoop() {
  const [data, setData]         = useState<FeedbackHistory | null>(null);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState('');
  const [repo, setRepo]         = useState('');
  const [limit, setLimit]       = useState(20);
  const [repoInput, setRepoInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchFeedbackHistory({ status: status || undefined, repo: repo || undefined, page, limit });
      setData(d);
    } catch { /* parent handles */ }
    finally { setLoading(false); }
  }, [status, repo, page, limit]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  const applyFilters = () => { setPage(1); setRepo(repoInput); };

  return (
    <div className="page-body">
      {/* Controls */}
      <div className="page-controls">
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select
            className="filter-select"
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Repository</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="filter-input"
              placeholder="owner/repo"
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
            <button className="btn btn-ghost" onClick={applyFilters} title="Search">
              <Search size={14} />
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Per page</label>
          <select
            className="filter-select"
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            {[10, 20, 50].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>

        {data && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
            {data.total.toLocaleString()} results
          </div>
        )}
      </div>

      {/* Feedback list */}
      {loading && (
        <div className="feedback-list">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {!loading && data?.history.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <span className="empty-icon">🧠</span>
          No feedback records match your filters.
        </div>
      )}

      {!loading && data && data.history.length > 0 && (
        <div className="feedback-list">
          {data.history.map(c => <FeedbackCard key={c.id} comment={c} />)}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
      )}
    </div>
  );
}
