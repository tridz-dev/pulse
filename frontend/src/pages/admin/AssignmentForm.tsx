import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, UserCheck, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Template {
  name: string;
  title: string;
  department: string;
  owner_role: string;
  frequency_type: string;
}

interface Employee {
  name: string;
  employee_name: string;
  pulse_role: string;
  branch: string;
  department: string;
}

export function AssignmentForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    template: '',
    employee: '',
    is_active: true
  });
  
  const [options, setOptions] = useState({
    templates: [] as Template[],
    employees: [] as Employee[]
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (formData.template) {
      const template = options.templates.find(t => t.name === formData.template);
      setSelectedTemplate(template || null);
    }
  }, [formData.template, options.templates]);

  useEffect(() => {
    if (formData.employee) {
      const employee = options.employees.find(e => e.name === formData.employee);
      setSelectedEmployee(employee || null);
    }
  }, [formData.employee, options.employees]);

  const fetchOptions = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.assignments.get_assignment_options');
      const data = await response.json();
      if (data.message) {
        setOptions({
          templates: data.message.templates || [],
          employees: data.message.employees || []
        });
      }
    } catch (error) {
      toast.error('Failed to load options');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/method/pulse.api.assignments.create_assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: formData.template,
          employee: formData.employee,
          is_active: formData.is_active
        })
      });
      
      const data = await response.json();
      if (data.message?.success) {
        toast.success('Assignment created successfully');
        navigate('/admin/assignments');
      } else {
        toast.error(data.message?.message || 'Failed to create assignment');
      }
    } catch (error) {
      toast.error('Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  // Filter employees by template role requirements
  const eligibleEmployees = selectedTemplate?.owner_role
    ? options.employees.filter(e => 
        e.pulse_role === selectedTemplate.owner_role || 
        (selectedTemplate.owner_role === 'Operator' && e.pulse_role)
      )
    : options.employees;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/assignments')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Assignment</h1>
          <p className="text-muted-foreground">Assign an SOP template to an employee</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              SOP Template
            </CardTitle>
            <CardDescription>Select the SOP template to assign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template">Template *</Label>
              <Select
                value={formData.template || undefined}
                onValueChange={(v) => setFormData({ ...formData, template: v || '' })}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {options.templates.map((template) => (
                    <SelectItem key={template.name} value={template.name}>
                      {template.title} • {template.frequency_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <div className="rounded-lg bg-muted p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{selectedTemplate.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequency:</span>
                    <span className="font-medium">{selectedTemplate.frequency_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Required Role:</span>
                    <span className="font-medium">{selectedTemplate.owner_role || 'Any'}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Assign To
            </CardTitle>
            <CardDescription>Select the employee who will execute this SOP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select
                value={formData.employee || undefined}
                onValueChange={(v) => setFormData({ ...formData, employee: v || '' })}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEmployees.length === 0 && selectedTemplate ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No eligible employees for this role
                    </div>
                  ) : (
                    eligibleEmployees.map((employee) => (
                      <SelectItem key={employee.name} value={employee.name}>
                        {employee.employee_name} • {employee.pulse_role} • {employee.branch}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedEmployee && (
              <div className="rounded-lg bg-muted p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium">{selectedEmployee.pulse_role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="font-medium">{selectedEmployee.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{selectedEmployee.department || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedTemplate && selectedEmployee && selectedTemplate.owner_role && 
             selectedEmployee.pulse_role !== selectedTemplate.owner_role && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  Employee role ({selectedEmployee.pulse_role}) differs from template requirement ({selectedTemplate.owner_role}).
                  This may cause permission issues.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label htmlFor="is_active">Active Assignment</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Inactive assignments will not generate new SOP runs
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/assignments')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!formData.template || !formData.employee || saving}
          >
            <Save className="mr-2 h-4 w-4" />
            Create Assignment
          </Button>
        </div>
      </form>
    </div>
  );
}
