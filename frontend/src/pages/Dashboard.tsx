import { useEffect, useState } from 'react';
import type { ScoreSnapshot } from '@/types';
import { useAuth } from '@/store/AuthContext';
import { getScoreForUser, getTeamScores, getFailureAnalytics } from '@/services/scores';
import type { TeamScoreItem } from '@/services/scores';
import { getDemoStatus, installDemoData } from '@/services/demo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Users, Activity, Calendar, TrendingUp, Database, Loader2 } from 'lucide-react';
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

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Dashboard() {
  const { currentUser, refetch } = useAuth();
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [score, setScore] = useState<ScoreSnapshot | null>(null);
  const [teamData, setTeamData] = useState<TeamScoreItem[]>([]);
  const [analytics, setAnalytics] = useState<{ id: string; taskName: string; templateName: string; misses: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [demoStatus, setDemoStatus] = useState<{ can_load_demo: boolean; can_clear_demo: boolean; has_demo_data: boolean } | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    getDemoStatus().then(setDemoStatus).catch(() => setDemoStatus(null));
  }, []);

  useEffect(() => {
    async function loadStats() {
      if (!currentUser) return;
      setIsLoading(true);
      const today = todayISO();
      try {
        const userScore = await getScoreForUser(currentUser.id, today, periodType);
        setScore(userScore);

        if (currentUser.systemRole && ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole)) {
          const team = await getTeamScores(currentUser.id, today, periodType);
          setTeamData(team);
          const analyticsData = await getFailureAnalytics(currentUser.id, today);
          setAnalytics(analyticsData.mostMissedTasks ?? []);
        } else {
          setTeamData([]);
          setAnalytics([]);
        }
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
      }
      setIsLoading(false);
    }
    loadStats();
  }, [currentUser, periodType]);

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    try {
      const r = await installDemoData(true);
      if (r?.ok) {
        window.alert(r.message ?? 'Demo data load queued. It will run in the background.');
        refetch();
        getDemoStatus().then(setDemoStatus);
      }
    } catch (e) {
      console.error(e);
      window.alert('Failed to load demo data.');
    }
    setDemoLoading(false);
  };

  if (!currentUser) {
    const canLoad = demoStatus?.can_load_demo && !demoStatus?.has_demo_data;
    return (
      <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Execution Dashboard</h1>
        <Card className="bg-[#141415] border-zinc-800 max-w-xl">
          <CardHeader>
            <CardTitle className="text-lg text-white">No employee record</CardTitle>
            <CardDescription>
              {canLoad
                ? 'Load demo data to create sample users, employees, SOPs, and runs so you can explore the app.'
                : 'Your user is not linked to a PM Employee. Contact your administrator or load demo data if you are an admin.'}
            </CardDescription>
          </CardHeader>
          {canLoad && (
            <CardContent>
              <Button onClick={handleLoadDemo} disabled={demoLoading} className="gap-2">
                {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Load demo data
              </Button>
            </CardContent>
          )}
        </Card>
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
    name: t.user?.name?.split(' ')[0] ?? t.user?.id ?? '',
    score: Math.round((t.combined_score ?? 0) * 100),
    role: t.user?.role,
  }));

  const showLoadDemoCard = demoStatus?.can_load_demo && !demoStatus?.has_demo_data;

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      {showLoadDemoCard && (
        <Card className="bg-amber-950/30 border-amber-800/50">
          <CardContent className="flex flex-row items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-200">No demo data on this site</p>
                <p className="text-xs text-amber-200/70">Load sample users, employees, SOPs and runs to explore the app.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLoadDemo} disabled={demoLoading} className="gap-2 border-amber-700 text-amber-200 hover:bg-amber-900/30">
              {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Load demo data
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Execution Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {currentUser.systemRole === 'Pulse User'
              ? 'Your performance overview.'
              : 'High-level metrics and performance roll-ups.'}
          </p>
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
                periodType === p
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              )}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-zinc-900 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-zinc-900 rounded-xl mt-4" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-[#141415] border-zinc-800 md:col-span-2 p-5 sm:p-8 relative overflow-hidden flex flex-col items-center md:flex-row md:items-center gap-6 md:gap-12 group hover:border-zinc-700/50 transition-all">
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
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Execution Health</h2>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-2 max-w-sm leading-relaxed mx-auto md:mx-0">
                    Your overall performance rating based on {completedItems} completed tasks and team roll-ups for
                    this {periodType.toLowerCase()}.
                  </p>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                      Trend
                    </span>
                    <div className="flex items-center gap-1.5 text-emerald-400 mt-1">
                      <TrendingUp size={16} />
                      <span className="text-sm font-bold">+14.2%</span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">
                      Status
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
              <Card className="bg-[#141415] border-zinc-800 flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Own Execution
                  </CardTitle>
                  <Target className="h-4 w-4 text-zinc-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white tracking-tighter">{ownPct}%</div>
                  <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase">{totalItems} Assigned Tasks</p>
                </CardContent>
              </Card>
              <Card className="bg-[#141415] border-zinc-800 flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {teamData.length > 0 ? 'Team Roll-up' : 'Activity'}
                  </CardTitle>
                  {teamData.length > 0 ? (
                    <Users className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <Activity className="h-4 w-4 text-zinc-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white tracking-tighter">
                    {teamData.length > 0 ? `${Math.round(teamScore * 100)}%` : completedItems}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase">
                    {teamData.length > 0 ? 'Direct Reports Avg' : 'Items Completed'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {teamData.length > 0 && (
            <Card className="bg-[#141415] border-zinc-800 mt-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-zinc-200">Execution by Group</CardTitle>
                  <CardDescription className="text-xs">
                    Performance aggregated for the selected {periodType.toLowerCase()}.
                  </CardDescription>
                </div>
                <Calendar className="h-4 w-4 text-zinc-600" />
              </CardHeader>
              <CardContent className="h-[220px] sm:h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 12 }}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(39, 39, 42, 0.4)' }}
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="score" fill="var(--color-indigo-500)" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {analytics.length > 0 && periodType === 'Day' && (
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base text-zinc-200">Organization-wide Failure Points</CardTitle>
                <CardDescription className="text-xs">
                  Tasks that were missed most frequently across all branches.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 mt-2">
                {analytics.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 transition-all hover:bg-zinc-800/20"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-zinc-200">{item.taskName}</span>
                      <span className="text-xs text-zinc-500">{item.templateName}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-rose-400">{item.misses}</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Misses</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
