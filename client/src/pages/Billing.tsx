import { useState } from 'react';
import { fetchBillingUsage, updateBillingTier } from '../api/client';
import type { BillingUsage } from '../api/client';
import { useToast } from '../components/ToastContext';
import { Search, Zap } from 'lucide-react';

const PLANS = ['FREE', 'PRO', 'ENTERPRISE'];
const PLAN_LIMITS: Record<string, number> = { FREE: 50, PRO: 500, ENTERPRISE: 99999 };

export default function Billing() {
  const [orgId, setOrgId]     = useState('');
  const [data, setData]       = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { show } = useToast();

  const fetch = async () => {
    if (!orgId.trim()) { show('Enter an Organization ID', 'error'); return; }
    setLoading(true);
    try {
      const d = await fetchBillingUsage(orgId.trim());
      setData(d);
    } catch (err: any) { show(err.message || 'Not found', 'error'); }
    finally { setLoading(false); }
  };

  const changePlan = async (plan: string) => {
    if (!data) return;
    setUpdating(true);
    try {
      await updateBillingTier(data.organization.id, plan);
      setData(d => d ? { ...d, organization: { ...d.organization, billingPlan: plan } } : d);
      show(`Plan updated to ${plan}`, 'success');
    } catch (err: any) { show(err.message, 'error'); }
    finally { setUpdating(false); }
  };

  const used    = data?.usage.prReviewedCount ?? 0;
  const limit   = data?.usage.prReviewedLimit ?? PLAN_LIMITS[data?.organization.billingPlan ?? 'FREE'] ?? 50;
  const pct     = Math.min(100, (used / limit) * 100);
  const isWarn  = pct >= 80;

  return (
    <div className="page-body">
      {/* Lookup controls */}
      <div className="page-controls">
        <div className="filter-group">
          <label className="filter-label">Organization ID</label>
          <input
            className="filter-input"
            placeholder="Enter org UUID…"
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetch()}
            style={{ minWidth: 280 }}
          />
        </div>
        <button className="btn btn-primary" onClick={fetch} disabled={loading}>
          <Search size={14} /> {loading ? 'Loading…' : 'Fetch Usage'}
        </button>
      </div>

      {/* Results */}
      {!data && !loading && (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <span className="empty-icon">💳</span>
          Enter an Organization ID above to view billing details.
        </div>
      )}

      {loading && (
        <div className="billing-grid" style={{ marginTop: 0 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />)}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Org summary */}
          <div className="billing-card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Organization</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.organization.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{data.organization.id}</div>
            </div>
            <span className={`metric-chip chip-${data.organization.billingPlan === 'ENTERPRISE' ? 'purple' : data.organization.billingPlan === 'PRO' ? 'cyan' : 'amber'}`}
              style={{ marginLeft: 'auto', fontSize: 13, padding: '5px 14px' }}>
              <Zap size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
              {data.organization.billingPlan}
            </span>
          </div>

          {/* Metric grid */}
          <div className="billing-grid">
            {/* PR Reviews */}
            <div className="billing-card">
              <div className="billing-title">PR Reviews This Month</div>
              <div className="billing-value">{used.toLocaleString()}</div>
              <div className="billing-sub">{data.currentMonth}</div>
              <div className="quota-bar-wrap">
                <div className="quota-bar-track">
                  <div className={`quota-bar-fill${isWarn ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="quota-labels">
                  <span>{used} used</span>
                  <span>{limit === 99999 ? 'Unlimited' : `${data.usage.prReviewsRemaining} left`}</span>
                </div>
              </div>
            </div>

            {/* Tokens */}
            <div className="billing-card">
              <div className="billing-title">Tokens Consumed</div>
              <div className="billing-value">{(data.usage.tokensUsed ?? 0).toLocaleString()}</div>
              <div className="billing-sub">This month's LLM token usage</div>
              <span className="metric-chip chip-cyan" style={{ marginTop: 12 }}>
                ~${((data.usage.tokensUsed / 1_000_000) * 0.15).toFixed(4)} estimated cost
              </span>
            </div>

            {/* Plan changer */}
            <div className="billing-card" style={{ gridColumn: '1 / -1' }}>
              <div className="billing-title">Subscription Plan</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Upgrade or downgrade the organization's plan. Changes take effect immediately.
              </div>
              <div className="plan-selector">
                {PLANS.map(p => (
                  <button
                    key={p}
                    className={`plan-btn${data.organization.billingPlan === p ? ' active' : ''}`}
                    onClick={() => changePlan(p)}
                    disabled={updating}
                  >
                    {p === 'FREE' ? '🆓' : p === 'PRO' ? '⚡' : '🚀'} {p}
                    <span style={{ fontSize: 10, opacity: 0.75, display: 'block', marginTop: 1 }}>
                      {p === 'ENTERPRISE' ? 'Unlimited' : `${PLAN_LIMITS[p]}/mo`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
