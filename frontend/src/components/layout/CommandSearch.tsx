import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * Global Cmd/Ctrl+K search modal. The shortcut is registered here regardless of
 * sidebar collapse state, so the capability survives even when the sidebar's
 * own search button (visible only when expanded) is not rendered.
 *
 * NOTE: there is no search index/backend wired up yet — this only proves the
 * affordance is real (opens, traps focus, closes on Escape/backdrop). Real
 * search indexing across tasks/team/operations is a follow-up (Wave 3+).
 */
export function CommandSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
