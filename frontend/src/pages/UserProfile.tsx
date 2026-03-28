import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ScoreSnapshot, User } from '@/types';
import { getScoreForUser, getTeamScores } from '@/services/scores';
import { getRunsForEmployee } from '@/services/tasks';
import type { RunListItem } from '@/services/tasks';
import { getOperationsOverview } from '@/services/operations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Target,
  Users,
  Activity,
  TrendingUp,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { Gauge } from '@/components/shared/Gauge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [score, setScore] = useState<ScoreSnapshot | null>(null);
  const [teamData, setTeamData] = useState<(ScoreSnapshot & { user: User })[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      if (!userId) return;
      setIsLoading(true);
      const today = todayISO();
      try {
        const overview = await getOperationsOverview(userId, today, periodType);
        if (overview?.user) setUser(overview.user as User);

        const profileScore = await getScoreForUser(userId, today, periodType);
        setScore(profileScore);

        const team = await getTeamScores(userId, today, periodType);
        setTeamData(team as (ScoreSnapshot & { user: User })[]);

        const runs = await getRunsForEmployee(userId, today);
        setRecentRuns(runs);
      } catch (error) {
        console.error('Failed to load user profile', error);
      }
      setIsLoading(false);
    }
    loadUserData();
  }, [userId, periodType]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-10 w-48 bg-zinc-900 rounded-lg" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-96 md:col-span-2 bg-zinc-900 rounded-xl" />
          <div className="h-96 bg-zinc-900 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <h3 className="text-xl text-white">User not found</h3>
        <Button onClick={() => navigate('/operations')} className="mt-4">
          Back to Operations
        </Button>
      </div>
    );
  }

  const combinedScore = score?.combined_score ?? 0;
  const ownScore = score?.own_score ?? 0;
  const teamScore = score?.team_score ?? 0;
  const totalItems = score?.total_items ?? 0;
  const completedItems = score?.completed_items ?? 0;

  const combinedPct = Math.round(combinedScore * 100);
  const ownPct = Math.round(ownScore * 100);

  const barChartData = teamData.map((t) => ({
    name: t.user?.name?.split(' ')[0] ?? '',
    score: Math.round((t.combined_score ?? 0) * 100),
  }));

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/operations')}
          className="w-fit text-zinc-500 hover:text-white -ml-2"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Operations
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border border-zinc-800 shrink-0">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback className="bg-indigo-900 text-indigo-100">{user.name?.charAt(0) ?? '?'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white truncate">{user.name}</h1>
              <p className="text-zinc-400 font-mono text-xs sm:text-sm uppercase tracking-wider truncate">
                {user.role} {user.branch ? `• ${user.branch}` : ''}
              </p>
            </div>
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
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card
          className="bg-[#141415] border-zinc-800 md:col-span-2 p-5 sm:p-8 relative overflow-hidden flex flex-col items-center md:flex-row md:items-center gap-6 md:gap-12 group hover:border-zinc-700/50 transition-all cursor-pointer"
          onClick={() => setIsBreakdownOpen(true)}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <Gauge
            value={combinedPct}
            size={typeof window !== 'undefined' && window.innerWidth < 768 ? 160 : 220}
            label={`${periodType} KPI`}
            mode="gradient"
            showTicks
            showGlow
          />
          <div className="flex flex-col justify-center gap-4 sm:gap-6 flex-1 w-full">
            <div className="text-center md:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Performance Profile</h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-2 max-w-sm leading-relaxed mx-auto md:mx-0">
                Holistic view of {user.name}&apos;s operational execution, factoring in both own tasks and team
                responsibilities.
              </p>
            </div>
            <div className="flex items-center justify-center md:justify-start gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                  Execution Trend
                </span>
                <div className="flex items-center gap-1.5 text-emerald-400 mt-1">
                  <TrendingUp size={16} />
                  <span className="text-sm font-bold">+14.2%</span>
                </div>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                  Health Status
                </span>
                <span
                  className={cn(
                    'text-sm font-bold mt-1',
                    combinedPct >= 80 ? 'text-emerald-400' : combinedPct >= 50 ? 'text-amber-400' : 'text-rose-400'
                  )}
                >
                  {combinedPct >= 80 ? 'EXCEPTIONAL' : combinedPct >= 50 ? 'STABLE' : 'CRITICAL'}
                </span>
              </div>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card
            className="bg-[#141415] border-zinc-800 flex-1 cursor-pointer hover:border-zinc-700/50 transition-all"
            onClick={() => setIsBreakdownOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Personal KPI
              </CardTitle>
              <Target className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white tracking-tighter">{ownPct}%</div>
              <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase">
                {completedItems} / {totalItems} Items
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[#141415] border-zinc-800 flex-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {teamData.length > 0 ? 'Direct Reports' : 'Active Checklists'}
              </CardTitle>
              {teamData.length > 0 ? (
                <Users className="h-4 w-4 text-zinc-500" />
              ) : (
                <Activity className="h-4 w-4 text-zinc-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white tracking-tighter">
                {teamData.length > 0 ? `${Math.round(teamScore * 100)}%` : recentRuns.length}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase">
                {teamData.length > 0 ? 'Average Score' : "Today's Schedule"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {teamData.length > 0 && (
        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-200">Management Scope: Team Performance</CardTitle>
            <CardDescription className="text-xs">
              Direct reports performance for {periodType.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: 'rgba(39, 39, 42, 0.4)' }}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="score" fill="var(--color-indigo-500)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {(user.systemRole === 'Pulse User' || user.systemRole === 'Pulse Manager') && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Activity size={18} className="text-indigo-400" />
            <h4 className="text-lg font-medium text-zinc-200">Operational Checklists (Today)</h4>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {recentRuns.map((run) => {
              const template = run.template as { title?: string; department?: string } | undefined;
              return (
                <Card
                  key={run.name}
                  className="bg-zinc-900/40 border-zinc-800/60 p-5 group hover:border-zinc-700 transition-all cursor-pointer"
                  onClick={() => setIsBreakdownOpen(true)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-zinc-200">
                        {template?.title ?? (typeof run.template === 'string' ? run.template : '—')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-zinc-700 text-zinc-500 uppercase px-1"
                        >
                          {template?.department ?? '—'}
                        </Badge>
                        <Badge
                          className={cn(
                            'text-[9px] uppercase px-1.5 py-0.5',
                            run.status === 'Closed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          )}
                          variant="outline"
                        >
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                    {run.progress < 100 && run.status === 'Closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] bg-rose-500/5 border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Flag corrective action
                        }}
                      >
                        <AlertCircle size={12} className="mr-1.5" />
                        Flag
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-700"
                        style={{ width: `${run.progress ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{Math.round(run.progress ?? 0)}%</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <ScoreBreakdown
        userId={userId ?? null}
        date={todayISO()}
        periodType={periodType}
        open={isBreakdownOpen}
        onOpenChange={setIsBreakdownOpen}
      />
    </div>
  );
}
