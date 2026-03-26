import { useEffect, useState } from 'react';
import { Shield, Users, Check, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface Role {
  name: string;
  role_name: string;
  alias: string;
  system_role: string;
  description: string;
  is_active: number;
  permissions: Record<string, number>;
  employee_count: number;
}

const permissionLabels: Record<string, string> = {
  'view_tasks': 'View Tasks',
  'create_tasks': 'Create Tasks',
  'edit_tasks': 'Edit Tasks',
  'view_team': 'View Team',
  'view_operations': 'View Operations',
  'view_insights': 'View Insights',
  'view_templates': 'View Templates',
  'create_templates': 'Create Templates',
  'edit_templates': 'Edit Templates',
  'view_assignments': 'View Assignments',
  'create_assignments': 'Create Assignments',
  'view_corrective_actions': 'View CAs',
  'create_corrective_actions': 'Create CAs',
  'view_branches': 'View Branches',
  'manage_branches': 'Manage Branches',
  'view_employees': 'View Employees',
  'manage_employees': 'Manage Employees',
  'view_departments': 'View Departments',
  'manage_departments': 'Manage Departments',
  'view_settings': 'View Settings',
  'manage_settings': 'Manage Settings',
};

const keyPermissions = [
  'view_tasks',
  'view_operations',
  'view_insights',
  'view_templates',
  'manage_employees',
  'manage_settings',
];

export function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.admin.get_roles');
      const data = await response.json();
      if (data.message) {
        setRoles(data.message);
      }
    } catch (error) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const getSystemRoleBadge = (systemRole: string) => {
    switch (systemRole) {
      case 'System Manager':
        return <Badge className="bg-purple-500">Admin</Badge>;
      case 'Pulse Executive':
        return <Badge className="bg-blue-500">Executive</Badge>;
      case 'Pulse Leader':
        return <Badge className="bg-green-500">Leader</Badge>;
      case 'Pulse Manager':
        return <Badge className="bg-yellow-500">Manager</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">Manage Pulse roles and permissions</p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {roles.filter(r => r.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <X className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {roles.filter(r => !r.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.reduce((sum, r) => sum + (r.employee_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>System Role</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Key Permissions</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.name}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{role.role_name}</span>
                        {role.alias && role.alias !== role.role_name && (
                          <span className="text-xs text-muted-foreground">{role.alias}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getSystemRoleBadge(role.system_role)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{role.employee_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {keyPermissions.map(perm => (
                          role.permissions?.[perm] ? (
                            <Badge key={perm} variant="default" className="text-xs">
                              {permissionLabels[perm]?.replace('View ', '').replace('Manage ', '')}
                            </Badge>
                          ) : null
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.is_active ? 'default' : 'secondary'}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
