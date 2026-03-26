import { useEffect, useRef, useState } from 'react';
import { useLiveMetrics } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';
import { Activity, CheckCircle2, Clock, Users, ListTodo, TrendingUp, Wifi, WifiOff, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MetricCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'rose';
  isLive?: boolean;
}

function MetricCard({ title, value, subtitle, icon, color, isLive = false }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setIsAnimating(true);
      const startValue = prevValueRef.current;
      const endValue = value;
      const duration = 600;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easeOut;
        setDisplayValue(currentValue);
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          prevValueRef.current = value;
        }
      };
      requestAnimationFrame(animate);
    }
  }, [value]);

  const colorClasses = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', text: 'text-blue-900 dark:text-blue-100', pulse: 'bg-blue-500' },
    green: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: 'text-green-600 dark:text-green-400', text: 'text-green-900 dark:text-green-100', pulse: 'bg-green-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-900 dark:text-amber-100', pulse: 'bg-amber-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', icon: 'text-purple-600 dark:text-purple-400', text: 'text-purple-900 dark:text-purple-100', pulse: 'bg-purple-500' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-600 dark:text-rose-400', text: 'text-rose-900 dark:text-rose-100', pulse: 'bg-rose-500' },
  };

  const colors = colorClasses[color];

  const formatValue = (val: number) => {
    if (title.toLowerCase().includes('score') || title.toLowerCase().includes('%')) return `${Math.round(val * 100)}%`;
    return Math.round(val).toLocaleString();
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl border p-5 transition-all duration-300', colors.bg, colors.border, isAnimating && 'scale-[1.02] shadow-lg', 'hover:shadow-md')}>
      {isLive && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', colors.pulse)} />
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', colors.pulse)} />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Live</span>
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-black/20', colors.icon)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-2xl font-bold tabular-nums tracking-tight', colors.text, isAnimating && 'text-primary')}>
              {formatValue(displayValue)}
            </span>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

interface LiveMetricsPanelProps { className?: string; showConnectionStatus?: boolean; compact?: boolean }

export function LiveMetricsPanel({ className, showConnectionStatus = true, compact = false }: LiveMetricsPanelProps) {
  const { metrics, isLoading, isError, error, lastUpdate, refresh } = useLiveMetrics();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'polling'>('polling');

  useEffect(() => {
    if (!lastUpdate) { setConnectionStatus('polling'); return; }
    const timeSinceUpdate = Date.now() - lastUpdate.getTime();
    setConnectionStatus(timeSinceUpdate < 35000 ? 'connected' : 'polling');
  }, [lastUpdate]);

  if (isError) {
    return (
      <div className={cn('rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30', className)}>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <WifiOff className="h-5 w-5" />
          <div>
            <p className="font-medium">Connection Error</p>
            <p className="text-sm text-red-600/80">{error?.message || 'Failed to load live metrics'}</p>
          </div>
        </div>
        <button onClick={() => refresh()} className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Retry</button>
      </div>
    );
  }

  const metricCards = compact ? [
    { title: 'Active Runs', value: metrics.activeRuns, icon: <Activity className="h-5 w-5" />, color: 'blue' as const, subtitle: 'Currently open' },
    { title: 'Completed', value: metrics.completedToday, icon: <CheckCircle2 className="h-5 w-5" />, color: 'green' as const, subtitle: 'Today' },
    { title: 'Avg Score', value: metrics.avgScoreToday, icon: <TrendingUp className="h-5 w-5" />, color: 'purple' as const, subtitle: 'Today' },
  ] : [
    { title: 'Active Runs', value: metrics.activeRuns, icon: <Activity className="h-5 w-5" />, color: 'blue' as const, subtitle: 'Currently open SOP runs' },
    { title: 'Completed Today', value: metrics.completedToday, icon: <CheckCircle2 className="h-5 w-5" />, color: 'green' as const, subtitle: 'Runs closed today' },
    { title: 'Average Score', value: metrics.avgScoreToday, icon: <TrendingUp className="h-5 w-5" />, color: 'purple' as const, subtitle: "Today's combined score" },
    { title: 'Active Users', value: metrics.activeUsers, icon: <Users className="h-5 w-5" />, color: 'amber' as const, subtitle: 'Active in last hour' },
    { title: 'Pending Items', value: metrics.pendingItems, icon: <ListTodo className="h-5 w-5" />, color: 'rose' as const, subtitle: 'Awaiting completion' },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live Metrics</h3>
        </div>
        {showConnectionStatus && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {connectionStatus === 'connected' ? (
                <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-xs font-medium text-green-600">Connected</span></>
              ) : (
                <><Clock className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs font-medium text-amber-600">Polling</span></>
              )}
            </div>
            {lastUpdate && <span className="text-xs text-muted-foreground">Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>}
          </div>
        )}
      </div>
      <div className={cn('grid gap-4', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
        {metricCards.map((card) => <MetricCard key={card.title} {...card} isLive={connectionStatus === 'connected'} />)}
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}

export default LiveMetricsPanel;
