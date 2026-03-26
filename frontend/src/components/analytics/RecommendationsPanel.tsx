import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  Target, 
  Users, 
  Clock, 
  BarChart3, 
  Bell, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type Priority = 'high' | 'medium' | 'low';
type IconType = 'target' | 'users' | 'clock' | 'chart' | 'bell';

interface Recommendation {
  id: number;
  priority: Priority;
  icon: IconType;
  title: string;
  description: string;
  impact: string;
  actionable: boolean;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  compact?: boolean;
}

const iconMap: Record<IconType, typeof Lightbulb> = {
  target: Target,
  users: Users,
  clock: Clock,
  chart: BarChart3,
  bell: Bell,
};

const priorityConfig: Record<Priority, { color: string; bg: string; label: string; score: number }> = {
  high: { 
    color: 'text-rose-400', 
    bg: 'bg-rose-500/10', 
    label: 'High Priority',
    score: 3
  },
  medium: { 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10', 
    label: 'Medium',
    score: 2
  },
  low: { 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10', 
    label: 'Low',
    score: 1
  },
};

export function RecommendationsPanel({ recommendations, compact = false }: RecommendationsPanelProps) {
  const [filter, setFilter] = useState<'all' | Priority>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'actionable'>('priority');
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

  const filteredAndSortedRecommendations = useMemo(() => {
    let filtered = filter === 'all' 
      ? recommendations 
      : recommendations.filter(r => r.priority === filter);
    
    if (sortBy === 'priority') {
      filtered = [...filtered].sort((a, b) => 
        priorityConfig[b.priority].score - priorityConfig[a.priority].score
      );
    } else {
      filtered = [...filtered].sort((a, b) => 
        (b.actionable ? 1 : 0) - (a.actionable ? 1 : 0)
      );
    }
    
    return filtered;
  }, [recommendations, filter, sortBy]);

  const handleApply = (id: number) => {
    setAppliedIds(prev => new Set(prev).add(id));
    // In a real app, this would call an API
    setTimeout(() => {
      console.log(`Applied recommendation ${id}`);
    }, 500);
  };

  const stats = useMemo(() => ({
    total: recommendations.length,
    high: recommendations.filter(r => r.priority === 'high').length,
    medium: recommendations.filter(r => r.priority === 'medium').length,
    low: recommendations.filter(r => r.priority === 'low').length,
    actionable: recommendations.filter(r => r.actionable).length,
  }), [recommendations]);

  if (compact) {
    return (
      <Card className="bg-[#141415] border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <CardTitle className="text-sm text-zinc-200">AI Recommendations</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
              {stats.total}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredAndSortedRecommendations.slice(0, 3).map((rec) => {
            const Icon = iconMap[rec.icon];
            const priority = priorityConfig[rec.priority];
            const isApplied = appliedIds.has(rec.id);
            
            return (
              <div 
                key={rec.id}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg border transition-all",
                  "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className={cn("p-1.5 rounded-md flex-shrink-0", priority.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", priority.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{rec.title}</p>
                  <p className="text-[10px] text-zinc-500 line-clamp-1">{rec.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded", priority.bg, priority.color)}>
                      {priority.label}
                    </span>
                    <span className="text-[10px] text-emerald-400">{rec.impact}</span>
                  </div>
                </div>
                {rec.actionable && !isApplied && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                    onClick={() => handleApply(rec.id)}
                  >
                    Apply
                  </Button>
                )}
                {isApplied && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                )}
              </div>
            );
          })}
          
          {filteredAndSortedRecommendations.length === 0 && (
            <div className="text-center py-4 text-zinc-500">
              <Lightbulb className="h-6 w-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">No recommendations</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#141415] border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <CardTitle className="text-base text-zinc-200">AI Recommendations</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Intelligent suggestions to improve performance
            </CardDescription>
          </div>
          
          {/* Stats */}
          <div className="flex gap-2">
            {stats.high > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-rose-500/10 rounded text-xs">
                <span className="text-rose-400 font-medium">{stats.high}</span>
                <span className="text-rose-400/70">High</span>
              </div>
            )}
            {stats.medium > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded text-xs">
                <span className="text-amber-400 font-medium">{stats.medium}</span>
                <span className="text-amber-400/70">Med</span>
              </div>
            )}
            {stats.low > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded text-xs">
                <span className="text-blue-400 font-medium">{stats.low}</span>
                <span className="text-blue-400/70">Low</span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-4">
          <Filter className="h-4 w-4 text-zinc-500" />
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map((f) => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(f)}
                className={cn(
                  'h-7 px-2 text-xs capitalize',
                  filter === f ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {f === 'all' ? 'All' : priorityConfig[f].label}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortBy(sortBy === 'priority' ? 'actionable' : 'priority')}
            className="h-7 px-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {sortBy === 'priority' ? 'Priority' : 'Actionable'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredAndSortedRecommendations.map((rec) => {
            const Icon = iconMap[rec.icon];
            const priority = priorityConfig[rec.priority];
            const isApplied = appliedIds.has(rec.id);
            
            return (
              <div 
                key={rec.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border transition-all",
                  "bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700",
                  isApplied && "opacity-60"
                )}
              >
                <div className={cn("p-2 rounded-lg flex-shrink-0", priority.bg)}>
                  <Icon className={cn("h-5 w-5", priority.color)} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-zinc-200">{rec.title}</h4>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] border-0", priority.bg, priority.color)}
                        >
                          {priority.label}
                        </Badge>
                        {rec.actionable && (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] border-emerald-500/30 text-emerald-400"
                          >
                            Actionable
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{rec.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Expected Impact:</span>
                      <span className="text-xs font-medium text-emerald-400">{rec.impact}</span>
                    </div>
                    
                    {rec.actionable ? (
                      isApplied ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Applied
                        </div>
                      ) : (
                        <Button 
                          size="sm"
                          className="h-7 px-3 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                          onClick={() => handleApply(rec.id)}
                        >
                          Apply
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      )
                    ) : (
                      <Button 
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Learn More
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredAndSortedRecommendations.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No recommendations match your filter</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setFilter('all')}
                className="mt-2 text-indigo-400 hover:text-indigo-300"
              >
                Clear Filter
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
