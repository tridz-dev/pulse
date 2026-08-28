import { useEffect } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface CommandSearchProps {
    /** Whether the search dialog is open. Owned by the parent (AppLayout) so other
     * UI — like the sidebar's search button — can explicitly open it. */
    open: boolean;
    onOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
}

/**
 * Global Cmd/Ctrl+K search modal. The shortcut is registered here regardless of
 * sidebar collapse state, so the capability survives even when the sidebar's
 * own search button (visible only when expanded) is not rendered.
 *
 * Open/close state is owned by the parent (see `open`/`onOpenChange`) so it can
 * be shared with other triggers (e.g. Sidebar's search button) without routing
 * through a synthetic keyboard event.
 *
 * NOTE: there is no search index/backend wired up yet — this only proves the
 * affordance is real (opens, traps focus, closes on Escape/backdrop). Real
 * search indexing across tasks/team/operations is a follow-up (Wave 3+).
 */
export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search size={16} className="text-mute" />
            Search
          </DialogTitle>
          <DialogDescription>
            Search indexing isn't wired up yet — this is a placeholder for the real thing.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          type="text"
          placeholder="Search tasks, people, operations..."
          className="w-full px-2.5 py-1.5 text-sm bg-slab-2 border border-rule rounded-[var(--radius)] text-text placeholder:text-faint outline-none"
          aria-label="Search query"
        />
        <div className="text-xs text-faint px-0.5">No results yet — search isn't connected to real data.</div>
      </DialogContent>
    </Dialog>
  );
}
