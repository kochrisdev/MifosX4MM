import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/query';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mifos X | MFI Management Portal',
  description: 'Core banking management portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
