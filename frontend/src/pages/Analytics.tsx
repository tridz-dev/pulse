import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { pulseQueryKeys } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, Brain, AlertTriangle, BarChart3, ChartLine } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnomalyDetectionCard } from '@/components/analytics/AnomalyDetectionCard';
import { PerformancePredictionCard } from '@/components/analytics/PerformancePredictionCard';
import { RecommendationsPanel } from '@/components/analytics/RecommendationsPanel';
import { ComplianceHeatmap } from '@/components/analytics/ComplianceHeatmap';
import { TrendChart } from '@/components/analytics/TrendChart';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Mock data generators for AI analytics
type AnomalyType = 'critical' | 'warning' | 'info';
type Severity = 'high' | 'medium' | 'low';

interface MockAnomaly {
  id: number;
  type: AnomalyType;
  title: string;
  description: string;
  timestamp: string;
  severity: Severity;
  runId: string;
}

const generateMockAnomalies = (): MockAnomaly[] => [
  { id: 1, type: 'critical', title: 'Critical SOP Deviation', description: 'Kitchen closing checklist missed 3 times', timestamp: '2024-03-25T14:30:00', severity: 'high', runId: 'RUN-001' },
  { id: 2, type: 'warning', title: 'Compliance Drop', description: 'Safety inspection scores dropped 15%', timestamp: '2024-03-24T09:15:00', severity: 'medium', runId: 'RUN-002' },
  { id: 3, type: 'info', title: 'Unusual Pattern', description: 'Inventory checks happening off-schedule', timestamp: '2024-03-23T16:45:00', severity: 'low', runId: 'RUN-003' },
  { id: 4, type: 'warning', title: 'Repeated Failure', description: 'Opening procedure failed 2 days in a row', timestamp: '2024-03-22T08:00:00', severity: 'medium', runId: 'RUN-004' },
  { id: 5, type: 'critical', title: 'Quality Control Issue', description: 'Product quality checks below threshold', timestamp: '2024-03-21T11:20:00', severity: 'high', runId: 'RUN-005' },
];

const generateMockPredictions = (days: number) => {
  const baseScore = 82;
  const predictions = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const trend = Math.sin(i * 0.2) * 5;
    const noise = (Math.random() - 0.5) * 3;
    const score = Math.min(100, Math.max(60, baseScore + trend + noise + i * 0.1));
    predictions.push({
      date: date.toISOString().slice(0, 10),
      score: Math.round(score),
      lower: Math.round(score - 8),
      upper: Math.round(score + 5),
    });
  }
  return predictions;
};

type Priority = 'high' | 'medium' | 'low';
type IconType = 'target' | 'users' | 'clock' | 'chart' | 'bell';

interface MockRecommendation {
  id: number;
  priority: Priority;
  icon: IconType;
  title: string;
  description: string;
  impact: string;
  actionable: boolean;
}

const generateMockRecommendations = (): MockRecommendation[] => [
  { id: 1, priority: 'high', icon: 'target', title: 'Optimize Morning Checklist', description: 'Reduce completion time by 15 minutes through task reordering', impact: '+12% efficiency', actionable: true },
  { id: 2, priority: 'high', icon: 'users', title: 'Schedule Additional Training', description: '3 employees need safety protocol refresher', impact: '-25% incidents', actionable: true },
  { id: 3, priority: 'medium', icon: 'clock', title: 'Adjust Shift Handover', description: 'Move handover 30 minutes earlier to reduce overlap', impact: '+8% productivity', actionable: true },
  { id: 4, priority: 'medium', icon: 'chart', title: 'Implement Quality Checks', description: 'Add mid-shift quality verification steps', impact: '+5% compliance', actionable: false },
  { id: 5, priority: 'low', icon: 'bell', title: 'Review Alert Thresholds', description: 'Current thresholds may be too sensitive', impact: '-20% false alerts', actionable: true },
];

