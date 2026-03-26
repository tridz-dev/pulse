import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight, AlertCircle, Info, XCircle, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Anomaly {
  id: number;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
  runId: string;
}

interface AnomalyDetectionCardProps {
  anomalies: Anomaly[];
  compact?: boolean;
}

const severityConfig = {
  high: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: XCircle },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertCircle },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Info },
};

// Generate sparkline data showing anomaly frequency
const generateSparklineData = () => {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const baseValue = 2 + Math.sin(i * 0.3) * 3;
    const spike = i === 5 || i === 12 || i === 18 ? 5 : 0;
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.max(0, Math.round(baseValue + spike + (Math.random() - 0.5) * 2)),
    });
  }
  return data;
};

export function AnomalyDetectionCard({ anomalies, compact = false }: AnomalyDetectionCardProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const sparklineData = generateSparklineData();

  const filteredAnomalies = filter === 'all' 
    ? anomalies 
    : anomalies.filter(a => a.severity === filter);

  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const mediumCount = anomalies.filter(a => a.severity === 'medium').length;
  const lowCount = anomalies.filter(a => a.severity === 'low').length;

  const handleDrillDown = (_runId: string) => {
    navigate(`/operations`);
  };

  if (compact) {
    return (
      <Card className="bg-[#141415] border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm text-zinc-200">Anomalies</CardTitle>
            </div>
            <span className="text-xs text-zinc-500">{anomalies.length} detected</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sparkline */}
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={false}
                />
                <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-2">
            {highCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-rose-500/10 rounded text-xs">
                <XCircle className="h-3 w-3 text-rose-400" />
                <span className="text-rose-400 font-medium">{highCount}</span>
              </div>
            )}
            {mediumCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded text-xs">
                <AlertCircle className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400 font-medium">{mediumCount}</span>
              </div>
            )}
            {lowCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded text-xs">
                <Info className="h-3 w-3 text-blue-400" />
                <span className="text-blue-400 font-medium">{lowCount}</span>
              </div>
            )}
          </div>

          {/* Recent Anomalies */}
          <div className="space-y-2">
            {filteredAnomalies.slice(0, 3).map((anomaly) => {
              const config = severityConfig[anomaly.severity];
              const Icon = config.icon;
              return (
                <div 
                  key={anomaly.id}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all hover:opacity-80",
                    config.bg,
                    config.border
                  )}
                  onClick={() => handleDrillDown(anomaly.runId)}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", config.color)}>{anomaly.title}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{anomaly.description}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#141415] border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base text-zinc-200">Anomaly Detection</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              AI-detected irregularities in SOP compliance
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map((f) => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(f)}
                className={cn(
                  'h-7 px-2 text-xs capitalize',
                  filter === f ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timeline Chart */}
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#71717a', fontSize: 10 }}
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
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#f59e0b' }}
              />
              <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Alert Threshold', fill: '#ef4444', fontSize: 10, position: 'right' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Anomaly List */}
        <div className="space-y-2">
          {filteredAnomalies.map((anomaly) => {
            const config = severityConfig[anomaly.severity];
            const Icon = config.icon;
            const timeAgo = new Date(anomaly.timestamp).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            return (
              <div 
                key={anomaly.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-all hover:opacity-80",
                  config.bg,
                  config.border
                )}
              >
                <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", config.color)}>{anomaly.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 uppercase">
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{anomaly.description}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">{timeAgo} • Run: {anomaly.runId}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-zinc-400 hover:text-white"
                  onClick={() => handleDrillDown(anomaly.runId)}
                >
                  View
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            );
          })}
          
          {filteredAnomalies.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No anomalies found for selected filter</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
