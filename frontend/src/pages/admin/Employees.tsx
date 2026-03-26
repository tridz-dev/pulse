import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Search, MoreHorizontal, 
  Edit2, Key, Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Employee {
  name: string;
  employee_name: string;
  user: string;
  user_email?: string;
  pulse_role: string;
  branch: string;
  branch_name?: string;
  department: string;
  department_name?: string;
  reports_to: string | null;
  reports_to_name?: string;
  is_active: 0 | 1;
  avatar_url?: string;
  creation: string;
}

interface Filters {
  branch?: string;
  department?: string;
  pulse_role?: string;
  is_active?: boolean;
  search?: string;
}

export function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [branches, setBranches] = useState<{value: string, label: string}[]>([]);
  const [departments, setDepartments] = useState<{value: string, label: string}[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchBranches();
    fetchDepartments();
  }, [filters]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/method/pulse.api.employees.get_employees?filters=${encodeURIComponent(JSON.stringify(filters))}`
      );
      const data = await response.json();
      if (data.message) {
        setEmployees(data.message.employees);
      }
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.branches.get_branch_options');
      const data = await response.json();
      if (data.message) {
        setBranches(data.message);
      }
    } catch (error) {
      console.error('Failed to load branches');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.departments.get_department_options');
      const data = await response.json();
      if (data.message) {
        setDepartments(data.message);
      }
    } catch (error) {
      console.error('Failed to load departments');
    }
  };

  const handleDeactivate = async (employeeName: string) => {
    if (!confirm('Are you sure you want to deactivate this employee?')) return;
    
    try {
      const response = await fetch('/api/method/pulse.api.employees.deactivate_employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name: employeeName }),
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(data.message.message);
        fetchEmployees();
      } else {
        toast.error(data.message?.message || 'Failed to deactivate');
      }
    } catch (error) {
      toast.error('Failed to deactivate employee');
    }
  };

  const handleResetPassword = async (employeeName: string) => {
    if (!confirm('Reset password for this employee?')) return;
    
    try {
      const response = await fetch('/api/method/pulse.api.employees.reset_user_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name: employeeName }),
      });
      const data = await response.json();
      if (data.message?.success) {
        toast.success(`Temporary password: ${data.message.temp_password}`);
      } else {
        toast.error(data.message?.message || 'Failed to reset password');
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their access
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/employees/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.branch || ''}
          onChange={(e) => setFilters({ ...filters, branch: e.target.value || undefined })}
        >
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.department || ''}
          onChange={(e) => setFilters({ ...filters, department: e.target.value || undefined })}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.pulse_role || ''}
          onChange={(e) => setFilters({ ...filters, pulse_role: e.target.value || undefined })}
        >
          <option value="">All Roles</option>
          <option value="Executive">Executive</option>
          <option value="Area Manager">Area Manager</option>
          <option value="Supervisor">Supervisor</option>
          <option value="Operator">Operator</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.is_active === undefined ? '' : filters.is_active ? 'active' : 'inactive'}
          onChange={(e) => {
            const val = e.target.value;
            setFilters({
              ...filters,
              is_active: val === '' ? undefined : val === 'active'
            });
          }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Employees Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No employees found</h3>
          <p className="text-muted-foreground mt-1">
            {filters.search ? 'Try adjusting your search' : 'Create your first employee to get started'}
          </p>
          {!filters.search && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/admin/employees/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-sm">Employee</th>
                <th className="text-left p-3 font-medium text-sm hidden sm:table-cell">Role</th>
                <th className="text-left p-3 font-medium text-sm">Branch</th>
                <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Dept</th>
                <th className="text-left p-3 font-medium text-sm">Status</th>
                <th className="text-right p-3 font-medium text-sm w-[50px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(emp => (
                <tr 
                  key={emp.name} 
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/admin/employees/${emp.name}`)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={emp.avatar_url} />
                        <AvatarFallback className="text-xs">{getInitials(emp.employee_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{emp.employee_name}</p>
                        <p className="text-xs text-muted-foreground hidden sm:block">{emp.user_email}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{emp.pulse_role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <span className="text-sm">{emp.pulse_role}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-sm">{emp.branch_name || emp.branch}</span>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-sm">{emp.department_name || emp.department || '-'}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant={emp.is_active ? 'default' : 'secondary'} className="text-xs">
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/employees/${emp.name}`);
                        }}>
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/employees/${emp.name}/edit`);
                        }}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleResetPassword(emp.name);
                        }}>
                          <Key className="w-4 h-4 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                        {emp.is_active && (
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeactivate(emp.name);
                            }}
                            className="text-destructive"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
