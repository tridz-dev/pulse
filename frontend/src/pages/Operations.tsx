import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getOperationsOverview } from '@/services/operations';
import type { TreeNode } from '@/services/operations';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Network, ChevronRight, ChevronDown, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Operations() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOperations() {
      if (!currentUser || currentUser.systemRole === 'Pulse User' || currentUser.systemRole === 'Pulse Manager') {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const data = await getOperationsOverview(currentUser.id, todayISO(), periodType);
      setTreeData(data);
      setIsLoading(false);
    }
    fetchOperations();
  }, [currentUser, periodType]);

  if (!currentUser || ['Pulse User', 'Pulse Manager'].includes(currentUser.systemRole ?? '')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
        <Network size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-base font-medium text-zinc-300">Access Restricted</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
          Operations Overview is reserved for Area Managers and Executive Leadership.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Operations Overview</h1>
          <p className="text-zinc-400 text-sm mt-1">Hierarchical roll-up of organizational execution.</p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 shrink-0 self-start sm:self-center">
          {(['Day', 'Week', 'Month'] as const).map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              onClick={() => setPeriodType(p)}
              className={cn(
                'h-8 px-3 text-xs font-medium transition-all rounded-md',
                periodType === p ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              )}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 mt-4">
          <div className="h-16 bg-zinc-900 rounded-lg animate-pulse" />
          <div className="h-16 bg-zinc-900/80 rounded-lg animate-pulse ml-8" />
          <div className="h-16 bg-zinc-900/60 rounded-lg animate-pulse ml-16" />
        </div>
      ) : treeData ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-[#141415] overflow-hidden">
          <div className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-indigo-400" />
              <span className="text-sm font-medium text-zinc-200">
                Organization Health ({periodType})
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono hidden sm:block">Select a row to drill down</div>
          </div>
          <div className="p-2 overflow-x-hidden">
              <OperationNode
                node={treeData}
                level={0}
                defaultExpanded={true}
                onUserClick={(u) => navigate(`/operations/${u.id}`)}
              />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OperationNode({
  node,
  level,
  defaultExpanded = false,
  onUserClick,
}: {
  node: TreeNode;
  level: number;
  defaultExpanded?: boolean;
  onUserClick: (user: { id: string; name: string; role: string; branch?: string }) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;
  const score = node.score as { combinedScore?: number; combined_score?: number; ownScore?: number; own_score?: number };
  const combinedScore = score?.combinedScore ?? score?.combined_score ?? 0;
  const ownScore = score?.ownScore ?? score?.own_score ?? 0;
  const scorePercentage = Math.round(combinedScore * 100);
  let scoreColor = 'text-zinc-300 bg-zinc-800';
  if (combinedScore >= 0.8) scoreColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  else if (combinedScore >= 0.5) scoreColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  else scoreColor = 'text-rose-400 bg-rose-400/10 border-rose-400/20';

  return (
    <div className="flex flex-col">
      <div
        className={cn('flex items-center p-2 sm:p-3 rounded-lg transition-colors hover:bg-zinc-800/40 relative group cursor-pointer')}
        style={{ paddingLeft: `${Math.max(0.5, level * 1.25)}rem` }}
        onClick={() => onUserClick(node.user)}
      >
        {level > 0 && (
          <div
            className="absolute left-0 top-1/2 w-4 sm:w-6 border-t border-zinc-800 -z-10 group-hover:border-zinc-700 transition-colors pointer-events-none"
            style={{ left: `${(level - 1) * 1.25 + 0.75}rem` }}
          />
        )}
        {level > 0 && (
          <div
            className="absolute top-0 bottom-1/2 border-l border-zinc-800 -z-10 group-hover:border-zinc-700 transition-colors pointer-events-none"
            style={{ left: `${(level - 1) * 1.25 + 0.75}rem` }}
          />
        )}
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0 mr-1 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-md z-10"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          )}
        </div>
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 rounded-md border border-zinc-700 mr-2 sm:mr-3 shrink-0">
          <AvatarImage src={node.user.avatarUrl} />
          <AvatarFallback className="text-xs bg-zinc-800 text-zinc-300 rounded-md">
            {node.user.name?.charAt(0) ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1 pr-2 sm:pr-4">
          <span className="font-medium text-sm text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
            {node.user.name}
          </span>
          <span className="text-[10px] text-zinc-500 truncate">
            {node.user.role} {node.user.branch ? `• ${node.user.branch}` : ''}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-4 pl-2 sm:pl-4 shrink-0">
          <div className="hidden sm:flex flex-col text-right w-20">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Own Score</span>
            <span className="text-xs text-zinc-400 font-mono mt-0.5">{Math.round(ownScore * 100)}%</span>
          </div>
          <div className="w-px h-6 bg-zinc-800 mx-1 hidden sm:block" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold hidden sm:block">Combined KPI</span>
            <div className="flex items-center justify-end gap-2 mt-0 sm:mt-0.5">
              <Badge
                variant="outline"
                className={cn('px-1.5 py-0 border font-mono text-xs shadow-sm shadow-black', scoreColor)}
              >
                {scorePercentage}%
              </Badge>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col relative">
          <div
            className="absolute top-0 bottom-6 border-l border-zinc-800 -z-10 pointer-events-none"
            style={{ left: `${level * 1.25 + 0.75}rem` }}
          />
          {node.children!.map((child) => (
            <OperationNode
              key={child.user.id}
              node={child}
              level={level + 1}
              defaultExpanded={false}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
