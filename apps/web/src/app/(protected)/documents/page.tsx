'use client';

import { FileText } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4 }}>Workspace / Documents</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>Documents</h1>
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
          <FileText size={20} strokeWidth={1.5} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>No documents yet</p>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 320, margin: 0 }}>
            KYC documents and loan agreements will appear here once uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
