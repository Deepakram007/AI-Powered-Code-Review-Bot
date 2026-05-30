import { useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';

interface Props {
  health: { ok: boolean; database: string; redis: string } | null;
  lastUpdated: string;
}

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/':         { title: 'Overview',       subtitle: 'Real-time AI code review metrics' },
  '/feedback': { title: 'Feedback Loop',  subtitle: 'Developer sentiment & learning history' },
  '/rules':    { title: 'Team Rules',     subtitle: 'Custom guidelines injected into the AI prompt' },
  '/billing':  { title: 'Billing & Quota', subtitle: 'Subscription plan & monthly review usage' },
  '/audit':    { title: 'Audit Logs',     subtitle: 'Tenant action history for compliance' },
};

export default function Topbar({ health, lastUpdated }: Props) {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? PAGE_META['/'];

  const healthClass = health === null ? '' : health.ok ? 'healthy' : 'unhealthy';
  const healthText  = health === null ? 'Checking…' : health.ok ? 'All Systems Go' : 'Degraded';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">{meta.title}</h1>
        <span className="page-subtitle">{meta.subtitle}</span>
      </div>
      <div className="topbar-right">
        <div className={`health-badge ${healthClass}`}>
          <Activity size={12} className="health-ring" />
          {healthText}
        </div>
        {lastUpdated && (
          <span className="last-updated">Updated {lastUpdated}</span>
        )}
      </div>
    </header>
  );
}
