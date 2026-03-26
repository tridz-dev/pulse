import { useState } from 'react';
import { 
  BarChart3, 
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Table2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import type { QueryResult } from '@/hooks/useNLPQuery';
import {
  LineChart as ReLineChart,
  Line,
  BarChart as ReBarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface QueryResultsProps {
  result: QueryResult | null;
  loading?: boolean;
  onFollowUpClick?: (query: string) => void;
  className?: string;
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  chart: BarChart3,
  table: Table2,
  summary: Sparkles,
  comparison: BarChart3,
  anomaly: Sparkles,
  prediction: Sparkles,
};

const TYPE_COLORS: Record<string, string> = {
  chart: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  table: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  summary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  comparison: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  anomaly: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  prediction: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export function QueryResults({ result, loading = false, onFollowUpClick, className }: QueryResultsProps) {
  const [showTable, setShowTable] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  if (loading) return <QueryResultsSkeleton />;
  if (!result) return null;

  const TypeIcon = TYPE_ICONS[result.type] || Sparkles;
  const typeColorClass = TYPE_COLORS[result.type] || TYPE_COLORS.summary;

  const handleExport = () => {
    const dataStr = JSON.stringify(result.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query-result-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    if (!result.chartConfig) return null;
    const { chartType } = result.chartConfig;
    const data = Array.isArray(result.data) ? result.data : 
                 (result.data as { trends?: unknown[] })?.trends || [];

    if (!data.length) return null;

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ReLineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Score']} />
              <Line type="monotone" dataKey="avg_score" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ fill: CHART_COLORS[0], r: 4 }} />
            </ReLineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ReBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="department" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Score']} />
              <Bar dataKey="avg_score" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        const pieData = Array.isArray(result.data) ? result.data : (result.data as { distribution?: unknown[] })?.distribution || [];
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={(props: { name?: string; percent?: number }) => `${props.name || ''}: ${((props.percent || 0) * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="count" nameKey="bracket">
                {pieData.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }} />
            </RePieChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ReAreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Score']} />
              <Area type="monotone" dataKey="avg_score" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
            </ReAreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  const renderTable = () => {
    const tableData: Record<string, unknown>[] = [];
    // Table data extraction logic

    if (!tableData.length) return null;

    const columns = Object.keys(tableData[0]).filter(key => !key.startsWith('_') && key !== 'name');
    let sortedData = [...tableData];
    if (sortConfig) {
      sortedData.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const handleSort = (key: string) => {
      setSortConfig(current => {
        if (!current || current.key !== key) return { key, direction: 'asc' };
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null;
      });
    };

    const formatValue = (value: unknown, key: string): string => {
      if (value === null || value === undefined) return '—';
      if (typeof value === 'number') {
        if (key.includes('score') || key.includes('rate')) return `${(value * 100).toFixed(1)}%`;
        return value.toFixed(2);
      }
      return String(value);
    };

    return (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map(col => (
                <th key={col} onClick={() => handleSort(col)} className="px-4 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/80">
                  <div className="flex items-center gap-1">
                    {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {sortConfig?.key === col && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/50">
                {columns.map(col => (
                  <td key={col} className="px-4 py-2">{formatValue(row[col], col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', typeColorClass)}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{result.title}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {result.summary}
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {result.chartConfig && (
          <div className="rounded-lg bg-muted/30 p-4">
            {renderChart()}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setShowTable(!showTable)} className="gap-1.5">
            <Table2 className="h-4 w-4" />
            {showTable ? 'Hide Data Table' : 'Show Data Table'}
            {showTable ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {showTable && renderTable()}
      </CardContent>

      {result.followUpSuggestions?.length > 0 && (
        <CardFooter className="border-t bg-muted/30 flex-col items-start gap-3 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            Follow-up questions
          </div>
          <div className="flex flex-wrap gap-2">
            {result.followUpSuggestions.map((suggestion, index) => (
              <Button key={index} variant="secondary" size="sm" onClick={() => onFollowUpClick?.(suggestion)} className="gap-1.5 text-xs">
                {suggestion}
                <ArrowRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export function QueryResultsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
            <div className="space-y-2">
              <div className="h-5 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[300px] w-full bg-muted animate-pulse rounded-lg" />
        <div className="flex gap-2">
          <div className="h-8 w-32 bg-muted animate-pulse rounded-full" />
          <div className="h-8 w-40 bg-muted animate-pulse rounded-full" />
          <div className="h-8 w-36 bg-muted animate-pulse rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function QueryResultsEmpty() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">Ask a question to see results</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Use natural language to query your SOP data. Try asking about performance, trends, or comparisons.
        </p>
      </CardContent>
    </Card>
  );
}
