import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Brain, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface PredictionPoint {
  date: string;
  score: number;
  lower: number;
  upper: number;
}

interface PerformancePredictionCardProps {
  predictions: PredictionPoint[];
  forecastDays: 7 | 30 | 90;
}

export function PerformancePredictionCard({ predictions, forecastDays }: PerformancePredictionCardProps) {
  // Calculate metrics
  const metrics = useMemo(() => {
    if (predictions.length === 0) return null;
    
    const currentScore = predictions[0]?.score || 0;
    const lastScore = predictions[predictions.length - 1]?.score || 0;
    const avgScore = predictions.reduce((sum, p) => sum + p.score, 0) / predictions.length;
    const trend = lastScore - currentScore;
    const trendPct = currentScore > 0 ? (trend / currentScore) * 100 : 0;
    
    return {
      currentScore,
      predictedScore: lastScore,
      avgScore: Math.round(avgScore),
      trend,
      trendPct: trendPct.toFixed(1),
      confidence: Math.round(predictions.reduce((sum, p) => sum + (p.upper - p.lower), 0) / predictions.length / 2),
    };
  }, [predictions]);

  // Format data for chart
  const chartData = useMemo(() => {
    return predictions.map((p, i) => ({
      ...p,
      index: i,
      confidenceRange: [p.lower, p.upper],
    }));
  }, [predictions]);

  if (!metrics) {
    return (
      <Card className="bg-[#141415] border-zinc-800">
        <CardContent className="py-12 text-center">
          <Brain className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
          <p className="text-sm text-zinc-500">No prediction data available</p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = metrics.trend > 0 ? TrendingUp : metrics.trend < 0 ? TrendingDown : Minus;
  const trendColor = metrics.trend > 0 ? 'text-emerald-400' : metrics.trend < 0 ? 'text-rose-400' : 'text-zinc-400';
  const trendBg = metrics.trend > 0 ? 'bg-emerald-500/10' : metrics.trend < 0 ? 'bg-rose-500/10' : 'bg-zinc-800';

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={cn("border-zinc-800", trendBg)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase flex items-center gap-1">
              <Target className="h-3 w-3" />
              Predicted Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{metrics.predictedScore}%</span>
              <span className={cn("text-sm font-medium", trendColor)}>
                {metrics.trend > 0 ? '+' : ''}{metrics.trendPct}%
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">vs current {metrics.currentScore}%</p>
          </CardContent>
        </Card>

        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase">Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{metrics.avgScore}%</div>
            <p className="text-xs text-zinc-500 mt-1">over {forecastDays} days</p>
          </CardContent>
        </Card>

        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase">Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">±{metrics.confidence}%</div>
            <p className="text-xs text-zinc-500 mt-1">prediction interval</p>
          </CardContent>
        </Card>

        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("flex items-center gap-2", trendColor)}>
              <TrendIcon className="h-5 w-5" />
              <span className="text-2xl font-bold">{metrics.trend > 0 ? 'Up' : metrics.trend < 0 ? 'Down' : 'Stable'}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{forecastDays}-day forecast</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <Card className="bg-[#141415] border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-zinc-200 flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-400" />
                AI Forecast
              </CardTitle>
              <CardDescription className="text-xs">
                Predicted performance with confidence intervals
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-zinc-400">Prediction</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-indigo-500/20" />
                <span className="text-zinc-400">Confidence</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#18181b', 
                  border: '1px solid #27272a', 
                  borderRadius: 8,
                  color: '#fff'
                }}
                formatter={(value) => {
                  if (value === null || value === undefined) return ['—', ''];
                  return [`${value}%`, ''];
                }}
              />
              
              {/* Confidence interval area */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#confidenceGradient)"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#18181b"
              />
              
              {/* Prediction line */}
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#6366f1' }}
              />
              
              {/* Confidence bounds */}
              <Line
                type="monotone"
                dataKey="lower"
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="upper"
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
              />
              
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={60} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Model Info */}
      <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Brain className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">LSTM Neural Network</p>
            <p className="text-xs text-zinc-500">Trained on 90 days of historical data</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-200">94.2%</p>
          <p className="text-xs text-zinc-500">Model Accuracy</p>
        </div>
      </div>
    </div>
  );
}
