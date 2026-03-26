import { useState, useEffect } from 'react';
import { 
  Calendar, Plus, RefreshCw, History, Clock, AlertCircle,
  FileText, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { call } from '@/lib/frappe-sdk';
import { ScheduleReportDialog } from '@/components/reports/ScheduleReportDialog';
import { ScheduledReportsList } from '@/components/reports/ScheduledReportsList';
import { ReportHistory } from '@/components/reports/ReportHistory';
import type { ScheduledReport } from '@/types/reports';

type TabType = 'schedules' | 'history';

// Mock data for development
const MOCK_REPORTS: ScheduledReport[] = [
  {
    id: 'SCHED-001',
    name: 'Weekly Performance Report',
    type: 'score_trends',
    type_label: 'Score Trends',
    frequency: 'Weekly',
    last_run: '2024-03-13T09:00:00Z',
    next_run: '2024-03-20T09:00:00Z',
    recipients: ['admin@pm.local', 'manager@pm.local'],
    filters: {},
    is_active: true,
    format: 'PDF',
  },
  {
    id: 'SCHED-002',
    name: 'Monthly Department Comparison',
    type: 'department_comparison',
    type_label: 'Department Comparison',
    frequency: 'Monthly',
    last_run: '2024-03-01T08:00:00Z',
    next_run: '2024-04-01T08:00:00Z',
    recipients: ['exec@pm.local'],
    filters: {},
    is_active: true,
    format: 'Excel',
  },
  {
    id: 'SCHED-003',
    name: 'Daily Branch Status',
    type: 'branch_comparison',
    type_label: 'Branch Comparison',
    frequency: 'Daily',
    last_run: '2024-03-19T10:00:00Z',
    next_run: '2024-03-20T10:00:00Z',
    recipients: ['ops@pm.local'],
    filters: {},
    is_active: false,
    format: 'CSV',
  },
];

export function ScheduledReports() {
  const [activeTab, setActiveTab] = useState<TabType>('schedules');
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await call.get('pulse.api.reports.get_scheduled_reports');
      if (response && Array.isArray(response)) {
        setReports(response as ScheduledReport[]);
      } else {
        // Fallback to mock data if API returns unexpected format
        setReports(MOCK_REPORTS);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error);
      // Use mock data if API fails
      setReports(MOCK_REPORTS);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingReport(null);
  };

  const handleSuccess = () => {
    fetchReports();
    if (activeTab === 'history') {
      setHistoryRefresh(prev => prev + 1);
    }
  };

  const activeCount = reports.filter(r => r.is_active).length;
  const pausedCount = reports.filter(r => !r.is_active).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Scheduled Reports
          </h1>
          <p className="text-muted-foreground">
            Automate report generation and email delivery
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Schedule New Report
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{reports.length}</p>
              <p className="text-sm text-muted-foreground">Total Schedules</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{pausedCount}</p>
              <p className="text-sm text-muted-foreground">Paused</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'schedules' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('schedules')}
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Active Schedules
              {reports.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {reports.length}
                </Badge>
              )}
            </span>
            {activeTab === 'schedules' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'history' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('history')}
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </span>
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'schedules' ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Scheduled Reports</h2>
              <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <ScheduledReportsList 
              reports={reports} 
              loading={loading} 
              onRefresh={fetchReports}
              onEdit={handleEdit}
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Execution History</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setHistoryRefresh(prev => prev + 1)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            <ReportHistory refreshTrigger={historyRefresh} />
          </>
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">About Scheduled Reports</p>
              <p className="text-sm text-muted-foreground">
                Scheduled reports automatically generate and email insights at your chosen frequency. 
                Reports run at the scheduled time in the server timezone. You can pause schedules 
                without deleting them, and manually trigger runs at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <ScheduleReportDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={handleSuccess}
        editReport={editingReport}
      />
    </div>
  );
}
