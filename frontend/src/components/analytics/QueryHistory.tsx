import { useState } from 'react';
import { 
  History, 
  Star, 
  RotateCcw, 
  Trash2, 
  Search,
  Clock,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { QueryHistoryItem } from '@/hooks/useNLPQuery';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface QueryHistoryProps {
  history: QueryHistoryItem[];
  onReRun: (query: string) => void;
  onToggleStar: (id: string) => void;
  onClearHistory: () => void;
  className?: string;
}

export function QueryHistory({ history, onReRun, onToggleStar, onClearHistory, className }: QueryHistoryProps) {
  const { toast } = useToast();
  const [filterText, setFilterText] = useState('');
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);

  const filteredHistory = history.filter(item => {
    const matchesFilter = item.query.toLowerCase().includes(filterText.toLowerCase());
    const matchesStarred = !showOnlyStarred || item.starred;
    return matchesFilter && matchesStarred;
  });

  const starredCount = history.filter(item => item.starred).length;

  const handleClearAll = () => {
    onClearHistory();
    toast.success('All query history has been removed');
  };

  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (history.length === 0) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">No queries yet</h3>
          <p className="text-xs text-muted-foreground mt-1">Your natural language queries will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Query History
              <Badge variant="secondary" className="text-xs">{history.length}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {starredCount > 0 && (
                <span className="flex items-center gap-1 mt-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {starredCount} starred
                </span>
              )}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyStarred(!showOnlyStarred)}
              className={cn('h-8 px-2', showOnlyStarred && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30')}
            >
              <Star className={cn('h-4 w-4', showOnlyStarred && 'fill-amber-400 text-amber-400')} />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear query history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {history.length} queries from your history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive">Clear All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter queries..." className="pl-9 h-9" />
          {filterText && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setFilterText('')}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-2">
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {showOnlyStarred ? 'No starred queries' : 'No matching queries'}
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div key={item.id} className={cn('group flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-accent/50')}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onToggleStar(item.id)}
                >
                  <Star className={cn('h-4 w-4', item.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                </Button>

                {item.starred && <Star className="h-4 w-4 fill-amber-400 text-amber-400 flex-shrink-0" />}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm truncate">{item.query}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimeAgo(item.timestamp)}</span>
                    {item.result?.type && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-[10px] px-1">{item.result.type}</Badge>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onReRun(item.query)} title="Re-run query">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function QueryHistoryCompact({ history, onReRun, onToggleStar, className }: { history: QueryHistoryItem[]; onReRun: (query: string) => void; onToggleStar: (id: string) => void; className?: string }) {
  const recentQueries = history.slice(0, 5);
  if (recentQueries.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase">Recent Queries</h4>
      </div>
      <div className="space-y-1">
        {recentQueries.map((item) => (
          <button
            key={item.id}
            onClick={() => onReRun(item.query)}
            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left transition-colors group"
          >
            <History className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate flex-1">{item.query}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onToggleStar(item.id); }}
            >
              <Star className={cn('h-3 w-3', item.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
            </Button>
          </button>
        ))}
      </div>
    </div>
  );
}

export function QueryHistorySkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-9 w-full bg-muted animate-pulse rounded mt-3" />
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2.5">
              <div className="h-7 w-7 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
