import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Activity,
  TrendingDown,
  GitBranch,
  Shield,
  Lightbulb,
  Info,
  ChevronLeft,
  ChevronRight,
  Cpu,
  MessageSquare,
  Timer,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Upload Data', href: '/upload', icon: Upload },
  { title: 'Machine Health', href: '/health', icon: Activity },
  { title: 'Degradation Speed', href: '/degradation', icon: TrendingDown },
  { title: 'RUL Prediction', href: '/rul', icon: Timer },
  { title: 'Pattern Clustering', href: '/clustering', icon: GitBranch },
  { title: 'Reliability', href: '/reliability', icon: Shield },
  { title: 'Insights', href: '/insights', icon: Lightbulb },
  { title: 'Contact & Queries', href: '/contact', icon: MessageSquare },
  { title: 'About', href: '/about', icon: Info },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Cpu className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">DEGRADIX</span>
              <span className="text-[10px] text-sidebar-foreground/60 leading-none">Machine Analytics</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section */}
      {user && (
        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1',
              collapsed && 'justify-center px-2'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20">
              <User className="h-4 w-4 text-sidebar-primary" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.username}
                </span>
                <span className="text-[10px] text-sidebar-foreground/50 truncate">
                  {user.email}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium w-full',
              'text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-500 transition-all',
              collapsed && 'justify-center px-2'
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      )}

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-elevated',
          'hover:bg-primary-hover transition-colors'
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
