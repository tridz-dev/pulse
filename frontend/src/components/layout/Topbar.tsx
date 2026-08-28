import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Bell, Menu } from 'lucide-react';

interface TopbarProps {
  onOpenMobileNav?: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  // NOTE: there is no notifications service/store in this codebase yet. The bell opens a
  // real dropdown (not a dead control) but has nothing to report. Wire an unread-count
  // badge back in once a notifications service exists — do not fake a count in the meantime.
  return (
    <header className="h-12 w-full flex items-center justify-between px-6 border-b border-rule bg-slab backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden p-3 -ml-3 mr-1 text-mute hover:text-text hover:bg-slab-2 rounded transition-colors"
          title="Open navigation"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative p-2 text-mute hover:text-text hover:bg-slab-2 rounded-[var(--radius)] transition-colors outline-none"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 bg-slab border-rule">
            <DropdownMenuLabel className="text-mute font-mono text-[10px] uppercase tracking-wide">
              Notifications
            </DropdownMenuLabel>
            <div className="px-2 py-3 text-xs text-faint">No new notifications</div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
