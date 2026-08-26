import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex border border-rule-2 rounded-[var(--radius)] overflow-hidden"
    >
      {(['dark', 'light'] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => setTheme(t)}
          className={cn(
            'px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wide text-faint transition-colors',
            theme === t && 'bg-slab-2 text-text'
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Topbar() {
  const { currentUser } = useAuth();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName =
    pathParts.length > 0 ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) : 'Dashboard';

  return (
    <header className="h-12 w-full flex items-center justify-between px-6 border-b border-rule bg-slab backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-mute hidden sm:block">Pulse</span>
        <span className="text-mute hidden sm:block">/</span>
        <span className="text-sm font-semibold text-text">{pageName}</span>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        <Avatar className="h-6 w-6 rounded-sm border border-rule">
          <AvatarImage src={currentUser?.avatarUrl} />
          <AvatarFallback className="text-[10px] bg-slab-2 text-text rounded-sm">
            {currentUser?.name?.charAt(0) ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start translate-y-[-1px] text-left">
          <span className="text-xs font-medium leading-none text-text">{currentUser?.name}</span>
          <span className="text-[10px] leading-none text-faint mt-1">{currentUser?.role}</span>
        </div>
      </div>
    </header>
  );
}
