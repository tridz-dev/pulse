import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Download
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface TrendPoint {
  date: string;
  score: number;
}

interface TrendData {
  actual: TrendPoint[];
  predicted: TrendPoint[];
}

interface TrendChartProps {
  data: TrendData;
  title?: string;
  description?: string;
  showExport?: boolean;
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

export function TrendChart({ 
  data, 
  title = 'Performance Trend', 
  description = 'Track performance over time',
  showExport = false 
}: TrendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [showPredicted, setShowPredicted] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Combine actual and predicted data for the chart
  const chartData: Array<{date: string; actual: number | null; predicted: number | null}> = data.actual.map(d => ({
    date: d.date,
    actual: d.score,
    predicted: null,
  }));

  // Add predicted data points
  if (showPredicted && data.predicted.length > 0) {
    // Last actual point for connecting line
    const lastActual = data.actual[data.actual.length - 1];
    if (lastActual) {
      chartData.push({
        date: lastActual.date,
        actual: lastActual.score,
        predicted: lastActual.score,
      });
    }
    
    // Add predicted points
    data.predicted.forEach(d => {
      chartData.push({
        date: d.date,
        actual: null,
        predicted: d.score,
      });
    });
  }

  // Calculate trend indicators
  const calculateTrend = () => {
    if (data.actual.length < 2) return { direction: 'flat', value: 0 };
    
    const recent = data.actual.slice(-7);
    const first = recent[0]?.score || 0;
    const last = recent[recent.length - 1]?.score || 0;
    const change = last - first;
    const pctChange = first > 0 ? (change / first) * 100 : 0;
    
    return {
      direction: change > 1 ? 'up' : change < -1 ? 'down' : 'flat',
      value: Math.abs(pctChange).toFixed(1),
    };
  };

  const trend = calculateTrend();
  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : null;

  const handleExport = () => {
    // Create a canvas from the chart for export
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    canvas.width = 1200;
    canvas.height = 600;
    
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `trend-chart-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Card className="bg-[#141415] border-zinc-800">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-zinc-200">{title}</CardTitle>
              {TrendIcon && (
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                  trend.direction === 'up' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>
                  <TrendIcon className="h-3 w-3" />
                  {trend.value}%
                </div>
              )}
            </div>
            <CardDescription className="text-xs mt-1">{description}</CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              {(['7d', '30d', '90d', '1y'] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'h-7 px-2 text-xs font-medium',
                    timeRange === range ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : '1Y'}
                </Button>
              ))}
            </div>
            
            {showExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                className="h-8 w-8 p-0 text-zinc-500 hover:text-white"
                title="Export chart"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={() => setShowPredicted(!showPredicted)}
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span>Actual</span>
          </button>
          <button
            onClick={() => setShowPredicted(!showPredicted)}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              showPredicted ? "text-zinc-400 hover:text-zinc-300" : "text-zinc-600"
            )}
          >
            <div className="w-3 h-3 rounded-full bg-indigo-500/50 border border-indigo-500 border-dashed" />
            <span>Predicted</span>
          </button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
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
              
              {/* Actual data */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="none"
                fill="url(#actualGradient)"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#6366f1' }}
                connectNulls={false}
              />
              
              {/* Predicted data */}
              {showPredicted && (
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#6366f1', strokeWidth: 0, r: 3, fillOpacity: 0.5 }}
                  activeDot={{ r: 5, fill: '#6366f1' }}
                  connectNulls={false}
                />
              )}
              
              {/* Threshold lines */}
              <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={70} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Indicators Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-zinc-800">
          {[
            { label: 'Current', value: `${data.actual[data.actual.length - 1]?.score || 0}%`, trend: '+2.4%' },
            { label: '7-Day Avg', value: '84.3%', trend: '+1.2%' },
            { label: '30-Day Avg', value: '82.1%', trend: '-0.5%' },
            { label: 'Best', value: '96%', trend: '2 days ago' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xs text-zinc-500">{stat.label}</p>
              <p className="text-lg font-bold text-white mt-1">{stat.value}</p>
              <p className={cn(
                "text-xs",
                stat.trend.startsWith('+') ? "text-emerald-400" : 
                stat.trend.startsWith('-') ? "text-rose-400" : "text-zinc-500"
              )}>
                {stat.trend}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
