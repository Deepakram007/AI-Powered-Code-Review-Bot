import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: ReactNode;
  variant: 'purple' | 'cyan' | 'green' | 'red';
  chip?: { label: string; variant: 'green' | 'red' | 'purple' | 'cyan' | 'amber' };
  children?: ReactNode;
}

export default function MetricCard({ label, value, sub, icon, variant, chip, children }: MetricCardProps) {
  return (
    <div className={`metric-card card-${variant}`}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <span className="metric-icon-wrap">{icon}</span>
      </div>
      <div className={`metric-value ${variant}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      {chip && (
        <span className={`metric-chip chip-${chip.variant}`}>{chip.label}</span>
      )}
      {children}
    </div>
  );
}
