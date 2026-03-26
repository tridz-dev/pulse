import { useState, useEffect } from 'react';
import { 
  History, Download, FileText, FileSpreadsheet, FileCode, 
  CheckCircle, XCircle, Loader2, Clock,
  Calendar, User, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { ReportRunHistory, ReportFormat, ReportRunStatus } from '@/types/reports';

interface ReportHistoryProps {
  refreshTrigger?: number;
}

// Mock data for development - will be replaced with API call
const MOCK_HISTORY: ReportRunHistory[] = [
  {
    id: 'RUN-001',
    report_id: 'SCHED-001',
    report_name: 'Weekly Performance Report',
    report_type: 'score_trends',
    status: 'Success',
    started_at: '2024-03-20T09:00:00Z',
    completed_at: '2024-03-20T09:02:15Z',
    file_url: '/files/reports/weekly_performance_20240320.pdf',
    file_name: 'weekly_performance_20240320.pdf',
    triggered_by: 'scheduled',
    format: 'PDF',
  },
  {
    id: 'RUN-002',
    report_id: 'SCHED-002',
    report_name: 'Monthly Department Comparison',
    report_type: 'department_comparison',
    status: 'Success',
    started_at: '2024-03-15T08:00:00Z',
    completed_at: '2024-03-15T08:01:30Z',
    file_url: '/files/reports/dept_comparison_20240315.xlsx',
    file_name: 'dept_comparison_20240315.xlsx',
    triggered_by: 'scheduled',
    format: 'Excel',
  },
  {
    id: 'RUN-003',
    report_id: 'SCHED-003',
    report_name: 'Branch Performance Summary',
    report_type: 'branch_comparison',
    status: 'Failed',
    started_at: '2024-03-14T10:00:00Z',
    completed_at: '2024-03-14T10:00:45Z',
    error_message: 'Database connection timeout while fetching branch data',
    triggered_by: 'manual',
    format: 'PDF',
  },
  {
    id: 'RUN-004',
    report_id: 'SCHED-001',
    report_name: 'Weekly Performance Report',
    report_type: 'score_trends',
    status: 'Success',
    started_at: '2024-03-13T09:00:00Z',
    completed_at: '2024-03-13T09:01:45Z',
    file_url: '/files/reports/weekly_performance_20240313.pdf',
    file_name: 'weekly_performance_20240313.pdf',
    triggered_by: 'scheduled',
    format: 'PDF',
  },
  {
    id: 'RUN-005',
    report_id: 'SCHED-004',
    report_name: 'Corrective Actions Report',
    report_type: 'ca_summary',
    status: 'Running',
    started_at: '2024-03-20T14:30:00Z',
    triggered_by: 'manual',
    format: 'CSV',
  },
];

const FORMAT_ICONS: Record<ReportFormat, typeof FileText> = {
  PDF: FileText,
  Excel: FileSpreadsheet,
  CSV: FileCode,
};

const FORMAT_COLORS: Record<ReportFormat, string> = {
  PDF: 'text-red-600 bg-red-50',
  Excel: 'text-green-600 bg-green-50',
  CSV: 'text-blue-600 bg-blue-50',
};

const STATUS_CONFIG: Record<ReportRunStatus, { icon: typeof CheckCircle; color: string; bgColor: string; label: string }> = {
  Success: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100',
    label: 'Success' 
  },
  Failed: { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Failed' 
  },
  Running: { 
    icon: Loader2, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100',
    label: 'Running' 
  },
  Pending: { 
    icon: Clock, 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-100',
    label: 'Pending' 
  },
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  score_trends: 'Score Trends',
  department_comparison: 'Department Comparison',
  branch_comparison: 'Branch Comparison',
  top_performers: 'Top/Bottom Performers',
  completion_trend: 'Completion Trend',
  ca_summary: 'Corrective Action Summary',
  outcome_summary: 'Outcome Summary',
};

export function ReportHistory({ refreshTrigger }: ReportHistoryProps) {
  const [history, setHistory] = useState<ReportRunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call when available
      // const response = await call.get('pulse.api.reports.get_report_history');
      // setHistory(response?.history || []);
      
      // Using mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setHistory(MOCK_HISTORY);
    } catch (error) {
      console.error('Failed to fetch report history:', error);
      toast.error('Failed to load report history');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (item: ReportRunHistory) => {
    if (!item.file_url) {
      toast.error('File not available for download');
      return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.href = item.file_url;
    link.download = item.file_name || 'report';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Downloading ${item.file_name}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    if (!completedAt) return '-';
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (duration < 1000) return '< 1s';
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  const getStatusBadge = (status: ReportRunStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor} border-0 gap-1`}>
        <Icon className={`w-3 h-3 ${status === 'Running' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No report history</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Run reports to see their execution history here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item) => {
        const FormatIcon = FORMAT_ICONS[item.format];
        const isExpanded = expandedItem === item.id;
        /* const statusConfig = STATUS_CONFIG[item.status]; */
        
        return (
          <Card key={item.id} className={isExpanded ? 'ring-1 ring-primary' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Format Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${FORMAT_COLORS[item.format]}`}>
                  <FormatIcon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{item.report_name}</h4>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {REPORT_TYPE_LABELS[item.report_type] || item.report_type}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {item.status === 'Success' && item.file_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownload(item)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(item.started_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {item.triggered_by === 'scheduled' ? 'Scheduled' : 'Manual'}
                    </span>
                    {item.completed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(item.started_at, item.completed_at)}
                      </span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Report ID:</span>
                          <p className="font-mono text-xs mt-0.5">{item.id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Format:</span>
                          <p className="mt-0.5">{item.format}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Started:</span>
                          <p className="mt-0.5">{formatDate(item.started_at)}</p>
                        </div>
                        {item.completed_at && (
                          <div>
                            <span className="text-muted-foreground">Completed:</span>
                            <p className="mt-0.5">{formatDate(item.completed_at)}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Error message */}
                      {item.status === 'Failed' && item.error_message && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-800">Error</p>
                              <p className="text-sm text-red-700 mt-0.5">{item.error_message}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* File info */}
                      {item.file_url && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">File:</p>
                          <p className="text-sm font-mono">{item.file_name || item.file_url}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
