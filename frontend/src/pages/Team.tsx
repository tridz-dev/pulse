import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { getTeamScores, getAllTeamScores } from '@/services/scores';
import type { TeamScoreItem, AllTeamScoreItem } from '@/services/scores';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/ui/meter';
import { formatScore, scoreTextClass } from '@/lib/score';
import { Users, TrendingDown, Target, UsersRound } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type TabId = 'my-team' | 'all-teams';

export function Team() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('my-team');
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [teamScores, setTeamScores] = useState<TeamScoreItem[]>([]);
  const [allTeamScores, setAllTeamScores] = useState<AllTeamScoreItem[]>([]);
  const [isLoadingMyTeam, setIsLoadingMyTeam] = useState(true);
  const [isLoadingAllTeams, setIsLoadingAllTeams] = useState(false);

  const showAllTeamsTab =
    currentUser && currentUser.systemRole && ['Pulse Executive', 'Pulse Leader'].includes(currentUser.systemRole);

  useEffect(() => {
    async function fetchMyTeam() {
      if (!currentUser || currentUser.systemRole === 'Pulse User') {
        setIsLoadingMyTeam(false);
        return;
      }
      setIsLoadingMyTeam(true);
      const data = await getTeamScores(currentUser.id, todayISO(), periodType);
      setTeamScores(data);
      setIsLoadingMyTeam(false);
    }
    fetchMyTeam();
  }, [currentUser, periodType]);

  useEffect(() => {
    if (!showAllTeamsTab || activeTab !== 'all-teams') return;
    async function fetchAllTeams() {
      if (!currentUser) return;
      setIsLoadingAllTeams(true);
      const data = await getAllTeamScores(currentUser.id, todayISO(), periodType);
      setAllTeamScores(data);
      setIsLoadingAllTeams(false);
    }
    fetchAllTeams();
  }, [currentUser, periodType, activeTab, showAllTeamsTab]);

  if (currentUser?.systemRole === 'Pulse User') {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-rule border-dashed bg-slab">
        <Users size={48} className="text-faint mb-4" />
        <h3 className="text-base font-medium text-text">No Direct Reports</h3>
        <p className="text-sm text-mute mt-1 text-center max-w-sm">
          Your role does not have team visibility enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">Team</h1>
          <p className="text-mute text-sm mt-1">
            {showAllTeamsTab
              ? 'Your direct reports and organization-wide team view.'
              : 'Operational performance for your direct reports.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showAllTeamsTab && (
            <div className="flex gap-1 bg-slab-2 p-1 border border-rule">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('my-team')}
                className={cn(
                  'h-8 px-3 text-xs font-medium',
                  activeTab === 'my-team'
                    ? 'bg-sel text-sel'
                    : 'text-mute hover:text-text'
                )}
              >
                My Team
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('all-teams')}
                className={cn(
                  'h-8 px-3 text-xs font-medium',
                  activeTab === 'all-teams'
                    ? 'bg-sel text-sel'
                    : 'text-mute hover:text-text'
                )}
              >
                All Teams
              </Button>
            </div>
          )}
          <div className="flex gap-1 bg-slab-2 p-1 border border-rule">
            {(['Day', 'Week', 'Month'] as const).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => setPeriodType(p)}
                className={cn(
                  'h-8 px-3 text-xs font-medium',
                  periodType === p ? 'bg-sel text-sel' : 'text-mute hover:text-text'
                )}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'my-team' && (
        <>
          {isLoadingMyTeam ? (
            <div className="space-y-4 mt-4">
              <div className="h-10 bg-slab-2 animate-pulse" />
              <div className="h-40 bg-slab-2 animate-pulse" />
            </div>
          ) : teamScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 mt-4 border border-rule border-dashed bg-slab">
              <Users size={48} className="text-faint mb-4" />
              <h3 className="text-base font-medium text-text">No Team Members</h3>
              <p className="text-sm text-mute mt-1">You don&apos;t have any active direct reports.</p>
            </div>
          ) : (
            <div className="mt-4 border border-rule bg-slab overflow-hidden">
              <Table>
                <TableHeader className="bg-slab-2">
                  <TableRow className="border-rule hover:bg-transparent">
                    <TableHead className="text-mute font-medium h-10 w-[250px]">Team Member</TableHead>
                    <TableHead className="text-mute font-medium h-10">Role</TableHead>
                    <TableHead className="text-mute font-medium h-10 text-right">Own Score</TableHead>
                    <TableHead className="text-mute font-medium h-10 text-right">Team Score</TableHead>
                    <TableHead className="text-mute font-medium h-10 text-right">Operational</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamScores.map((member) => (
                    <TableRow
                      key={member.employee}
                      className="border-rule hover:bg-slab-2/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/operations/${member.employee}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 border border-rule-2 bg-slab-2 flex items-center justify-center text-xs text-text">
                            {member.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-sans font-medium text-text text-sm">
                              {member.user?.name ?? member.employee}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-mute">
                                {member.completed_items} / {member.total_items} checklist items
                              </span>
                              {member.total_items > 0 && (
                                <Meter
                                  size="sm"
                                  className="w-16"
                                  segments={[
                                    { value: member.completed_items, className: 'bg-pass' },
                                    {
                                      value: member.total_items - member.completed_items,
                                      className: 'bg-slab-2',
                                    },
                                  ]}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-mute border-rule-2 bg-slab-2 font-mono text-[10px] uppercase"
                        >
                          {member.user?.role ?? member.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.own_score} total={member.total_items} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.team_score} total={member.total_items} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.total_items > 0 && member.combined_score < 0.5 && (
                            <TrendingDown size={14} className="text-fail" />
                          )}
                          {member.total_items > 0 && member.combined_score >= 0.8 && (
                            <Target size={14} className="text-pass" />
                          )}
                          <ScoreDisplay score={member.combined_score} total={member.total_items} highlight />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {activeTab === 'all-teams' && showAllTeamsTab && (
        <>
          {isLoadingAllTeams ? (
            <div className="space-y-4 mt-4">
              <div className="h-10 bg-slab-2 animate-pulse" />
              <div className="h-40 bg-slab-2 animate-pulse" />
            </div>
          ) : allTeamScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 mt-4 border border-rule border-dashed bg-slab">
              <UsersRound size={48} className="text-faint mb-4" />
              <h3 className="text-base font-medium text-text">No Team Data</h3>
              <p className="text-sm text-mute mt-1">No employees in scope for this period.</p>
            </div>
          ) : (
            <div className="mt-4 border border-rule bg-slab overflow-hidden">
              <Table>
                <TableHeader className="bg-slab-2">
                  <TableRow className="border-rule hover:bg-transparent">
                    <TableHead className="text-mute font-medium h-10 w-[220px]">Name</TableHead>
                    <TableHead className="text-mute font-medium h-10">Role</TableHead>
                    <TableHead className="text-mute font-medium h-10">Department</TableHead>
                    <TableHead className="text-mute font-medium h-10">Branch</TableHead>
                    <TableHead className="text-mute font-medium h-10 text-right">Own Score</TableHead>
                    <TableHead className="text-mute font-medium h-10 text-right">Team Score</TableHead>
                    <TableHead className="text-mute font-medium h-10 text-right">Combined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTeamScores.map((member) => (
                    <TableRow
                      key={member.employee}
                      className="border-rule hover:bg-slab-2/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/operations/${member.employee}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 border border-rule-2 bg-slab-2 flex items-center justify-center text-xs text-text">
                            {member.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <span className="font-sans font-medium text-text text-sm">
                            {member.user?.name ?? member.employee}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-mute border-rule-2 bg-slab-2 font-mono text-[10px] uppercase"
                        >
                          {member.user?.role ?? member.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-mute text-sm">
                        {member.department ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-mute text-sm">
                        {member.user?.branch ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.own_score} total={member.total_items} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.team_score} total={member.total_items} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.total_items > 0 && member.combined_score < 0.5 && (
                            <TrendingDown size={14} className="text-fail" />
                          )}
                          {member.total_items > 0 && member.combined_score >= 0.8 && (
                            <Target size={14} className="text-pass" />
                          )}
                          <ScoreDisplay score={member.combined_score} total={member.total_items} highlight />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScoreDisplay({
  score,
  total,
  highlight = false,
}: {
  score: number | null | undefined;
  total?: number;
  highlight?: boolean;
}) {
  const pct = score == null ? null : score * 100;
  return (
    <span className={cn(scoreTextClass(pct, total), highlight && 'font-semibold')}>
      {formatScore(pct, total)}
    </span>
  );
}
