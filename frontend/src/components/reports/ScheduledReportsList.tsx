import { useState } from 'react';
import { 
  Calendar, Clock, Mail, Play, Edit2, Trash2, MoreHorizontal,
  FileText, FileSpreadsheet, FileCode, CheckCircle,
  RotateCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { call } from '@/lib/frappe-sdk';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ScheduledReport, ReportType, ReportFormat } from '@/types/reports';

interface ScheduledReportsListProps {
  reports: ScheduledReport[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (report: ScheduledReport) => void;
}



const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  score_trends: 'Score Trends',
  department_comparison: 'Department Comparison',
  branch_comparison: 'Branch Comparison',
  top_performers: 'Top/Bottom Performers',
  completion_trend: 'Completion Trend',
  ca_summary: 'Corrective Action Summary',
  outcome_summary: 'Outcome Summary',
};

const FORMAT_ICONS: Record<ReportFormat, typeof FileText> = {
  PDF: FileText,
  Excel: FileSpreadsheet,
  CSV: FileCode,
};

const FORMAT_COLORS: Record<ReportFormat, string> = {
  PDF: 'text-red-600',
  Excel: 'text-green-600',
  CSV: 'text-blue-600',
};

export function ScheduledReportsList({ reports, loading, onRefresh, onEdit }: ScheduledReportsListProps) {
  const [runningReportId, setRunningReportId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggleActive = async (report: ScheduledReport) => {
    setTogglingId(report.id);
    try {
      await call.post('pulse.api.reports.update_scheduled_report', {
        report_id: report.id,
        updates: { is_active: !report.is_active }
      });
      toast.success(report.is_active ? 'Report paused' : 'Report activated');
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle report:', error);
      toast.error('Failed to update report status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRunNow = async (report: ScheduledReport) => {
    setRunningReportId(report.id);
    try {
      const response = await call.post('pulse.api.reports.run_scheduled_report_now', {
        report_id: report.id
      });
      if (response && typeof response === 'object' && (response as { success: boolean }).success) {
        toast.success(`Report "${report.name}" generated successfully`);
        onRefresh();
      } else {
        const message = response && typeof response === 'object' ? (response as { message?: string }).message : 'Unknown error';
        toast.error(`Failed to run report: ${message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to run report:', error);
      toast.error('Failed to run report');
    } finally {
      setRunningReportId(null);
    }
  };

  const handleDelete = async (report: ScheduledReport) => {
    if (!confirm(`Are you sure you want to delete "${report.name}"?`)) {
      return;
    }
    
    setDeletingId(report.id);
    try {
      await call.post('pulse.api.reports.delete_scheduled_report', {
        report_id: report.id
      });
      toast.success('Report deleted successfully');
      onRefresh();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNextRunLabel = (report: ScheduledReport) => {
    if (!report.is_active) return 'Paused';
    if (!report.next_run) return 'Not scheduled';
    
    const nextRun = new Date(report.next_run);
    const now = new Date();
    const diffMs = nextRun.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 0) return 'Overdue';
    if (diffMins < 60) return `In ${diffMins} min`;
    if (diffHours < 24) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      Daily: 'bg-blue-100 text-blue-700',
      Weekly: 'bg-purple-100 text-purple-700',
      Monthly: 'bg-amber-100 text-amber-700',
    };
    return colors[frequency] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No scheduled reports</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
            Schedule automated reports to receive regular insights via email
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => {
        const FormatIcon = FORMAT_ICONS[report.format || 'PDF'];
        const isRunning = runningReportId === report.id;
        const isToggling = togglingId === report.id;
        const isDeleting = deletingId === report.id;
        
        return (
          <Card key={report.id} className={!report.is_active ? 'opacity-75' : ''}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FormatIcon className={`w-6 h-6 ${FORMAT_COLORS[report.format || 'PDF']}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base">{report.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {REPORT_TYPE_LABELS[report.type] || report.type}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={report.is_active}
                        onCheckedChange={() => handleToggleActive(report)}
                        disabled={isToggling}
                        size="sm"
                      />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon-sm" disabled={isRunning || isDeleting}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(report)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRunNow(report)} disabled={isRunning}>
                            <Play className="w-4 h-4 mr-2" />
                            {isRunning ? 'Running...' : 'Run Now'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(report)} 
                            disabled={isDeleting}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className={getFrequencyBadge(report.frequency)}>
                      <RotateCw className="w-3 h-3 mr-1" />
                      {report.frequency}
                    </Badge>
                    <Badge variant="outline">
                      {report.format || 'PDF'}
                    </Badge>
                    {report.recipients.length > 0 && (
                      <Badge variant="secondary">
                        <Mail className="w-3 h-3 mr-1" />
                        {report.recipients.length} recipient{report.recipients.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  {/* Schedule Info */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Next Run</span>
                      </div>
                      <p className={`text-sm font-medium ${!report.is_active ? 'text-muted-foreground' : ''}`}>
                        {getNextRunLabel(report)}
                      </p>
                      {report.next_run && report.is_active && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(report.next_run)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Last Run</span>
                      </div>
                      <p className="text-sm font-medium">
                        {report.last_run ? formatDate(report.last_run) : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
