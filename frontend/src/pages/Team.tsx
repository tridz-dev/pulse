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
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
        <Users size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-base font-medium text-zinc-300">No Direct Reports</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
          Your role does not have team visibility enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Team</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {showAllTeamsTab
              ? 'Your direct reports and organization-wide team view.'
              : 'Operational performance for your direct reports.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showAllTeamsTab && (
            <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('my-team')}
                className={cn(
                  'h-8 px-3 text-xs font-medium',
                  activeTab === 'my-team'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
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
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                All Teams
              </Button>
            </div>
          )}
          <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
            {(['Day', 'Week', 'Month'] as const).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => setPeriodType(p)}
                className={cn(
                  'h-8 px-3 text-xs font-medium',
                  periodType === p ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
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
              <div className="h-10 bg-zinc-900 rounded-lg animate-pulse" />
              <div className="h-40 bg-zinc-900 rounded-lg animate-pulse" />
            </div>
          ) : teamScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 mt-4 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
              <Users size={48} className="text-zinc-600 mb-4" />
              <h3 className="text-base font-medium text-zinc-300">No Team Members</h3>
              <p className="text-sm text-zinc-500 mt-1">You don&apos;t have any active direct reports.</p>
            </div>
          ) : (
            {/* Mobile card view */}
            <div className="mt-4 flex flex-col gap-3 md:hidden">
              {teamScores.map((member) => (
                <div
                  key={member.employee}
                  className="p-4 rounded-lg border border-zinc-800 bg-[#18181b] hover:bg-zinc-800/30 transition-colors cursor-pointer active:bg-zinc-800/50"
                  onClick={() => navigate(`/operations/${member.employee}`)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-300 shrink-0">
                      {member.user?.name?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-zinc-200 text-sm truncate">
                        {member.user?.name ?? member.employee}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {member.user?.role ?? '—'} • {member.completed_items}/{member.total_items} items
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {member.combined_score < 0.5 && <TrendingDown size={14} className="text-rose-500" />}
                      {member.combined_score >= 0.8 && <Target size={14} className="text-emerald-500" />}
                      <ScoreDisplay score={member.combined_score} highlight />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase">Own</span>
                      <ScoreDisplay score={member.own_score} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase">Team</span>
                      <ScoreDisplay score={member.team_score} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="mt-4 rounded-md border border-zinc-800 bg-[#18181b] overflow-hidden hidden md:block">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 font-medium h-10 w-[250px]">Team Member</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Role</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Own Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Team Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Operational</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamScores.map((member) => (
                    <TableRow
                      key={member.employee}
                      className="border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/operations/${member.employee}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-300">
                            {member.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-200 text-sm">
                              {member.user?.name ?? member.employee}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {member.completed_items} / {member.total_items} checklist items
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-zinc-400 border-zinc-700 bg-zinc-900 font-mono text-[10px] uppercase"
                        >
                          {member.user?.role ?? member.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.own_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.team_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.combined_score < 0.5 && <TrendingDown size={14} className="text-rose-500" />}
                          {member.combined_score >= 0.8 && <Target size={14} className="text-emerald-500" />}
                          <ScoreDisplay score={member.combined_score} highlight />
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
              <div className="h-10 bg-zinc-900 rounded-lg animate-pulse" />
              <div className="h-40 bg-zinc-900 rounded-lg animate-pulse" />
            </div>
          ) : allTeamScores.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 mt-4 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
              <UsersRound size={48} className="text-zinc-600 mb-4" />
              <h3 className="text-base font-medium text-zinc-300">No Team Data</h3>
              <p className="text-sm text-zinc-500 mt-1">No employees in scope for this period.</p>
            </div>
          ) : (
            {/* Mobile card view */}
            <div className="mt-4 flex flex-col gap-3 md:hidden">
              {allTeamScores.map((member) => (
                <div
                  key={member.employee}
                  className="p-4 rounded-lg border border-zinc-800 bg-[#18181b] hover:bg-zinc-800/30 transition-colors cursor-pointer active:bg-zinc-800/50"
                  onClick={() => navigate(`/operations/${member.employee}`)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-300 shrink-0">
                      {member.user?.name?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-zinc-200 text-sm truncate">
                        {member.user?.name ?? member.employee}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {member.user?.role ?? '—'} • {member.department ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {member.combined_score < 0.5 && <TrendingDown size={14} className="text-rose-500" />}
                      {member.combined_score >= 0.8 && <Target size={14} className="text-emerald-500" />}
                      <ScoreDisplay score={member.combined_score} highlight />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase">Own</span>
                      <ScoreDisplay score={member.own_score} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase">Team</span>
                      <ScoreDisplay score={member.team_score} />
                    </div>
                    {member.user?.branch && (
                      <span className="text-[10px] text-zinc-500 ml-auto">{member.user.branch}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="mt-4 rounded-md border border-zinc-800 bg-[#18181b] overflow-hidden hidden md:block">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 font-medium h-10 w-[220px]">Name</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Role</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Department</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10">Branch</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Own Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Team Score</TableHead>
                    <TableHead className="text-zinc-400 font-medium h-10 text-right">Combined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTeamScores.map((member) => (
                    <TableRow
                      key={member.employee}
                      className="border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/operations/${member.employee}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center text-xs text-zinc-300">
                            {member.user?.name?.charAt(0) ?? '?'}
                          </div>
                          <span className="font-medium text-zinc-200 text-sm">
                            {member.user?.name ?? member.employee}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-zinc-400 border-zinc-700 bg-zinc-900 font-mono text-[10px] uppercase"
                        >
                          {member.user?.role ?? member.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-zinc-400 text-sm">
                        {member.department ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-zinc-400 text-sm">
                        {member.user?.branch ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.own_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ScoreDisplay score={member.team_score} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.combined_score < 0.5 && <TrendingDown size={14} className="text-rose-500" />}
                          {member.combined_score >= 0.8 && <Target size={14} className="text-emerald-500" />}
                          <ScoreDisplay score={member.combined_score} highlight />
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

function ScoreDisplay({ score, highlight = false }: { score: number; highlight?: boolean }) {
  const percentage = Math.round(score * 100);
  let color = 'text-zinc-300';
  if (highlight) {
    if (score >= 0.8) color = 'text-emerald-400 font-bold';
    else if (score >= 0.5) color = 'text-amber-400 font-medium';
    else color = 'text-rose-400 font-medium';
  } else {
    if (score >= 0.8) color = 'text-emerald-500/80';
    else if (score >= 0.5) color = 'text-amber-500/80';
    else color = 'text-rose-500/80';
  }
  return <span className={color}>{percentage}%</span>;
}
