import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Mail, FileText, FileSpreadsheet, FileCode, 
  X, Plus, BarChart3, Building2, Users, 
  TrendingUp, CheckSquare, AlertCircle, LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { call } from '@/lib/frappe-sdk';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReportType, ReportFrequency, ReportFormat } from '@/types/reports';

interface ScheduleReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editReport?: {
    id: string;
    name: string;
    type: ReportType;
    frequency: ReportFrequency;
    recipients: string[];
    is_active: boolean;
    format?: ReportFormat;
  } | null;
}

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof BarChart3; description: string }[] = [
  { value: 'score_trends', label: 'Score Trends', icon: TrendingUp, description: 'Daily/weekly score trends over time' },
  { value: 'department_comparison', label: 'Department Comparison', icon: Building2, description: 'Compare performance across departments' },
  { value: 'branch_comparison', label: 'Branch Comparison', icon: LayoutDashboard, description: 'Compare performance across branches' },
  { value: 'top_performers', label: 'Top/Bottom Performers', icon: Users, description: 'Identify top and bottom performers' },
  { value: 'completion_trend', label: 'Completion Trend', icon: CheckSquare, description: 'Track completion rates over time' },
  { value: 'ca_summary', label: 'Corrective Action Summary', icon: AlertCircle, description: 'Summary of corrective actions' },
  { value: 'outcome_summary', label: 'Outcome Summary', icon: BarChart3, description: 'Pass/fail outcomes by template' },
];

const FREQUENCIES: { value: ReportFrequency; label: string }[] = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
];

const FORMATS: { value: ReportFormat; label: string; icon: typeof FileText; color: string }[] = [
  { value: 'PDF', label: 'PDF', icon: FileText, color: 'text-red-600' },
  { value: 'Excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-green-600' },
  { value: 'CSV', label: 'CSV', icon: FileCode, color: 'text-blue-600' },
];

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export function ScheduleReportDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  editReport 
}: ScheduleReportDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setReportTypes] = useState<ReportType[]>([]);
  const [, setAvailableFrequencies] = useState<ReportFrequency[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  
  const [formData, setFormData] = useState({
    report_type: '' as ReportType | '',
    name: '',
    frequency: 'Daily' as ReportFrequency,
    recipients: [] as string[],
    format: 'PDF' as ReportFormat,
    start_date: '',
    end_date: '',
    day_of_week: 1,
    day_of_month: 1,
    run_time: '09:00',
    is_active: true,
  });

  // Load report types on mount
  useEffect(() => {
    if (open) {
      loadReportTypes();
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (editReport) {
      setFormData({
        report_type: editReport.type,
        name: editReport.name,
        frequency: editReport.frequency,
        recipients: [...editReport.recipients],
        format: editReport.format || 'PDF',
        start_date: '',
        end_date: '',
        day_of_week: 1,
        day_of_month: 1,
        run_time: '09:00',
        is_active: editReport.is_active,
      });
    } else {
      // Reset form
      setFormData({
        report_type: '',
        name: '',
        frequency: 'Daily',
        recipients: [],
        format: 'PDF',
        start_date: '',
        end_date: '',
        day_of_week: 1,
        day_of_month: 1,
        run_time: '09:00',
        is_active: true,
      });
    }
  }, [editReport, open]);

  const loadReportTypes = async () => {
    try {
      const response = await call.get('pulse.api.reports.get_report_types');
      if (response && typeof response === 'object') {
        const types = (response as { types: { id: ReportType }[] }).types || [];
        setReportTypes(types.map(t => t.id));
        setAvailableFrequencies((response as { frequencies: ReportFrequency[] }).frequencies || ['Daily', 'Weekly', 'Monthly']);
      }
    } catch (error) {
      // Fallback to defaults if API fails
      console.warn('Failed to load report types:', error);
    }
  };

  const handleAddRecipient = () => {
    const email = newRecipient.trim();
    if (!email) return;
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (formData.recipients.includes(email)) {
      toast.error('This email is already added');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, email]
    }));
    setNewRecipient('');
  };

  const handleRemoveRecipient = (email: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.report_type) {
      toast.error('Please select a report type');
      return;
    }
    
    if (!formData.name.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    
    if (formData.recipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const config = {
        report_type: formData.report_type,
        name: formData.name,
        frequency: formData.frequency,
        recipients: formData.recipients,
        format: formData.format,
        filters: {
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined,
        },
        day_of_week: formData.frequency === 'Weekly' ? formData.day_of_week : undefined,
        day_of_month: formData.frequency === 'Monthly' ? formData.day_of_month : undefined,
        run_time: formData.run_time,
      };

      if (editReport) {
        await call.post('pulse.api.reports.update_scheduled_report', {
          report_id: editReport.id,
          updates: config
        });
        toast.success('Report schedule updated successfully');
      } else {
        await call.post('pulse.api.reports.schedule_report', { config });
        toast.success('Report scheduled successfully');
      }
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to schedule report:', error);
      toast.error(editReport ? 'Failed to update report schedule' : 'Failed to schedule report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedReport = REPORT_TYPES.find(r => r.value === formData.report_type);
  // const selectedFormat = FORMATS.find(f => f.value === formData.format);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {editReport ? 'Edit Scheduled Report' : 'Schedule New Report'}
          </DialogTitle>
          <DialogDescription>
            Configure automated report generation and email delivery
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report Type Selection */}
          <div className="space-y-3">
            <Label>Report Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REPORT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Card
                    key={type.value}
                    className={`cursor-pointer transition-all ${
                      formData.report_type === type.value 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, report_type: type.value }))}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          formData.report_type === type.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm truncate">{type.label}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{type.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Report Name */}
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              placeholder={`${selectedReport?.label || 'Report'} - ${FREQUENCIES.find(f => f.value === formData.frequency)?.label}`}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Frequency & Schedule */}
          <div className="space-y-4">
            <Label>Schedule</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Frequency</span>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: (value || 'Daily') as ReportFrequency }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(freq => (
                      <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Run Time</span>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={formData.run_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, run_time: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Day selection for Weekly/Monthly */}
            {formData.frequency === 'Weekly' && (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Day of Week</span>
                <Select
                  value={String(formData.day_of_week)}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_week: parseInt(value || '1') }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.frequency === 'Monthly' && (
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Day of Month (1-28)</span>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={formData.day_of_month}
                  onChange={(e) => setFormData(prev => ({ ...prev, day_of_month: parseInt(e.target.value) || 1 }))}
                />
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <Label>Date Range (Optional)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Start Date</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">End Date</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((format) => {
                const Icon = format.icon;
                return (
                  <Button
                    key={format.value}
                    variant={formData.format === format.value ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setFormData(prev => ({ ...prev, format: format.value }))}
                    type="button"
                  >
                    <Icon className={`w-4 h-4 ${format.color}`} />
                    {format.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <Label>Email Recipients</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter email address"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRecipient();
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button 
                type="button"
                variant="outline" 
                onClick={handleAddRecipient}
                disabled={!newRecipient.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {formData.recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    {email}
                    <button 
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="active-toggle" className="text-sm">Active</Label>
              <p className="text-xs text-muted-foreground">Enable this scheduled report</p>
            </div>
            <Switch
              id="active-toggle"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.report_type || !formData.name || formData.recipients.length === 0}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {editReport ? 'Updating...' : 'Scheduling...'}
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                {editReport ? 'Update Schedule' : 'Schedule Report'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
