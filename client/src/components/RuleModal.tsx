import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { TeamRule } from '../api/client';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  editing: TeamRule | null;
  onClose: () => void;
  onSave: (data: {
    ruleType: string; repoPattern: string; description: string; enabled: boolean;
  }) => void;
}

const RULE_TYPES = ['BUG', 'PERFORMANCE', 'SECURITY', 'STYLE', 'GENERAL'];

export default function RuleModal({ open, editing, onClose, onSave }: Props) {
  const [ruleType, setRuleType]       = useState('BUG');
  const [repoPattern, setRepoPattern] = useState('*');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled]         = useState(true);

  useEffect(() => {
    if (editing) {
      setRuleType(editing.ruleType);
      setRepoPattern(editing.repoPattern);
      setDescription(editing.description);
      setEnabled(editing.enabled);
    } else {
      setRuleType('BUG'); setRepoPattern('*'); setDescription(''); setEnabled(true);
    }
  }, [editing, open]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onSave({ ruleType, repoPattern, description, enabled });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{editing ? '✏️ Edit Rule' : '➕ Add Team Rule'}</span>
          <button className="modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Rule Type</label>
              <select className="form-select" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                {RULE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Repo Pattern</label>
              <input
                className="form-input"
                value={repoPattern}
                onChange={e => setRepoPattern(e.target.value)}
                placeholder="owner/repo  or  *  for all repos"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what the AI should enforce…"
                required
              />
            </div>

            <div className="form-group form-inline">
              <label className="form-label">Enabled</label>
              <label className="toggle-switch">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Rule</button>
          </div>
        </form>
      </div>
    </div>
  );
}
