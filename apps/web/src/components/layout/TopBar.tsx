'use client';

import { Bell, HelpCircle, Search } from 'lucide-react';

export default function TopBar() {
  return (
    <header
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 5,
        flexShrink: 0,
      }}
    >
      {/* Search */}
      <div style={{ flex: 1, maxWidth: 520, position: 'relative' }}>
        <Search
          size={14}
          strokeWidth={2}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}
        />
        <input
          type="search"
          placeholder="Search clients, loans…"
          style={{
            width: '100%',
            padding: '7px 36px 7px 32px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-input)',
            fontSize: 13,
            outline: 'none',
            color: 'var(--ink)',
            fontFamily: 'var(--sans)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.background = 'var(--surface)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
        />
        <kbd style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
          padding: '1px 5px', border: '1px solid var(--border)',
          borderRadius: 4, background: 'var(--surface)',
        }}>⌘K</kbd>
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        {/* Env tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 9px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-btn)',
          fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)',
          background: 'var(--surface-2)',
          fontFamily: 'var(--mono)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 0 2px rgba(47, 143, 95, 0.18)',
            display: 'inline-block',
          }} />
          Production
        </div>

        {/* Notifications */}
        <button
          style={{
            width: 32, height: 32,
            display: 'grid', placeItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-btn)',
            background: 'var(--surface)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            position: 'relative',
          }}
          title="Notifications"
        >
          <Bell size={14} strokeWidth={1.75} />
          {/* amber dot */}
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--amber)',
            border: '1.5px solid var(--surface)',
          }} />
        </button>

        {/* Help */}
        <button
          style={{
            width: 32, height: 32,
            display: 'grid', placeItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-btn)',
            background: 'var(--surface)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
          title="Help"
        >
          <HelpCircle size={14} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
