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
  // Exact match first
  if (TITLES[pathname]) return TITLES[pathname];
  // Prefix match
  const key = Object.keys(TITLES).find(
    (k) => k !== '/' && pathname.startsWith(k)
  );
  return key ? TITLES[key] : 'Mifos X';
}

export default function TopBar() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
          <Bell size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
          A
        </div>
      </div>
    </header>
  );
}
