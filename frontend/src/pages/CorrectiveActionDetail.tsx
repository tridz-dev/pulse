import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, AlertCircle, CheckCircle2, Clock, XCircle, 
  User, Calendar, FileText, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
// Note: Separator component not available
import { toast } from 'sonner';

interface CADetail {
  name: string;
  description: string;
  status: string;
  priority: string;
  resolution: string;
  resolved_at: string | null;
  evidence: string;
  creation: string;
  modified: string;
  run_details: {
    name: string;
    template_title: string;
    department: string;
    employee_name: string;
    branch: string;
    period_date: string;
    status: string;
  } | null;
  run_item_details: {
    description: string;
    status: string;
    completed_at: string | null;
    remarks: string;
  } | null;
  assigned_to_details: {
    employee_name: string;
    pulse_role: string;
    branch: string;
  } | null;
  raised_by_details: {
    employee_name: string;
    pulse_role: string;
  } | null;
}

const statusOptions = [
  { value: 'Open', label: 'Open', icon: AlertCircle },
  { value: 'In Progress', label: 'In Progress', icon: Clock },
  { value: 'Resolved', label: 'Resolved', icon: CheckCircle2 },
  { value: 'Closed', label: 'Closed', icon: XCircle },
];

const priorityOptions = [
  { value: 'Critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'High', label: 'High', color: 'bg-orange-500' },
  { value: 'Medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'Low', label: 'Low', color: 'bg-blue-500' },
];

export function CorrectiveActionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'new';
  
  const [ca, setCa] = useState<CADetail | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    status: 'Open',
    priority: 'Medium',
    resolution: '',
    run: ''
  });

  useEffect(() => {
    if (!isNew && id) {
      fetchCADetail();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchCADetail = async () => {
    try {
      const response = await fetch(`/api/method/pulse.api.corrective_actions.get_corrective_action_detail?ca_name=${id}`);
      const data = await response.json();
      if (data.message) {
        setCa(data.message);
        setFormData({
          description: data.message.description,
          status: data.message.status,
          priority: data.message.priority,
          resolution: data.message.resolution || '',
          run: data.message.run_details?.name || ''
        });
      }
    } catch (error) {
      toast.error('Failed to load corrective action');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        // Create new
        const response = await fetch('/api/method/pulse.api.corrective_actions.create_corrective_action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            run: formData.run,
            description: formData.description,
            priority: formData.priority
          })
        });
        const data = await response.json();
        if (data.message?.success) {
          toast.success('Corrective Action created');
          navigate(`/corrective-actions/${data.message.name}`);
        }
      } else {
        // Update existing
        const response = await fetch('/api/method/pulse.api.corrective_actions.update_corrective_action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ca_name: id,
            values: {
              status: formData.status,
              priority: formData.priority,
              resolution: formData.resolution
            }
          })
        });
        const data = await response.json();
        if (data.message?.success) {
          toast.success('Changes saved');
          fetchCADetail();
        }
      }
    } catch (error) {
      toast.error(isNew ? 'Failed to create' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(s => s.value === status);
    if (!option) return null;
    return (
      <Badge variant={status === 'Open' ? 'destructive' : status === 'Closed' ? 'secondary' : 'default'}>
        <option.icon className="mr-1 h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/corrective-actions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isNew ? 'New Corrective Action' : ca?.name}
            </h1>
            {!isNew && (
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(ca?.status || '')}
                <span className="text-sm text-muted-foreground">
                  Created {ca?.creation && new Date(ca.creation).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {isNew ? 'Create' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the issue..."
                rows={4}
                readOnly={!isNew}
              />
            </CardContent>
          </Card>

          {/* Resolution */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm"
                  value={formData.resolution}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, resolution: e.target.value })}
                  placeholder="Describe how the issue was resolved..."
                  rows={4}
                />
                {ca?.resolved_at && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Resolved on {new Date(ca.resolved_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Source Run */}
          {ca?.run_details && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Source SOP Run
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="font-medium">{ca.run_details.template_title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employee:</span>
                    <span className="font-medium">{ca.run_details.employee_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{ca.run_details.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Run Date:</span>
                    <span className="font-medium">{new Date(ca.run_details.period_date).toLocaleDateString()}</span>
                  </div>
                  <div className="border-t my-3" />
                  <Button variant="outline" size="sm">
                    <a href={`/pulse/tasks?id=${ca.run_details.name}`}>View Run</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Status & Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v || '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData({ ...formData, priority: v || '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* People */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>People</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ca?.assigned_to_details && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{ca.assigned_to_details.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ca.assigned_to_details.pulse_role} • {ca.assigned_to_details.branch}
                      </p>
                    </div>
                  </div>
                )}
                {ca?.raised_by_details && (
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{ca.raised_by_details.employee_name}</p>
                      <p className="text-xs text-muted-foreground">Raised by</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Created {ca?.creation && new Date(ca.creation).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Modified {ca?.modified && new Date(ca.modified).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
