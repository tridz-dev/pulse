import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ScoreSnapshot, User, ComplianceScoreResponse } from '@/types';
import { getTeamScores } from '@/services/scores';
import { getRunsForEmployee } from '@/services/tasks';
import type { RunListItem } from '@/services/tasks';
import { getOperationsOverview, getComplianceScore } from '@/services/operations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Target,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { Ledger } from '@/components/ui/ledger';
import { Meter } from '@/components/ui/meter';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';
import { scoreStatus, scoreTextClass, scoreBgClass, formatScore } from '@/lib/score';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A date that falls inside the immediately preceding period, for a real trend comparison. */
function getPreviousPeriodDateISO(periodType: 'Day' | 'Week' | 'Month'): string {
  const d = new Date();
  if (periodType === 'Day') d.setDate(d.getDate() - 1);
  else if (periodType === 'Week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  pass: 'EXCEPTIONAL',
  risk: 'STABLE',
  fail: 'CRITICAL',
  none: 'NO DATA',
};

export function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [periodType, setPeriodType] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [personalScore, setPersonalScore] = useState<ComplianceScoreResponse | null>(null);
  const [inheritedScore, setInheritedScore] = useState<ComplianceScoreResponse | null>(null);
  const [prevInheritedScore, setPrevInheritedScore] = useState<ComplianceScoreResponse | null>(null);
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

        const prevDate = getPreviousPeriodDateISO(periodType);
        const [personal, inherited, prevInherited] = await Promise.all([
          getComplianceScore(userId, 'personal', today, periodType),
          getComplianceScore(userId, 'inherited', today, periodType),
          getComplianceScore(userId, 'inherited', prevDate, periodType),
        ]);
        setPersonalScore(personal);
        setInheritedScore(inherited);
        setPrevInheritedScore(prevInherited);

        // NOTE: getTeamScores remains on the legacy path here. It is used only
        // to render the per-subordinate bar chart below (name + score per
        // direct report), which getComplianceScore cannot provide in a single
        // call. The summary "Direct Reports" percentage card no longer uses
        // this legacy team_score value; it now uses the compliant inherited
        // score instead.
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
        <div className="h-10 w-48 bg-slab" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-96 md:col-span-2 bg-slab" />
          <div className="h-96 bg-slab" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <h3 className="text-xl text-text">User not found</h3>
        <Button onClick={() => navigate('/operations')} className="mt-4">
          Back to Operations
        </Button>
      </div>
    );
  }

  // Contract: zero eligible runs returns score: null, not zero. Do not
  // collapse null to 0 anywhere below — it must reach <Ledger> as null so it
  // can render its distinct "no data" state.
  const inheritedPct = inheritedScore?.score != null ? Math.round(inheritedScore.score * 100) : null;
  const prevInheritedPct = prevInheritedScore?.score != null ? Math.round(prevInheritedScore.score * 100) : null;
  const trendDelta = inheritedPct != null && prevInheritedPct != null ? inheritedPct - prevInheritedPct : null;
  const personalPct = personalScore?.score != null ? Math.round(personalScore.score * 100) : null;
  const passedRuns = personalScore?.passed_runs ?? 0;
  const eligibleRuns = personalScore?.eligible_runs ?? 0;
  const combinedStatus = scoreStatus(inheritedPct);

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
          className="w-fit text-mute hover:text-text -ml-2"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Operations
        </Button>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-rule">
            <AvatarImage src={user.avatarUrl} />
            <AvatarFallback className="bg-slab-2 text-text">{user.name?.charAt(0) ?? '?'}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h1 className="text-3xl font-semibold tracking-tight text-text">{user.name}</h1>
            <p className="text-mute font-mono text-sm uppercase tracking-wider">
              {user.role} {user.branch ? `• ${user.branch}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-slab-2 p-1 border border-rule">
            {(['Day', 'Week', 'Month'] as const).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => setPeriodType(p)}
                className={cn(
                  'h-8 px-3 text-xs font-medium transition-all',
                  periodType === p ? 'bg-slab text-text' : 'text-mute hover:text-text hover:bg-slab/50'
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
          className="bg-slab border-rule md:col-span-2 p-8 relative overflow-hidden flex items-center gap-12 group hover:border-rule-2 transition-all cursor-pointer"
          onClick={() => setIsBreakdownOpen(true)}
        >
          <Ledger value={inheritedPct} label={`${periodType} KPI`} />
          <div className="flex flex-col justify-center gap-6 flex-1">
            <div>
              <h2 className="text-2xl font-bold text-text tracking-tight">Performance Profile</h2>
              <p className="text-sm text-mute mt-2 max-w-sm leading-relaxed">
                Holistic view of {user.name}&apos;s operational execution, factoring in both own tasks and team
                responsibilities.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
                  Execution Trend
                </span>
                {trendDelta === null ? (
                  <span className="text-sm font-bold font-mono text-faint mt-1">—</span>
                ) : (
                  <div className={cn('flex items-center gap-1.5 mt-1', trendDelta > 0 ? 'text-pass' : trendDelta < 0 ? 'text-fail' : 'text-mute')}>
                    {trendDelta > 0 ? <TrendingUp size={16} /> : trendDelta < 0 ? <TrendingDown size={16} /> : null}
                    <span className="text-sm font-bold font-mono">
                      {trendDelta > 0 ? '+' : ''}
                      {trendDelta}%
                    </span>
                  </div>
                )}
              </div>
              <div className="w-px h-8 bg-rule" />
              <div className="flex flex-col">
                <span className="text-[10px] text-mute font-mono uppercase tracking-widest font-bold">
                  Health Status
                </span>
                <span className={cn('text-sm font-bold mt-1', scoreTextClass(inheritedPct))}>
                  {STATUS_LABEL[combinedStatus]}
                </span>
              </div>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card
            className="bg-slab border-rule flex-1 cursor-pointer hover:border-rule-2 transition-all"
            onClick={() => setIsBreakdownOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-mute uppercase tracking-wider">
                Personal KPI
              </CardTitle>
              <Target className="h-4 w-4 text-mute" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-lg font-mono font-semibold text-mute">{formatScore(personalPct)}</div>
              {eligibleRuns > 0 && (
                <Meter
                  size="sm"
                  className="w-full"
                  segments={[
                    { value: passedRuns, className: scoreBgClass(personalPct, eligibleRuns) },
                    { value: eligibleRuns - passedRuns, className: 'bg-slab-2' },
                  ]}
                />
              )}
              <p className="text-[10px] text-mute mt-1 font-mono uppercase">
                {passedRuns} / {eligibleRuns} Runs
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slab border-rule flex-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-mute uppercase tracking-wider">
                {teamData.length > 0 ? 'Direct Reports' : 'Active Checklists'}
              </CardTitle>
              {teamData.length > 0 ? (
                <Users className="h-4 w-4 text-mute" />
              ) : (
                <Activity className="h-4 w-4 text-mute" />
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-lg font-mono font-semibold text-mute">
                {teamData.length > 0 ? formatScore(inheritedPct) : recentRuns.length}
              </div>
              {teamData.length > 0 && (
                <Meter
                  size="sm"
                  className="w-full"
                  segments={[
                    {
                      value: Math.max(0, Math.min(100, inheritedPct ?? 0)),
                      className: scoreBgClass(inheritedPct, 100),
                    },
                    {
                      value: 100 - Math.max(0, Math.min(100, inheritedPct ?? 0)),
                      className: 'bg-slab-2',
                    },
                  ]}
                />
              )}
              <p className="text-[10px] text-mute mt-1 font-mono uppercase">
                {teamData.length > 0 ? 'Team-Inclusive Score' : "Today's Schedule"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {teamData.length > 0 && (
        <Card className="bg-slab border-rule">
          <CardHeader>
            <CardTitle className="text-base text-text">Management Scope: Team Performance</CardTitle>
            <CardDescription className="text-xs">
              Direct reports performance for {periodType.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rule)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--mute)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--mute)', fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: 'var(--slab-2)' }}
                  contentStyle={{
                    backgroundColor: 'var(--slab)',
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                  }}
                />
                <Bar dataKey="score" radius={[0, 0, 0, 0]} barSize={40}>
                  {barChartData.map((entry, index) => {
                    const status = scoreStatus(entry.score, 100);
                    const color =
                      status === 'pass'
                        ? 'var(--pass)'
                        : status === 'risk'
                          ? 'var(--risk)'
                          : status === 'fail'
                            ? 'var(--fail)'
                            : 'var(--mute)';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {(user.systemRole === 'Pulse User' || user.systemRole === 'Pulse Manager') && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Activity size={18} className="text-mute" />
            <h4 className="text-lg font-medium text-text">Operational Checklists (Today)</h4>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {recentRuns.map((run) => {
              const template = run.template as { title?: string; department?: string } | undefined;
              return (
                <Card
                  key={run.name}
                  className="bg-slab-2/40 border-rule p-5 group hover:border-rule-2 transition-all cursor-pointer"
                  onClick={() => setIsBreakdownOpen(true)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-text">
                        {template?.title ?? (typeof run.template === 'string' ? run.template : '—')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-rule text-mute uppercase px-1"
                        >
                          {template?.department ?? '—'}
                        </Badge>
                        <Badge
                          className={cn(
                            'text-[9px] uppercase px-1.5 py-0.5',
                            run.status === 'Closed'
                              ? 'bg-pass/10 text-pass border-pass/20'
                              : 'bg-risk/10 text-risk border-risk/20'
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
                        className="h-7 px-2 text-[10px] bg-fail/5 border-fail/20 text-fail hover:bg-fail/10"
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
                    <div className="h-2 flex-1 bg-slab-2 overflow-hidden">
                      <div
                        className="h-full bg-mute transition-all duration-700"
                        style={{ width: `${run.progress ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-mute">{Math.round(run.progress ?? 0)}%</span>
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
