import { useState, useEffect } from 'react';
import { 
  Upload, Download, FileSpreadsheet, FileText, History, CheckCircle, 
  AlertCircle, Clock, RefreshCw, ChevronRight, FileDown, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportWizard } from '@/components/imports/ImportWizard';
import { ExportDialog } from '@/components/exports/ExportDialog';
import { toast } from 'sonner';

type TabType = 'import' | 'export';
type JobType = 'import' | 'export';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ImportExportJob {
  id: string;
  type: JobType;
  entity: string;
  filename?: string;
  format?: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  recordCount?: number;
  errorMessage?: string;
}

const TEMPLATES = [
  { 
    name: 'Employees', 
    filename: 'employees_template.csv',
    description: 'Import employee data with contact and assignment details',
    fields: ['employee_name', 'email', 'phone', 'designation', 'department', 'branch']
  },
  { 
    name: 'SOP Templates', 
    filename: 'templates_template.csv',
    description: 'Import SOP templates with checklist items',
    fields: ['template_name', 'description', 'department', 'frequency', 'checklist_items']
  },
  { 
    name: 'Branches', 
    filename: 'branches_template.csv',
    description: 'Import branch locations and configuration',
    fields: ['branch_name', 'branch_code', 'city', 'state', 'manager_email', 'opening_time', 'closing_time']
  },
];

const MOCK_JOBS: ImportExportJob[] = [
  {
    id: '1',
    type: 'import',
    entity: 'Employees',
    filename: 'employees_q1_2024.csv',
    status: 'completed',
    createdAt: '2024-03-15T10:30:00Z',
    completedAt: '2024-03-15T10:32:15Z',
    recordCount: 45,
  },
  {
    id: '2',
    type: 'export',
    entity: 'SOP Runs',
    format: 'Excel',
    status: 'completed',
    createdAt: '2024-03-14T16:45:00Z',
    completedAt: '2024-03-14T16:45:30Z',
    recordCount: 1200,
  },
  {
    id: '3',
    type: 'import',
    entity: 'Branches',
    filename: 'new_branches.csv',
    status: 'failed',
    createdAt: '2024-03-14T09:20:00Z',
    completedAt: '2024-03-14T09:20:10Z',
    errorMessage: 'Invalid branch code format in row 5',
  },
  {
    id: '4',
    type: 'export',
    entity: 'Performance Scores',
    format: 'PDF',
    status: 'processing',
    createdAt: '2024-03-15T11:00:00Z',
  },
];

export function ImportExport() {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [jobs, setJobs] = useState<ImportExportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setJobs(MOCK_JOBS);
    setLoading(false);
  };

  const handleDownloadTemplate = (template: typeof TEMPLATES[0]) => {
    const headers = template.fields.join(',');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', template.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${template.name} template`);
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      setJobs([]);
      toast.success('History cleared');
    }
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin text-primary" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-primary border-primary">Processing</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (createdAt: string, completedAt?: string) => {
    if (!completedAt) return '-';
    const duration = new Date(completedAt).getTime() - new Date(createdAt).getTime();
    if (duration < 1000) return '< 1s';
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import / Export</h1>
          <p className="text-muted-foreground">
            Import data from files or export reports in various formats
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'import' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('import')}
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Data
            </span>
            {activeTab === 'import' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'export' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('export')}
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Data
            </span>
            {activeTab === 'export' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Import Wizard */}
          <ImportWizard />

          {/* Templates Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Import Templates
              </CardTitle>
              <CardDescription>
                Download templates to ensure your data is formatted correctly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TEMPLATES.map((template) => (
                  <Card key={template.name} className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDownloadTemplate(template)}
                        >
                          <FileDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {template.fields.slice(0, 3).map((field) => (
                          <Badge key={field} variant="secondary" className="text-[10px]">
                            {field}
                          </Badge>
                        ))}
                        {template.fields.length > 3 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{template.fields.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Export Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Export Configuration</CardTitle>
                <CardDescription>
                  Select data, format, and filters for your export
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportDialog />
              </CardContent>
            </Card>
          </div>

          {/* Quick Exports */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Exports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-between" onClick={() => toast.success('Exporting Employees...')}>
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    All Employees
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" onClick={() => toast.success('Exporting SOP Templates...')}>
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    SOP Templates
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" onClick={() => toast.success('Exporting Score Report...')}>
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Monthly Score Report
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">Export Tips</h4>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li>• Use Excel format for large datasets</li>
                  <li>• CSV works best for importing into other systems</li>
                  <li>• PDF is ideal for sharing reports</li>
                  <li>• Apply filters to export specific data</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* History Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              View your recent import and export operations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {jobs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No recent activity</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Import or export data to see activity here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {getStatusIcon(job.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {job.type === 'import' ? 'Import' : 'Export'} {job.entity}
                        </span>
                        {getStatusBadge(job.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {job.filename && <span className="mr-3">File: {job.filename}</span>}
                        {job.format && <span className="mr-3">Format: {job.format}</span>}
                        <span>{formatDate(job.createdAt)}</span>
                      </div>
                      {job.errorMessage && (
                        <p className="text-sm text-destructive mt-1">{job.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {job.recordCount !== undefined && (
                      <p className="font-medium">{job.recordCount.toLocaleString()} records</p>
                    )}
                    {job.completedAt && (
                      <p className="text-muted-foreground text-xs">
                        Duration: {formatDuration(job.createdAt, job.completedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
