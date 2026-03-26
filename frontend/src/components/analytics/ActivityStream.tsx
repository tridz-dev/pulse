import { useState, useMemo } from 'react';
import { useActivityStream } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  RefreshCw,
  Filter,
} from 'lucide-react';

interface ActivityStreamProps {
  className?: string;
  compact?: boolean;
  limit?: number;
}



const typeIcons: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  failed: XCircle,
  anomaly: AlertTriangle,
  info: Info,
  warning: AlertCircle,
  correction: CheckCircle2,
};

const typeColors: Record<string, string> = {
  completed: 'text-green-500 bg-green-500/10',
  failed: 'text-red-500 bg-red-500/10',
  anomaly: 'text-amber-500 bg-amber-500/10',
  info: 'text-blue-500 bg-blue-500/10',
  warning: 'text-orange-500 bg-orange-500/10',
  correction: 'text-purple-500 bg-purple-500/10',
};

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ActivityStream({ className, compact = false, limit = 20 }: ActivityStreamProps) {
  const { activities, isLoading, isError, hasNewActivity, dismissNewActivity, refresh } = useActivityStream(limit);
  const [filter, setFilter] = useState<string>('all');

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter(a => a.type === filter);
  }, [activities, filter]);

  if (isLoading && activities.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
              <div className="h-3 w-1/2 bg-muted-foreground/20 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Failed to load activity stream</p>
        <Button variant="outline" size="sm" onClick={() => refresh()} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {hasNewActivity && (
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center -mt-2">
          <Button size="sm" variant="secondary" onClick={dismissNewActivity} className="rounded-full shadow-lg">
            <RefreshCw className="h-3 w-3 mr-1" />
            New Activity
          </Button>
        </div>
      )}

      {!compact && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {['all', 'completed', 'failed', 'anomaly', 'warning'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
              className="text-xs capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      )}

      <div className={cn('space-y-2', compact && 'max-h-[300px] overflow-y-auto')}>
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const Icon = typeIcons[activity.type] || Info;
            const colorClass = typeColors[activity.type] || typeColors.info;
            return (
              <div key={activity.id} className={cn('flex gap-3 p-3 rounded-lg transition-colors hover:bg-accent/50')}>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</span>
                    {activity.actor && (
                      <Badge variant="secondary" className="text-[10px]">
                        {activity.actor}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ActivityStreamCompact({ className }: { className?: string }) {
  return <ActivityStream className={className} compact limit={5} />;
}