const generateMockComplianceData = (days: number) => {
  const data = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const baseScore = 75 + Math.random() * 20;
    const dayOfWeek = date.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.9 : 1;
    data.push({
      date: date.toISOString().slice(0, 10),
      score: Math.round(baseScore * weekendFactor),
      completed: Math.floor(Math.random() * 20) + 10,
      total: 25,
    });
  }
  return data;
};

const generateMockTrendData = () => {
  const actual = [];
  const predicted = [];
  const today = new Date();
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const score = 70 + Math.sin(i * 0.3) * 15 + Math.random() * 5;
    actual.push({
      date: date.toISOString().slice(0, 10),
      score: Math.round(score),
    });
  }
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const lastActual = actual[actual.length - 1].score;
    const score = lastActual + Math.sin(i * 0.4) * 8 + i * 0.2;
    predicted.push({
      date: date.toISOString().slice(0, 10),
      score: Math.round(score),
    });
  }
  return { actual, predicted };
};

export function Analytics() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [forecastDays, setForecastDays] = useState<7 | 30 | 90>(30);

  const showAnalytics = !!(currentUser && currentUser.systemRole && 
    ['Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole));

  const anomalies = useQuery({
    queryKey: pulseQueryKeys.analytics.anomalies(),
    queryFn: async () => generateMockAnomalies(),
    enabled: showAnalytics,
    staleTime: 300_000,
  });

  const predictions = useQuery({
    queryKey: pulseQueryKeys.analytics.predictions(forecastDays),
    queryFn: async () => generateMockPredictions(forecastDays),
    enabled: showAnalytics,
    staleTime: 300_000,
  });

  const recommendations = useQuery({
    queryKey: pulseQueryKeys.analytics.recommendations(),
    queryFn: async () => generateMockRecommendations(),
    enabled: showAnalytics,
    staleTime: 300_000,
  });

  const complianceData = useQuery({
    queryKey: pulseQueryKeys.analytics.compliance(dateRange),
    queryFn: async () => generateMockComplianceData(dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90),
    enabled: showAnalytics,
    staleTime: 300_000,
  });

  const trendData = useQuery({
    queryKey: pulseQueryKeys.analytics.trends(),
    queryFn: async () => generateMockTrendData(),
    enabled: showAnalytics,
    staleTime: 300_000,
  });

  const dateRangeLabel = useMemo(() => {
    const end = todayISO();
    const start = getDateDaysAgo(dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90);
    return `${start} to ${end}`;
  }, [dateRange]);

  if (!currentUser) return null;

  if (!showAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-10 border border-zinc-800/60 border-dashed rounded-lg bg-[#18181b]/50">
        <ChartLine size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-base font-medium text-zinc-300">Access Restricted</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-sm">
          Advanced Analytics are reserved for Executive, Leader, and Manager roles.
        </p>
      </div>
    );
  }

  const isLoading = anomalies.isLoading || predictions.isLoading || recommendations.isLoading || 
                    complianceData.isLoading || trendData.isLoading;

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-400" />
            <h1 className="text-3xl font-semibold tracking-tight text-white">AI-Powered Analytics</h1>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Advanced insights, predictions, and intelligent recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
            <Calendar className="h-4 w-4 text-zinc-500 ml-2" />
            {(['7d', '30d', '90d'] as const).map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                onClick={() => setDateRange(r)}
                className={cn(
                  'h-7 px-2 text-xs font-medium',
                  dateRange === r ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {r === '7d' ? '7D' : r === '30d' ? '30D' : '90D'}
              </Button>
            ))}
          </div>
          <span className="text-xs text-zinc-500 ml-2">{dateRangeLabel}</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-900/50 border border-zinc-800 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="predictions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            <Brain className="h-4 w-4 mr-1.5" />
            Predictions
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Anomalies
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
            <ChartLine className="h-4 w-4 mr-1.5" />
            Benchmarks
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TrendChart 
                    data={trendData.data || { actual: [], predicted: [] }} 
                    title="Performance Trend with AI Forecast"
                    description="Actual scores vs AI-predicted trajectory"
                  />
                </div>
                <div className="space-y-6">
                  <AnomalyDetectionCard anomalies={anomalies.data || []} compact />
                  <RecommendationsPanel recommendations={recommendations.data || []} compact />
                </div>
              </div>
              <ComplianceHeatmap data={complianceData.data || []} />
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="mt-6 space-y-6">
              <TrendChart 
                data={trendData.data || { actual: [], predicted: [] }} 
                title="Detailed Trend Analysis"
                description="Multi-period comparison with seasonality detection"
                showExport
              />
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-[#141415] border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-sm text-zinc-200">Trend Indicators</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'Daily Average', value: '87.3%', trend: '+2.4%', up: true },
                      { label: 'Weekly Growth', value: '5.1%', trend: '+0.8%', up: true },
                      { label: 'Monthly Change', value: '12.7%', trend: '-1.2%', up: false },
                      { label: 'Volatility', value: 'Low', trend: 'Stable', up: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                        <span className="text-sm text-zinc-400">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-white">{item.value}</span>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            item.up ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          )}>
                            {item.trend}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <ComplianceHeatmap data={complianceData.data || []} compact />
              </div>
            </TabsContent>

            {/* Predictions Tab */}
            <TabsContent value="predictions" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">Performance Forecasting</h3>
                  <p className="text-sm text-zinc-400">AI-generated predictions with confidence intervals</p>
                </div>
                <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
                  {([7, 30, 90] as const).map((days) => (
                    <Button
                      key={days}
                      variant="ghost"
                      size="sm"
                      onClick={() => setForecastDays(days)}
                      className={cn(
                        'h-8 px-3 text-xs font-medium',
                        forecastDays === days ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      {days} Day{days > 1 ? 's' : ''}
                    </Button>
                  ))}
                </div>
              </div>
              <PerformancePredictionCard 
                predictions={predictions.data || []} 
                forecastDays={forecastDays}
              />
              <RecommendationsPanel recommendations={recommendations.data || []} />
            </TabsContent>

            {/* Anomalies Tab */}
            <TabsContent value="anomalies" className="mt-6 space-y-6">
              <AnomalyDetectionCard anomalies={anomalies.data || []} />
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-[#141415] border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-sm text-zinc-200">Anomaly Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'Total Detected', value: '23', change: '+5 this week' },
                      { label: 'Critical', value: '3', change: '-2 from last week', color: 'text-rose-400' },
                      { label: 'Medium', value: '8', change: '+3 from last week', color: 'text-amber-400' },
                      { label: 'Resolved', value: '18', change: '78% resolution rate', color: 'text-emerald-400' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                        <span className="text-sm text-zinc-400">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <span className={cn('text-lg font-bold', item.color || 'text-white')}>{item.value}</span>
                          <span className="text-xs text-zinc-500">{item.change}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="bg-[#141415] border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-sm text-zinc-200">Detection Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'Sensitivity Level', value: 'Medium' },
                      { label: 'Detection Model', value: 'LSTM v2.4' },
                      { label: 'Update Frequency', value: 'Real-time' },
                      { label: 'Alert Threshold', value: '85% confidence' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                        <span className="text-sm text-zinc-400">{item.label}</span>
                        <span className="text-sm font-medium text-white">{item.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Benchmarks Tab */}
            <TabsContent value="benchmarks" className="mt-6 space-y-6">
              <Card className="bg-[#141415] border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-base text-zinc-200">Industry Benchmarks</CardTitle>
                  <CardDescription className="text-xs">Compare your performance against industry standards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {[
                      { metric: 'Overall Compliance', yours: 87, industry: 78, top: 95 },
                      { metric: 'Task Completion Rate', yours: 92, industry: 85, top: 98 },
                      { metric: 'SOP Adherence', yours: 84, industry: 80, top: 93 },
                      { metric: 'Quality Score', yours: 89, industry: 82, top: 96 },
                      { metric: 'Response Time', yours: 76, industry: 70, top: 88 },
                    ].map((item) => (
                      <div key={item.metric} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">{item.metric}</span>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-indigo-400">You: {item.yours}%</span>
                            <span className="text-zinc-500">Industry: {item.industry}%</span>
                            <span className="text-emerald-400">Top 10%: {item.top}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${item.yours}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
