import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Calendar, LayoutList, Search, MoreHorizontal, 
  CheckCircle2, XCircle, Trash2, Users, FileText
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AssignmentCalendar } from './AssignmentCalendar';
import { BulkAssignmentDialog } from './BulkAssignmentDialog';

interface Assignment {
  name: string;
  template: string;
  template_title: string;
  template_department: string;
  template_frequency: string;
  template_owner_role: string;
  employee: string;
  employee_name: string;
  employee_role: string;
  employee_branch: string;
  employee_department: string;
  is_active: number;
  run_count: number;
  creation: string;
}

interface Template {
  name: string;
  title: string;
}

export function Assignments() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filters, setFilters] = useState({
    template: '',
    is_active: '',
    search: ''
  });

  useEffect(() => {
    fetchAssignments();
    fetchOptions();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/method/pulse.api.assignments.get_assignments');
      const data = await response.json();
      if (data.message) {
        setAssignments(data.message);
      }
    } catch (error) {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.assignments.get_assignment_options');
      const data = await response.json();
      if (data.message) {
        setTemplates(data.message.templates || []);
      }
    } catch (error) {
      console.error('Failed to load options');
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const response = await fetch('/api/method/pulse.api.assignments.delete_assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_name: name })
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success('Assignment deleted');
        fetchAssignments();
      } else {
        toast.error(data.message?.message || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete assignment');
    }
  };

  const handleToggleStatus = async (name: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/method/pulse.api.assignments.update_assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assignment_name: name, 
          values: { is_active: !currentStatus } 
        })
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(currentStatus ? 'Assignment deactivated' : 'Assignment activated');
        fetchAssignments();
      }
    } catch (error) {
      toast.error('Failed to update assignment');
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment) => {
    const matchesTemplate = !filters.template || assignment.template === filters.template;
    const matchesActive = filters.is_active === '' || assignment.is_active === parseInt(filters.is_active);
    const matchesSearch = !filters.search || 
      assignment.template_title?.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.employee_name?.toLowerCase().includes(filters.search.toLowerCase());
    return matchesTemplate && matchesActive && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SOP Assignments</h1>
          <p className="text-muted-foreground">Manage SOP template assignments to employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
            <Users className="mr-2 h-4 w-4" />
            Bulk Assign
          </Button>
          <Button onClick={() => navigate('/admin/assignments/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {assignments.filter((a) => a.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {assignments.filter((a) => !a.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(assignments.map((a) => a.template)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <Button 
            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <LayoutList className="mr-2 h-4 w-4" />
            List
          </Button>
          <Button 
            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </Button>
        </div>

        {viewMode === 'list' && (
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                className="pl-8 w-[200px]"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <Select 
              value={filters.template || undefined} 
              onValueChange={(v) => setFilters({ ...filters, template: v || '' })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Templates</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={filters.is_active || undefined} 
              onValueChange={(v) => setFilters({ ...filters, is_active: v || '' })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="1">Active</SelectItem>
                <SelectItem value="0">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SOP Template</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No assignments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssignments.map((assignment) => (
                      <TableRow key={assignment.name}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.template_title}</span>
                            <span className="text-xs text-muted-foreground">
                              {assignment.template_department} • {assignment.template_frequency}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.employee_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {assignment.employee_role} • {assignment.employee_branch}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                            {assignment.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>{assignment.run_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleToggleStatus(assignment.name, Boolean(assignment.is_active))}>
                                {assignment.is_active ? (
                                  <><XCircle className="mr-2 h-4 w-4" /> Deactivate</>
                                ) : (
                                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Activate</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(assignment.name)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <AssignmentCalendar />
      )}

      {/* Bulk Assignment Dialog */}
      <BulkAssignmentDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        onSuccess={fetchAssignments}
      />
    </div>
  );
}
