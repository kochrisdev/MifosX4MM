'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Landmark, CreditCard,
  BarChart3, FileText, Settings, LogOut, HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { logout } from '@/lib/api';

const WORKSPACE_NAV = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/clients',      label: 'Clients',      icon: Users },
  { href: '/loans',        label: 'Loans',        icon: Landmark },
  { href: '/collections',  label: 'Collections',  icon: CreditCard },
  { href: '/reports',      label: 'Reports',      icon: BarChart3 },
  { href: '/documents',    label: 'Documents',    icon: FileText },
];

const ADMIN_NAV = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px',
        borderRadius: 'var(--r-btn)',
        color: active ? 'var(--teal)' : 'var(--ink-2)',
        background: active ? 'var(--teal-50)' : 'transparent',
        fontWeight: active ? 600 : 500,
        fontSize: '13px',
        transition: 'background 100ms, color 100ms',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink)'; } }}
      onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--ink-2)'; } }}
    >
      <Icon size={15} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }} />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 12px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 8px 10px' }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 6,
          background: 'var(--teal)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '-0.01em',
          flexShrink: 0,
        }}>M</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>Mifos X</div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.2 }}>MFI Platform</div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px',
        margin: '4px 0 8px',
        borderRadius: 'var(--r-btn)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        cursor: 'default',
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)' }}>Default Workspace</span>
        <ChevronDown size={12} style={{ color: 'var(--ink-3)' }} />
      </div>

      {/* Workspace nav */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', padding: '8px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Workspace
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {WORKSPACE_NAV.map((item) => <NavItem key={item.href} {...item} />)}
        </nav>

        {/* Admin nav */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', padding: '8px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Admin
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {ADMIN_NAV.map((item) => <NavItem key={item.href} {...item} />)}
          </nav>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <a
          href="#"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 'var(--r-btn)',
            fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)',
            textDecoration: 'none',
          }}
        >
          <HelpCircle size={14} strokeWidth={1.75} />
          Help &amp; docs
        </a>

        {/* User card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px',
          borderRadius: 'var(--r-btn)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--ink)', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontSize: 11.5, fontWeight: 600, flexShrink: 0,
          }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Admin</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.2 }}>Branch Manager</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            style={{
              display: 'grid', placeItems: 'center',
              width: 26, height: 26, borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--ink-3)', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <LogOut size={12} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}
