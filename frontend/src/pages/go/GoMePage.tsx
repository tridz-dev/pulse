import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getHomeSummary } from '@/services/go';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ClipboardList } from 'lucide-react';

export function GoMePage() {
  const { currentUser } = useAuth();
  const [openRuns, setOpenRuns] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    getHomeSummary()
      .then((s) => setOpenRuns(s.open_runs))
      .catch(() => setOpenRuns(0));
  }, [currentUser]);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto w-full space-y-8">
      <div className="flex flex-col items-center text-center pt-4">
        <Avatar className="h-20 w-20 rounded-2xl border border-zinc-700">
          <AvatarImage src={currentUser?.avatarUrl} />
          <AvatarFallback className="text-lg bg-indigo-900 text-indigo-100 rounded-2xl">
            {currentUser?.name?.charAt(0) ?? '?'}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-semibold text-white mt-4">{currentUser?.name ?? '—'}</h1>
        <p className="text-sm text-zinc-500 mt-1">{currentUser?.role ?? '—'}</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-3">
        <div className="rounded-lg p-2 bg-indigo-500/10 text-indigo-300">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Today&apos;s open runs</p>
          <p className="text-lg font-semibold text-zinc-100 tabular-nums">{openRuns ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
