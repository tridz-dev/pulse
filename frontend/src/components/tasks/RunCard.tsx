import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CheckSquare, Clock, Lock } from 'lucide-react';
import type { RunListItem } from '@/services/tasks';

function formatSlot(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function scoreTone(score: number): string {
  if (score >= 85) return 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10';
  if (score >= 60) return 'text-amber-400 border-amber-500/25 bg-amber-500/10';
  return 'text-rose-400 border-rose-500/25 bg-rose-500/10';
}

export function RunCard({
  run,
  onClick,
  compact,
}: {
  run: RunListItem;
  onClick: () => void;
  compact?: boolean;
}) {
  const isClosed = run.status === 'Closed';
  const isLocked = run.status === 'Locked';
  const template = (typeof run.template === 'object' && run.template !== null ? run.template : null) as {
    title?: string;
    frequency_type?: string;
    schedule_kind?: string;
  } | null;

  const progress = Math.round(run.progress ?? 0);
  const score = Math.round(run.score ?? 0);
  const slot = formatSlot(run.period_datetime);

  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-[#18181b] border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30 transition-all cursor-pointer group flex items-center justify-between gap-4 ${isClosed ? 'opacity-70' : ''} ${compact ? 'min-h-[88px]' : ''}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isClosed
              ? 'bg-emerald-500/10 text-emerald-500'
              : isLocked
                ? 'bg-zinc-800 text-zinc-500'
                : 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20'
          }`}
        >
          {isClosed ? <CheckCircle2 size={20} /> : isLocked ? <Lock size={20} /> : <CheckSquare size={20} />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-zinc-200 truncate">{template?.title ?? '—'}</h3>
          <div className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{template?.schedule_kind ?? template?.frequency_type ?? '—'}</span>
            {slot && (
              <>
                <span className="text-zinc-700 hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1 text-indigo-300/90">
                  <Clock size={12} />
                  Due {slot}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-300 bg-indigo-500/5">
              Progress {progress}%
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${scoreTone(score)}`}>
              Score {score}%
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!compact && (
          <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden hidden sm:block">
            <div
              className={`h-full transition-all duration-500 ${isClosed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <Badge
          variant="outline"
          className={`
          ${run.status === 'Open' ? 'text-indigo-400 border-indigo-400/20 bg-indigo-400/10' : ''}
          ${run.status === 'Closed' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' : ''}
          ${run.status === 'Locked' ? 'text-zinc-500 border-zinc-700 bg-zinc-800' : ''}
        `}
        >
          {run.status}
        </Badge>
      </div>
    </Card>
  );
}
