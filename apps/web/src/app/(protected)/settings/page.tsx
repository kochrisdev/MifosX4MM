'use client';

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>Admin / Settings</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>Settings</h1>
      </div>

      {/* Empty state card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-card)',
        padding: '64px 16px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 44, height: 44,
          borderRadius: 8,
          background: 'var(--surface-3)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ink-3)',
        }}>
          <Settings size={20} strokeWidth={1.5} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>Settings coming in next release</p>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 320, margin: 0 }}>
            Organisation settings, branch management, and user administration will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
