import { useAuth } from '@/store/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLocation } from 'react-router-dom';

export function Topbar() {
  const { currentUser } = useAuth();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName =
    pathParts.length > 0 ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) : 'Dashboard';

  return (
    <header className="h-12 w-full flex items-center justify-between px-6 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-100 hidden sm:block">Pulse</span>
        <span className="text-zinc-600 hidden sm:block">/</span>
        <span className="text-sm font-semibold text-zinc-200">{pageName}</span>
      </div>

      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6 rounded-sm border border-zinc-700">
          <AvatarImage src={currentUser?.avatarUrl} />
          <AvatarFallback className="text-[10px] bg-indigo-900 text-indigo-100 rounded-sm">
            {currentUser?.name?.charAt(0) ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start translate-y-[-1px] text-left">
          <span className="text-xs font-medium leading-none text-zinc-200">{currentUser?.name}</span>
          <span className="text-[10px] leading-none text-zinc-500 mt-1">{currentUser?.role}</span>
        </div>
      </div>
    </header>
  );
}
