import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Brain, Shield, CreditCard, ScrollText, Zap, RefreshCw,
} from 'lucide-react';

interface SidebarProps { onRefresh: () => void; spinning: boolean; }

const navItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Overview' },
  { to: '/feedback', icon: Brain,           label: 'Feedback Loop' },
  { to: '/rules',    icon: Shield,          label: 'Team Rules' },
  { to: '/billing',  icon: CreditCard,      label: 'Billing & Quota' },
  { to: '/audit',    icon: ScrollText,      label: 'Audit Logs' },
];

export default function Sidebar({ onRefresh, spinning }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="logo-icon"><Zap size={18} color="#fff" /></span>
        <span className="logo-text">Antigravity</span>
        <span className="status-dot" title="System online" />
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} className="nav-icon" />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="sidebar-version">v1.0.0</span>
        <button
          className={`refresh-btn${spinning ? ' spinning' : ''}`}
          onClick={onRefresh}
          title="Refresh data"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </aside>
  );
}
