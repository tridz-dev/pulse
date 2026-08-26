import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { getOperationsOverview } from '@/services/operations';
import type { TreeNode } from '@/services/operations';
import { Network, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TreeRow, TreeRowGroup } from '@/components/ui/tree-row';
import { Disclosure } from '@/components/ui/disclosure';
import { scoreStatus } from '@/lib/score';

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
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-rule border-dashed rounded bg-slab">
        <Network size={48} className="text-faint mb-4" />
        <h3 className="text-base font-medium text-text">Access Restricted</h3>
        <p className="text-sm text-mute mt-1 text-center max-w-sm">
          Operations Overview is reserved for Area Managers and Executive Leadership.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">Operations Overview</h1>
          <p className="text-mute text-sm mt-1">Hierarchical roll-up of organizational execution.</p>
        </div>
        <div className="flex items-center gap-1 bg-slab p-1 rounded border border-rule shrink-0 self-start sm:self-center">
          {(['Day', 'Week', 'Month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodType(p)}
              className={
                'h-8 px-3 text-xs font-medium transition-all rounded ' +
                (periodType === p ? 'bg-slab-2 text-text shadow-sm' : 'text-faint hover:text-mute hover:bg-slab-2')
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 mt-4">
          <div className="h-16 bg-slab rounded animate-pulse" />
          <div className="h-16 bg-slab rounded animate-pulse ml-8" />
          <div className="h-16 bg-slab rounded animate-pulse ml-16" />
        </div>
      ) : treeData ? (
        <Disclosure
          className="mt-4"
          defaultOpen={true}
          title={
            <span className="flex items-center gap-2">
              <Trophy size={16} className="text-mute" />
              Organization Health ({periodType})
            </span>
          }
          meta="Select a row to drill down"
        >
          <div className="overflow-x-auto -mx-1.5 -my-1">
            <div className="min-w-[600px]">
              <TreeRowGroup className="border-0 rounded-none">
                <OperationNode
                  node={treeData}
                  level={0}
                  defaultExpanded={true}
                  onUserClick={(u) => navigate(`/operations/${u.id}`)}
                />
              </TreeRowGroup>
            </div>
          </div>
        </Disclosure>
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
  const combinedScore = node.score?.combinedScore ?? 0;
  const totalItems = node.score?.total_items ?? node.score?.totalGeneratedItems ?? 0;
  const completedItems = node.score?.completed_items ?? node.score?.completedItems ?? 0;
  const scorePercentage = Math.round(combinedScore * 100);
  const status = scoreStatus(scorePercentage);

  // Prefer real composition counts (completed vs remaining) when available,
  // falling back to a synthetic 2-segment score split otherwise.
  const meter =
    totalItems > 0
      ? [
          { value: completedItems, className: 'bg-pass' },
          { value: Math.max(totalItems - completedItems, 0), className: 'bg-fail' },
        ]
      : [
          { value: scorePercentage, className: 'bg-pass' },
          { value: 100 - scorePercentage, className: 'bg-fail' },
        ];

  const rowLevel: 0 | 1 = level > 0 ? 1 : 0;

  return (
    <div className="flex flex-col" style={{ marginLeft: level > 1 ? `${(level - 1) * 1.5}rem` : undefined }}>
      <TreeRow
        level={rowLevel}
        name={
          <span className="flex flex-col items-start min-w-0">
            <span className="truncate">{node.user.name}</span>
            <span className="text-[10px] font-normal text-faint truncate">
              {node.user.role} {node.user.branch ? `• ${node.user.branch}` : ''}
            </span>
          </span>
        }
        score={status === 'none' ? null : scorePercentage}
        meter={meter}
        expanded={hasChildren ? isExpanded : undefined}
        onToggle={hasChildren ? () => setIsExpanded(!isExpanded) : undefined}
        onClick={hasChildren ? undefined : () => onUserClick(node.user)}
        onDoubleClick={hasChildren ? () => onUserClick(node.user) : undefined}
      />
      {isExpanded && hasChildren && (
        <div className="flex flex-col">
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
