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
      router.push('/dashboard');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left dark panel */}
      <div className="hidden lg:flex w-1/2 bg-[var(--sidebar)] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--gold)] rounded-sm" />
          <span className="font-display font-semibold text-2xl text-white">MifosX</span>
        </div>

        {/* Tagline */}
        <p className="font-sans text-[var(--gold-light)] text-sm mt-4 leading-relaxed max-w-xs text-center">
          Empowering microfinance institutions across Myanmar
        </p>

        {/* Decorative SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          className="absolute bottom-0 right-0 w-48 h-48 opacity-10"
          aria-hidden="true"
        >
          <circle cx="160" cy="160" r="100" fill="white" />
          <circle cx="80" cy="140" r="70" fill="white" />
          <circle cx="140" cy="80" r="60" fill="white" />
        </svg>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-[var(--page-bg)] p-8">
        <div className="w-full max-w-sm">
          <h1 className="font-display font-semibold text-2xl text-[var(--text-1)] mb-1">
            Sign in
          </h1>
          <p className="font-sans text-sm text-[var(--text-2)] mb-8">
            MFI Management Portal
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-sans text-sm font-medium text-[var(--text-1)] mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block font-sans text-sm font-medium text-[var(--text-1)] mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--danger)] mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--gold)] hover:bg-[#b8890f] text-[#1b2030] font-semibold text-sm rounded-lg py-2.5 transition disabled:opacity-50 font-display"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
