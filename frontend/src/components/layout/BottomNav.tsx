import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Network,
  FileText,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function BottomNav() {
  const { currentUser } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Team', path: '/team', icon: Users, hideFor: ['Pulse User'] },
    { name: 'Ops', path: '/operations', icon: Network, hideFor: ['Pulse User', 'Pulse Manager'] },
    { name: 'Insights', path: '/insights', icon: BarChart3, hideFor: ['Pulse User', 'Pulse Manager'] },
    { name: 'SOPs', path: '/templates', icon: FileText, hideFor: ['Pulse User'] },
  ];

  const visibleItems = navItems.filter(
    (item) => !item.hideFor?.includes(currentUser?.systemRole || '')
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#09090b]/95 backdrop-blur-lg border-t border-zinc-800/60 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 px-2">
        {visibleItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors min-w-0',
                isActive
                  ? 'text-indigo-400'
                  : 'text-zinc-500 active:text-zinc-300'
              )}
            >
              <item.icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className="shrink-0"
              />
              <span className="text-[10px] font-medium leading-none truncate">
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
