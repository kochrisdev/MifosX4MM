'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Landmark, CreditCard,
  BarChart3, FileText, Settings, LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { logout } from '@/lib/api';

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/clients',     label: 'Clients',      icon: Users },
  { href: '/loans',       label: 'Loans',        icon: Landmark },
  { href: '/collections', label: 'Collections',  icon: CreditCard },
  { href: '/reports',     label: 'Reports',      icon: BarChart3 },
];

const SECONDARY = [
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/settings',  label: 'Settings',  icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const navLink = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-56 bg-[var(--sidebar)] flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-white/10">
        <div className="w-5 h-5 bg-[var(--gold)] rounded-sm flex-shrink-0" />
        <span className="font-display font-semibold text-white">MifosX</span>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = navLink(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 py-2 pr-3 rounded-r-lg text-sm font-medium transition-all duration-150 font-display',
                active
                  ? 'border-l-2 border-[var(--gold)] bg-white/5 text-white pl-[11px]'
                  : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white pl-3'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        <div className="pt-3 mt-3 border-t border-white/10 space-y-0.5">
          {SECONDARY.map(({ href, label, icon: Icon }) => {
            const active = navLink(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 py-2 pr-3 rounded-r-lg text-sm font-medium transition-all duration-150 font-display',
                  active
                    ? 'border-l-2 border-[var(--gold)] bg-white/5 text-white pl-[11px]'
                    : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white pl-3'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded bg-[var(--gold)] text-[#1b2030] text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
            A
          </div>
          <span className="text-[var(--sidebar-text)] text-sm font-display">Admin</span>
          <button
            onClick={logout}
            className="text-[var(--sidebar-text)] hover:text-white ml-auto transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
