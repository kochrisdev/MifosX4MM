import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen overflow-hidden" style={{ gridTemplateColumns: 'var(--sidebar-w) 1fr' }}>
      <Sidebar />
      <div className="flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 pb-12" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
