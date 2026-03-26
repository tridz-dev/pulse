import { useTheme, type Theme } from '@/hooks/useTheme';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'dropdown';
}

const themeIcons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const themeLabels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ThemeToggle({ className, variant = 'dropdown' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme, toggleTheme } = useTheme();

  const CurrentIcon = themeIcons[theme];

  // Simple icon-only toggle that cycles through themes
  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn(
          'h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors',
          className
        )}
        title={`Theme: ${themeLabels[theme]} (click to cycle)`}
        aria-label={`Current theme: ${themeLabels[theme]}, click to cycle`}
      >
        <CurrentIcon size={18} className="transition-transform duration-200" />
      </Button>
    );
  }

  // Dropdown menu variant with explicit theme selection
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors',
          className
        )}
        title={`Theme: ${themeLabels[theme]}`}
        aria-label={`Current theme: ${themeLabels[theme]}, open theme menu`}
      >
        <CurrentIcon size={18} className="transition-transform duration-200" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            theme === 'light' && 'bg-accent text-accent-foreground'
          )}
        >
          <Sun size={16} />
          <span>Light</span>
          {theme === 'light' && (
            <span className="ml-auto text-xs text-muted-foreground">●</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            theme === 'dark' && 'bg-accent text-accent-foreground'
          )}
        >
          <Moon size={16} />
          <span>Dark</span>
          {theme === 'dark' && (
            <span className="ml-auto text-xs text-muted-foreground">●</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          className={cn(
            'flex items-center gap-2 cursor-pointer',
            theme === 'system' && 'bg-accent text-accent-foreground'
          )}
        >
          <Monitor size={16} />
          <span>System</span>
          {theme === 'system' && (
            <span className="ml-auto text-xs text-muted-foreground">●</span>
          )}
          {theme === 'system' && (
            <span className="ml-2 text-[10px] text-muted-foreground uppercase">
              ({resolvedTheme})
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simplified version for mobile placement (above bottom nav)
export function MobileThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  const CurrentIcon = themeIcons[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        'h-10 w-10 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all active:scale-95',
        className
      )}
      title={`Theme: ${themeLabels[theme]}`}
      aria-label={`Current theme: ${themeLabels[theme]}, click to cycle`}
    >
      <CurrentIcon size={20} className="transition-transform duration-200" />
    </Button>
  );
}
