import { useAuth } from '@/store/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function Topbar() {
  const { currentUser, logout } = useAuth();
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 hover:bg-slab-2 transition-colors outline-none">
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
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 bg-slab border-rule">
            <DropdownMenuLabel className="text-mute font-mono text-[10px] uppercase tracking-wide">
              Theme
            </DropdownMenuLabel>
            <div className="px-1.5 py-1">
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator className="bg-rule" />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void logout();
              }}
              className="text-fail data-[variant=destructive]:text-fail"
            >
              <LogOut size={14} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
