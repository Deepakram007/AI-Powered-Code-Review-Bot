import { useEffect, useState, useCallback } from 'react';
import { Bot, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts';
import { fetchFeedbackStats, fetchFeedbackHistory } from '../api/client';
import type { FeedbackStats } from '../api/client';
import MetricCard from '../components/MetricCard';
import AccuracyRing from '../components/AccuracyRing';
import { useNavigate } from 'react-router-dom';

// Generate fake sparkline data from total count
function makeSparkline(total: number) {
  const pts = [];
  let v = Math.max(10, total - 140);
  for (let i = 0; i < 14; i++) {
    v += Math.floor(Math.random() * 20 - 5);
    pts.push({ v: Math.max(0, v) });
  }
  return pts;
}

export default function Overview() {
  const [stats, setStats]         = useState<FeedbackStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [sparkData, setSparkData] = useState<{ v: number }[]>([]);
  const [recent, setRecent]       = useState<any[]>([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, hist] = await Promise.all([
        fetchFeedbackStats(),
        fetchFeedbackHistory({ limit: 4 }),
      ]);
      setStats(s);
      setSparkData(makeSparkline(s.summary.totalReviewsGenerated));
      setRecent(hist.history);
    } catch { /* handled by parent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = stats?.summary;

  return (
    <div className="page-body">
      {/* ── METRIC CARDS ── */}
      <div className="metrics-grid">
        {/* Total reviews */}
        <MetricCard
          label="Total Reviews"
          value={loading ? '—' : (s?.totalReviewsGenerated ?? 0).toLocaleString()}
          sub="All-time comment count"
          icon={<Bot size={18} />}
          variant="purple"
          chip={s ? { label: `${s.pending} pending`, variant: 'amber' } : undefined}
        >
          {!loading && sparkData.length > 0 && (
            <div style={{ marginTop: 12, height: 44, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#A855F7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone" dataKey="v"
                    stroke="#A855F7" strokeWidth={2}
                    fill="url(#spGrad)" dot={false}
                  />
                  <RTooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                    itemStyle={{ color: 'var(--purple-400)' }}
                    formatter={(value: any) => [value, 'Reviews']}
                    labelFormatter={() => ''}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </MetricCard>

        {/* Accuracy ring */}
        <MetricCard
          label="Accuracy Rate"
          value=""
          sub={s ? `${s.approved} approved / ${(s.approved + s.rejected)} reviewed` : 'Approved / reviewed'}
          icon={<TrendingUp size={18} />}
          variant="cyan"
        >
          {loading
            ? <div className="skeleton" style={{ height: 130, width: 130, borderRadius: '50%', margin: '4px auto' }} />
            : <AccuracyRing pct={s?.accuracyRatePercentage ?? 0} size={130} />
          }
        </MetricCard>

        {/* Approved */}
        <MetricCard
          label="Approved"
          value={loading ? '—' : (s?.approved ?? 0).toLocaleString()}
          sub="Developer-accepted reviews"
          icon={<CheckCircle2 size={18} />}
          variant="green"
          chip={s ? { label: `${s.pending} pending`, variant: 'amber' } : undefined}
        />

        {/* Rejected */}
        <MetricCard
          label="Rejected"
          value={loading ? '—' : (s?.rejected ?? 0).toLocaleString()}
          sub="False positives dismissed"
          icon={<XCircle size={18} />}
          variant="red"
          chip={s && s.rejected + s.approved > 0
            ? { label: `${((s.rejected / (s.rejected + s.approved)) * 100).toFixed(1)}% rejection rate`, variant: 'red' }
            : undefined}
        />
      </div>

      {/* ── BOTTOM PANELS ── */}
      <div className="panels-row">
        {/* Repo breakdown */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">📁 Repository Breakdown</span>
            <span className="panel-badge">{stats?.repositories.length ?? 0} repos</span>
          </div>
          <div className="panel-body">
            {loading && (
              [1,2,3].map(i => (
                <div key={i} className="skeleton" style={{ height: 36, borderRadius: 8 }} />
              ))
            )}
            {!loading && (stats?.repositories.length ?? 0) === 0 && (
              <div className="empty-state"><span className="empty-icon">📭</span>No repos yet</div>
            )}
            {!loading && stats?.repositories.map(r => (
              <div key={r.repo} className="repo-row">
                <span className="repo-name">{r.repo}</span>
                <span className="repo-count-pill">{r.reviewCount} reviews</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent feedback */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">🧠 Recent Feedback</span>
            <button className="view-all-btn" onClick={() => navigate('/feedback')}>View all →</button>
          </div>
          <div className="panel-body" style={{ gap: 12 }}>
            {loading && [1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />
            ))}
            {!loading && recent.length === 0 && (
              <div className="empty-state"><span className="empty-icon">🤖</span>No feedback yet — open a PR to get started!</div>
            )}
            {!loading && recent.map(c => (
              <div key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="feedback-file" style={{ fontSize: 11 }}>{c.filePath}:{c.line}</span>
                  <span className={`status-badge status-${c.status}`} style={{ fontSize: 10 }}>
                    {c.status}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {c.explanation.slice(0, 100)}{c.explanation.length > 100 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
