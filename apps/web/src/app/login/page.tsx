'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push('/');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: 'var(--sans)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        padding: '0 16px',
      }}>
        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-card)',
          padding: '36px 32px 32px',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'var(--teal)',
              color: '#fff',
              display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 15,
              flexShrink: 0,
            }}>M</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>Mifos X</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>MFI Management Portal</div>
            </div>
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.015em' }}>
            Sign in
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>
            Enter your credentials to access the portal
          </p>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 5 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="your.username"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-input)',
                  fontSize: 14,
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                  outline: 'none',
                  fontFamily: 'var(--sans)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 5 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-input)',
                  fontSize: 14,
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                  outline: 'none',
                  fontFamily: 'var(--sans)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '8px 12px',
                background: 'var(--red-50)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--r-input)',
                fontSize: 13,
                color: 'var(--red)',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 36,
                background: loading ? 'var(--ink-3)' : 'var(--teal)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r-btn)',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--sans)',
                transition: 'background 100ms',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--teal-700)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--teal)'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-4)', marginTop: 20 }}>
          Mifos X · MFI Management Platform
        </p>
      </div>
    </div>
  );
}
