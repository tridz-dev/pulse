import { useCallback, useEffect, useState } from 'react';
import { listCorrectiveActions, updateCorrectiveAction } from '@/services/correctiveActions';
import type { CorrectiveActionListItem } from '@/services/correctiveActions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TableEmptyState,
  TableFilteredEmptyState,
  TableErrorState,
} from '@/components/ui/table-states';
import { StatusChip } from '@/components/ui/status-chip';
import { PageShell, PageHeader } from '@/components/shared/page-shell';
import { Skeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/store/ToastContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { CheckCircle2 } from 'lucide-react';
import type { StatusChipProps } from '@/components/ui/status-chip';

const STATUS_CHIP_MAP: Record<string, NonNullable<StatusChipProps['status']>> = {
  'Open': 'risk',
  'In Progress': 'risk',
  'Resolved': 'pass',
  'Closed': 'none',
  'Waived': 'waive',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Critical': 'bg-fail/10 text-fail',
  'High': 'bg-risk-bg text-risk',
  'Medium': 'bg-waive-bg text-waive',
  'Low': 'bg-pass/10 text-pass',
};

interface ResolveState {
  caName: string;
  caDescription: string;
  resolution: string;
}

export function CorrectiveActions() {
  const { showToast } = useToast();
  const [actions, setActions] = useState<CorrectiveActionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveState, setResolveState] = useState<ResolveState | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCorrectiveActions(statusFilter || undefined, undefined, page, pageSize);
      setActions(data.items);
      setTotal(data.total);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load corrective actions';
      setError(errorMsg);
      showToast({
        variant: 'fail',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page, pageSize, showToast]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleResolveClick = (action: CorrectiveActionListItem) => {
    if (action.status === 'Resolved' || action.status === 'Closed') {
      return; // Don't allow resolve on already resolved actions
    }
    setResolveState({
      caName: action.name,
      caDescription: action.description,
      resolution: '',
    });
    setResolveDialogOpen(true);
  };

  const handleResolveSubmit = async () => {
    if (!resolveState?.resolution.trim()) {
      showToast({
        variant: 'fail',
        title: 'Validation Error',
        description: 'Resolution text is required.',
      });
      return;
    }

    setIsResolving(true);
    try {
      await updateCorrectiveAction(resolveState.caName, {
        status: 'Resolved',
        resolution: resolveState.resolution,
      });
      showToast({
        variant: 'pass',
        title: 'Success',
        description: 'Corrective action resolved.',
      });
      setResolveDialogOpen(false);
      setResolveState(null);
      await fetchActions();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resolve action';
      showToast({
        variant: 'fail',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setIsResolving(false);
    }
  };

  const formatDescription = (desc: string, maxLen: number = 60) => {
    return desc.length > maxLen ? desc.substring(0, maxLen) + '…' : desc;
  };

  const pageCount = Math.ceil(total / pageSize);
  const hasFilters = statusFilter !== null;
  const showEmptyState = !isLoading && actions.length === 0;
  const showErrorState = error !== null;

  return (
    <PageShell className="pb-10">
      <PageHeader
        title="Corrective Actions"
        subtitle="Review and resolve corrective actions from recent operations."
      />

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap mt-2">
        {['Open', 'In Progress', 'Resolved', 'Closed', 'Waived'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(statusFilter === status ? null : status);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-[0.09em] transition-colors border ${
              statusFilter === status
                ? 'border-sel bg-slab-2 text-text'
                : 'border-rule bg-transparent text-mute hover:text-text hover:bg-slab-2'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Error State */}
      {showErrorState && (
        <TableErrorState
          title="Failed to Load"
          description={error || 'An error occurred while loading corrective actions.'}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchActions()}
            >
              Retry
            </Button>
          }
        />
      )}

      {/* Empty State */}
      {showEmptyState && !showErrorState && (
        hasFilters ? (
          <TableFilteredEmptyState
            title="No Actions Found"
            description={`No corrective actions match the selected filters.`}
          />
        ) : (
          <TableEmptyState
            icon={<CheckCircle2 size={16} />}
            title="All Clear"
            description="No corrective actions at this time. Great work!"
          />
        )
      )}

      {/* Loading State */}
      {isLoading && !showErrorState && (
        <div className="border border-rule rounded-[var(--radius)] bg-slab overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton height="sm" width={70} /></TableCell>
                  <TableCell><Skeleton height="sm" width={50} /></TableCell>
                  <TableCell><Skeleton height="sm" width={40} /></TableCell>
                  <TableCell><Skeleton height="sm" width={35} /></TableCell>
                  <TableCell className="text-right"><Skeleton height="sm" width={30} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Table */}
      {!isLoading && !showEmptyState && !showErrorState && (
        <div className="border border-rule rounded-[var(--radius)] bg-slab overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => {
                const canResolve = !['Resolved', 'Closed', 'Waived'].includes(action.status);
                return (
                  <TableRow key={action.name}>
                    <TableCell className="max-w-[200px] overflow-hidden text-ellipsis">
                      {formatDescription(action.description, 60)}
                    </TableCell>
                    <TableCell>{action.assignedToName || '-'}</TableCell>
                    <TableCell>
                      <StatusChip status={STATUS_CHIP_MAP[action.status] || 'none'}>
                        {action.status}
                      </StatusChip>
                    </TableCell>
                    <TableCell>
                      {action.priority ? (
                        <span className={`inline-flex px-2 py-1 rounded-sm text-xs font-medium ${PRIORITY_COLORS[action.priority] || 'bg-rule text-mute'}`}>
                          {action.priority}
                        </span>
                      ) : (
                        <span className="text-mute">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canResolve ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveClick(action)}
                        >
                          Resolve
                        </Button>
                      ) : (
                        <span className="text-xs text-mute">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !showEmptyState && !showErrorState && pageCount > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-mute">
            Page {page} of {pageCount} ({total} total)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page === pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      <Sheet open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Resolve Corrective Action</SheetTitle>
          </SheetHeader>
          {resolveState && (
            <div className="grid gap-6 py-6">
              <div>
                <label className="text-xs font-semibold text-mute uppercase tracking-[0.09em] block mb-2">
                  Description
                </label>
                <p className="text-sm text-text">{resolveState.caDescription}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-mute uppercase tracking-[0.09em] block mb-2">
                  Resolution <span className="text-fail">*</span>
                </label>
                <textarea
                  value={resolveState.resolution}
                  onChange={(e) =>
                    setResolveState({ ...resolveState, resolution: e.target.value })
                  }
                  placeholder="Describe the resolution taken..."
                  className="w-full px-3 py-2 border border-rule rounded-sm bg-slab text-sm text-text placeholder-mute focus:outline-none focus:border-sel focus:ring-1 focus:ring-sel/50 resize-none h-32"
                />
              </div>
            </div>
          )}
          <SheetFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveSubmit}
              disabled={isResolving || !resolveState?.resolution.trim()}
            >
              {isResolving ? 'Resolving...' : 'Resolve'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
