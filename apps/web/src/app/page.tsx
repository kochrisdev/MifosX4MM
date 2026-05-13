import { redirect } from 'next/navigation';

// The real dashboard lives in app/(protected)/page.tsx.
// This file is intentionally a thin redirect so the two route-group entries don't conflict.
export default function RootPage() {
  redirect('/dashboard');
}
