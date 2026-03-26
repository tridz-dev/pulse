import { NavLink, useLocation } from 'react-router-dom';
import { Home, ListChecks, Bell, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const tabs = [
  { to: '/go', label: 'Home', icon: Home, end: true },
  { to: '/go/checklists', label: 'Checklists', icon: ListChecks, end: false },
  { to: '/go/alerts', label: 'Alerts', icon: Bell, end: false },
  { to: '/go/me', label: 'Me', icon: User, end: false },
] as const;

export function GoTabBar({ unreadCount = 0 }: { unreadCount?: number }) {
  const location = useLocation();

  return (
    <nav
      className="shrink-0 border-t border-zinc-800 bg-[#18181b]/95 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 px-2"
      aria-label="Pulse Go navigation"
    >
      <div className="flex max-w-lg mx-auto w-full justify-around items-stretch gap-1">
        {tabs.map(({ to, label, icon: Icon, end }) => {
          const active = end
            ? location.pathname === to || location.pathname === `${to}/`
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 px-2 text-[10px] font-medium transition-colors min-w-0',
                active ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <span className="relative inline-flex">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {label === 'Alerts' && unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center tabular-nums">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </span>
              <span className="truncate w-full text-center">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
