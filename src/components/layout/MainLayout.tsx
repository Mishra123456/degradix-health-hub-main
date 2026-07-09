import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAppData } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed } = useAppData();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'pl-16' : 'pl-64'
      )}>
        <div className="min-h-screen p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
