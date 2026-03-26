import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, AlertCircle, CheckCircle2, Clock, 
  XCircle, MoreHorizontal, User, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CorrectiveAction {
  name: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assigned_to: string;
  assigned_to_name: string;
  raised_by_name: string;
  template_title: string;
  run_employee_name: string;
  creation: string;
  modified: string;
}

interface CASummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  by_priority: Record<string, number>;
}

const statusColumns = [
  { key: 'Open', label: 'Open', icon: AlertCircle, color: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'In Progress', label: 'In Progress', icon: Clock, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'Resolved', label: 'Resolved', icon: CheckCircle2, color: 'bg-green-100 text-green-800 border-green-200' },
  { key: 'Closed', label: 'Closed', icon: XCircle, color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

const priorityColors = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500'
};

export function CorrectiveActions() {
  const navigate = useNavigate();
  const [cas, setCas] = useState<CorrectiveAction[]>([]);
  const [summary, setSummary] = useState<CASummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: ''
  });

  useEffect(() => {
    fetchCAData();
  }, [filters]);

  const fetchCAData = async () => {
    setLoading(true);
    try {
      // Fetch CAs
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      
      const caResponse = await fetch(`/api/method/pulse.api.corrective_actions.get_corrective_actions?${params}`);
      const caData = await caResponse.json();
      if (caData.message) {
        setCas(caData.message);
      }
      
      // Fetch summary
      const summaryResponse = await fetch('/api/method/pulse.api.corrective_actions.get_ca_summary');
      const summaryData = await summaryResponse.json();
      if (summaryData.message) {
        setSummary(summaryData.message);
      }
    } catch (error) {
      toast.error('Failed to load corrective actions');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (caName: string, newStatus: string) => {
    try {
      const response = await fetch('/api/method/pulse.api.corrective_actions.update_corrective_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ca_name: caName, 
          values: { status: newStatus } 
        })
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(`Status updated to ${newStatus}`);
        fetchCAData();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Filter CAs by search
  const filteredCAs = cas.filter(ca => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      ca.description?.toLowerCase().includes(searchLower) ||
      ca.assigned_to_name?.toLowerCase().includes(searchLower) ||
      ca.template_title?.toLowerCase().includes(searchLower)
    );
  });

  // Group by status for kanban
  const caByStatus = {
    'Open': filteredCAs.filter(ca => ca.status === 'Open'),
    'In Progress': filteredCAs.filter(ca => ca.status === 'In Progress'),
    'Resolved': filteredCAs.filter(ca => ca.status === 'Resolved'),
    'Closed': filteredCAs.filter(ca => ca.status === 'Closed'),
  };

  const renderCACard = (ca: CorrectiveAction) => (
    <div 
      key={ca.name} 
      className="p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/corrective-actions/${ca.name}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <Badge className={`${priorityColors[ca.priority]} text-white`}>
          {ca.priority}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4 text-gray-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {statusColumns.map(col => (
              <DropdownMenuItem 
                key={col.key}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(ca.name, col.key);
                }}
              >
                <col.icon className="mr-2 h-4 w-4" />
                Move to {col.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <p className="text-sm font-medium mb-3 line-clamp-2">{ca.description}</p>
      
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Flag className="h-3 w-3" />
        <span className="truncate">{ca.template_title}</span>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <User className="h-3 w-3" />
        <span>{ca.assigned_to_name || 'Unassigned'}</span>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{ca.name}</span>
        <span>{new Date(ca.creation).toLocaleDateString()}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corrective Actions</h1>
          <p className="text-muted-foreground">Track and manage issues from SOP runs</p>
        </div>
        <Button onClick={() => navigate('/corrective-actions/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Corrective Action
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.open || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.in_progress || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.resolved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{summary?.closed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <Button 
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            Kanban
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 w-[200px]"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Select 
            value={filters.status || undefined} 
            onValueChange={(v) => setFilters({ ...filters, status: v || '' })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              {statusColumns.map(col => (
                <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={filters.priority || undefined} 
            onValueChange={(v) => setFilters({ ...filters, priority: v || '' })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Priorities</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map(col => (
            <div key={col.key} className="space-y-3">
              <div className={`flex items-center gap-2 p-2 rounded-lg border ${col.color}`}>
                <col.icon className="h-4 w-4" />
                <span className="font-medium">{col.label}</span>
                <Badge variant="secondary" className="ml-auto">
                  {caByStatus[col.key as keyof typeof caByStatus].length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {caByStatus[col.key as keyof typeof caByStatus].map(renderCACard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* List view implementation */}
            <div className="divide-y">
              {filteredCAs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No corrective actions found
                </div>
              ) : (
                filteredCAs.map(ca => (
                  <div 
                    key={ca.name} 
                    className="p-4 hover:bg-accent cursor-pointer"
                    onClick={() => navigate(`/corrective-actions/${ca.name}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge className={`${priorityColors[ca.priority]} text-white`}>
                          {ca.priority}
                        </Badge>
                        <div>
                          <p className="font-medium">{ca.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {ca.template_title} • Assigned to {ca.assigned_to_name}
                          </p>
                        </div>
                      </div>
                      <Badge variant={ca.status === 'Open' ? 'destructive' : 'default'}>
                        {ca.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
