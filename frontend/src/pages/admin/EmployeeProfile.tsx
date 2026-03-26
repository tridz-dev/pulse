import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Edit2, Key, Power, Mail,
  Building2, Briefcase, UserCheck, Calendar,
  CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Gauge } from '@/components/shared/Gauge';

interface EmployeeDetail {
  employee: {
    name: string;
    employee_name: string;
    user: string;
    pulse_role: string;
    branch: string;
    department: string;
    reports_to: string | null;
    is_active: 0 | 1;
    avatar_url?: string;
    creation: string;
  };
  reports_to_name?: string;
  branch_name?: string;
  department_name?: string;
  user_details?: {
    email: string;
    enabled: 0 | 1;
    last_active?: string;
    role_profile_name?: string;
  };
  recent_runs: {
    name: string;
    template: string;
    period_date: string;
    status: string;
    progress: number;
    score: number;
  }[];
  assignments: {
    name: string;
    template: string;
    is_active: 0 | 1;
  }[];
}

export function EmployeeProfile() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEmployee(id);
    }
  }, [id]);

  const fetchEmployee = async (employeeName: string) => {
    try {
      const response = await fetch(`/api/method/pulse.api.employees.get_employee_detail?employee_name=${employeeName}`);
      const result = await response.json();
      if (result.message) {
        setData(result.message);
      }
    } catch (error) {
      toast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this employee?')) return;
    
    try {
      const response = await fetch('/api/method/pulse.api.employees.deactivate_employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name: id }),
      });
      const result = await response.json();
      if (result.message?.success) {
        toast.success(result.message.message);
        fetchEmployee(id!);
      } else {
        toast.error(result.message?.message || 'Failed to deactivate');
      }
    } catch (error) {
      toast.error('Failed to deactivate employee');
    }
  };

  const handleResetPassword = async () => {
    if (!confirm('Reset password for this employee?')) return;
    
    try {
      const response = await fetch('/api/method/pulse.api.employees.reset_user_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name: id }),
      });
      const result = await response.json();
      if (result.message?.success) {
        toast.success(`Temporary password: ${result.message.temp_password}`, { duration: 10000 });
      } else {
        toast.error(result.message?.message || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p className="text-muted-foreground">Employee not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/employees')}>
          Back to Employees
        </Button>
      </div>
    );
  }

  const { employee, reports_to_name, branch_name, department_name, user_details, recent_runs, assignments } = data;
  const activeAssignments = assignments.filter(a => a.is_active).length;
  const completedRuns = recent_runs.filter(r => r.status === 'Closed').length;

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/employees')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={employee.avatar_url} />
              <AvatarFallback className="text-lg">{getInitials(employee.employee_name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{employee.employee_name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{employee.pulse_role}</span>
                <span>•</span>
                <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                  {employee.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/admin/employees/${id}/edit`)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleResetPassword}>
            <Key className="w-4 h-4 mr-2" />
            Reset Password
          </Button>
          {employee.is_active && (
            <Button variant="destructive" onClick={handleDeactivate}>
              <Power className="w-4 h-4 mr-2" />
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Info */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user_details && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{user_details.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Joined {formatDate(employee.creation)}</span>
              </div>
              {user_details?.last_active && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Last active {formatDate(user_details.last_active)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{employee.pulse_role}</p>
                  <p className="text-xs text-muted-foreground">Role</p>
                </div>
              </div>
              {reports_to_name && (
                <div className="flex items-center gap-3">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{reports_to_name}</p>
                    <p className="text-xs text-muted-foreground">Reports To</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{branch_name || employee.branch}</p>
                  <p className="text-xs text-muted-foreground">Branch</p>
                </div>
              </div>
              {department_name && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{department_name}</p>
                    <p className="text-xs text-muted-foreground">Department</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{activeAssignments}</p>
                  <p className="text-xs text-muted-foreground">Active SOPs</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{completedRuns}</p>
                  <p className="text-xs text-muted-foreground">Completed Runs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Runs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent SOP Runs</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/operations/${employee.user}`)}>
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {recent_runs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No runs yet
                </p>
              ) : (
                <div className="space-y-3">
                  {recent_runs.map(run => (
                    <div 
                      key={run.name} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/tasks?run=${run.name}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {run.status === 'Closed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : run.status === 'Open' ? (
                            <Clock className="w-5 h-5 text-blue-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{run.template}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(run.period_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-24">
                          <Gauge value={Number(run.score) * 100} size={96} />
                        </div>
                        <Badge variant={run.status === 'Closed' ? 'default' : 'secondary'}>
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SOP Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SOP Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No SOP assignments
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map(assignment => (
                    <div 
                      key={assignment.name}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span className="text-sm">{assignment.template}</span>
                      <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
