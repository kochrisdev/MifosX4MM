'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';

const TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/clients':     'Clients',
  '/loans':       'Loans',
  '/collections': 'Collections',
  '/reports':     'Reports',
  '/documents':   'Documents',
  '/settings':    'Settings',
};

function getTitle(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  const key = Object.keys(TITLES).find(
    (k) => k !== '/' && pathname.startsWith(k)
  );
  return key ? TITLES[key] : 'Mifos X';
}

export default function TopBar() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="h-12 bg-white border-b border-[var(--border)] flex items-center justify-between px-6">
      <h1 className="font-display font-semibold text-[var(--text-1)] text-sm">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-2)] bg-[var(--page-bg)] border border-[var(--border)] px-2 py-1 rounded font-display">
          HQ Branch
        </span>
        <button
          className="text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
        <div className="w-7 h-7 rounded bg-[var(--sidebar)] text-white text-xs font-bold font-mono flex items-center justify-center">
          A
        </div>
      </div>
    </header>
  );
}
