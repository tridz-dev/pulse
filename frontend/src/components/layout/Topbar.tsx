import { useAuth } from '@/store/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLocation } from 'react-router-dom';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export function Topbar() {
  const { currentUser } = useAuth();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName =
    pathParts.length > 0 ? pathParts[pathParts.length - 1].charAt(0).toUpperCase() + pathParts[pathParts.length - 1].slice(1) : 'Dashboard';

  return (
    <header className="hidden lg:flex h-12 w-full items-center justify-between px-4 xl:px-6 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-zinc-100">Pulse</span>
        <span className="text-zinc-600">/</span>
        <span className="text-sm font-semibold text-zinc-200 truncate">{pageName}</span>
      </div>

      <div className="flex items-center gap-2 xl:gap-3 shrink-0">
        {/* Language Switcher */}
        <LanguageSwitcher />
        
        {/* Theme Toggle */}
        <ThemeToggle />
        
        {/* Notification Dropdown with Bell Icon */}
        <NotificationDropdown />
        
        <Avatar className="h-7 w-7 xl:h-8 xl:w-8 rounded-sm border border-zinc-700">
          <AvatarImage src={currentUser?.avatarUrl} />
          <AvatarFallback className="text-[10px] bg-indigo-900 text-indigo-100 rounded-sm">
            {currentUser?.name?.charAt(0) ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="hidden xl:flex flex-col items-start translate-y-[-1px] text-left">
          <span className="text-xs font-medium leading-none text-zinc-200 truncate max-w-[120px]">{currentUser?.name}</span>
          <span className="text-[10px] leading-none text-zinc-500 mt-1">{currentUser?.role}</span>
        </div>
      </div>
    </header>
  );
}
