import type { TeamRule } from '../api/client';
import { Pencil, Trash2 } from 'lucide-react';

interface Props {
  rule: TeamRule;
  onEdit: (rule: TeamRule) => void;
  onDelete: (id: string) => void;
  onToggle: (rule: TeamRule) => void;
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle }: Props) {
  return (
    <div className={`rule-card${rule.enabled ? '' : ' disabled'}`}>
      <div className="rule-card-header">
        <span className={`rule-type-badge type-${rule.ruleType}`}>{rule.ruleType}</span>
        <label className="toggle-switch" title={rule.enabled ? 'Disable' : 'Enable'}>
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={() => onToggle(rule)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <p className="rule-desc">{rule.description}</p>

      <span className="rule-pattern">{rule.repoPattern}</span>

      <div className="rule-actions">
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {new Date(rule.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(rule)} title="Edit rule">
            <Pencil size={12} />
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(rule.id)} title="Delete rule">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
