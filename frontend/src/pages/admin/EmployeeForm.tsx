import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserPlus, Save, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Branch {
  value: string;
  label: string;
}

interface Department {
  value: string;
  label: string;
}

interface EmployeeOption {
  value: string;
  label: string;
  pulse_role: string;
}

interface FormData {
  employee_name: string;
  email: string;
  phone: string;
  pulse_role: string;
  reports_to: string;
  branch: string;
  department: string;
  is_active: boolean;
  create_user: boolean;
}

const initialFormData: FormData = {
  employee_name: '',
  email: '',
  phone: '',
  pulse_role: '',
  reports_to: '',
  branch: '',
  department: '',
  is_active: true,
  create_user: true,
};

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Name and contact details' },
  { id: 2, title: 'Role & Hierarchy', description: 'Role and reporting structure' },
  { id: 3, title: 'Assignment', description: 'Branch and department' },
  { id: 4, title: 'Review', description: 'Verify and create' },
];

const PULSE_ROLES = [
  { value: 'Executive', label: 'Executive', description: 'Full access to all features' },
  { value: 'Area Manager', label: 'Area Manager', description: 'Manage multiple branches' },
  { value: 'Supervisor', label: 'Supervisor', description: 'Manage a single branch' },
  { value: 'Operator', label: 'Operator', description: 'Execute SOP checklists' },
];

export function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  useEffect(() => {
    fetchBranches();
    fetchDepartments();
    fetchEmployees();
    if (isEdit && id) {
      fetchEmployee(id);
    }
  }, [id]);

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

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.employees.get_employee_options');
      const data = await response.json();
      if (data.message) {
        setEmployees(data.message);
      }
    } catch (error) {
      console.error('Failed to load employees');
    }
  };

  const fetchEmployee = async (employeeName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/method/pulse.api.employees.get_employee_detail?employee_name=${employeeName}`);
      const data = await response.json();
      if (data.message?.employee) {
        const emp = data.message.employee;
        setFormData({
          employee_name: emp.employee_name || '',
          email: data.message.user_details?.email || '',
          phone: '',
          pulse_role: emp.pulse_role || '',
          reports_to: emp.reports_to || '',
          branch: emp.branch || '',
          department: emp.department || '',
          is_active: emp.is_active === 1,
          create_user: false,
        });
      }
    } catch (error) {
      toast.error('Failed to load employee');
      navigate('/admin/employees');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.employee_name.trim()) {
          toast.error('Employee name is required');
          return false;
        }
        if (!formData.email.trim()) {
          toast.error('Email is required');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          toast.error('Please enter a valid email');
          return false;
        }
        return true;
      case 2:
        if (!formData.pulse_role) {
          toast.error('Please select a role');
          return false;
        }
        return true;
      case 3:
        if (!formData.branch) {
          toast.error('Please select a branch');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setSaving(true);
    
    try {
      const payload = {
        employee_name: formData.employee_name,
        email: formData.email,
        pulse_role: formData.pulse_role,
        branch: formData.branch,
        department: formData.department || null,
        reports_to: formData.reports_to || null,
        is_active: formData.is_active,
      };

      if (isEdit) {
        const response = await fetch('/api/method/pulse.api.employees.update_employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_name: id, values: payload }),
        });
        const data = await response.json();
        if (data.message?.success) {
          toast.success(data.message.message);
          navigate('/admin/employees');
        } else {
          toast.error(data.message?.message || 'Failed to update employee');
        }
      } else {
        const response = await fetch('/api/method/pulse.api.employees.create_employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: payload, create_user_account: formData.create_user }),
        });
        const data = await response.json();
        if (data.message?.success) {
          let msg = data.message.message;
          if (data.message.temp_password) {
            msg += ` Temporary password: ${data.message.temp_password}`;
          }
          toast.success(msg, { duration: 10000 });
          navigate('/admin/employees');
        } else {
          toast.error(data.message?.message || 'Failed to create employee');
        }
      }
    } catch (error) {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} employee`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? 'Edit Employee' : 'Add Employee'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update employee details' : 'Create a new team member'}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      {!isEdit && (
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <span className={`text-xs mt-1 ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Content */}
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Employee Details' : STEPS[currentStep - 1].title}</CardTitle>
          {!isEdit && (
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {(isEdit || currentStep === 1) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee_name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="employee_name"
                  value={formData.employee_name}
                  onChange={(e) => updateField('employee_name', e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="john@company.com"
                  disabled={isEdit}
                />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground">
                    This will be used for login
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+1 555-0100"
                />
              </div>
            </div>
          )}

          {/* Step 2: Role & Hierarchy */}
          {(isEdit || currentStep === 2) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Role <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  {PULSE_ROLES.map(role => (
                    <label
                      key={role.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        formData.pulse_role === role.value 
                          ? 'border-primary bg-primary/5' 
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pulse_role"
                        value={role.value}
                        checked={formData.pulse_role === role.value}
                        onChange={(e) => updateField('pulse_role', e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">{role.label}</p>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label htmlFor="reports_to">Reports To</Label>
                <select
                  id="reports_to"
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                  value={formData.reports_to}
                  onChange={(e) => updateField('reports_to', e.target.value)}
                >
                  <option value="">-- No Manager --</option>
                  {employees
                    .filter(e => e.value !== id) // Can't report to self
                    .map(emp => (
                      <option key={emp.value} value={emp.value}>
                        {emp.label} ({emp.pulse_role})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Assignment */}
          {(isEdit || currentStep === 3) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branch">
                  Branch <span className="text-destructive">*</span>
                </Label>
                <select
                  id="branch"
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                  value={formData.branch}
                  onChange={(e) => updateField('branch', e.target.value)}
                >
                  <option value="">Select a branch</option>
                  {branches.map(branch => (
                    <option key={branch.value} value={branch.value}>
                      {branch.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                  value={formData.department}
                  onChange={(e) => updateField('department', e.target.value)}
                >
                  <option value="">-- No Department --</option>
                  {departments.map(dept => (
                    <option key={dept.value} value={dept.value}>
                      {dept.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {!isEdit && currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Review Information</h3>
                
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{formData.employee_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">{formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{formData.pulse_role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reports To</span>
                    <span className="font-medium">
                      {employees.find(e => e.value === formData.reports_to)?.label || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch</span>
                    <span className="font-medium">
                      {branches.find(b => b.value === formData.branch)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span className="font-medium">
                      {departments.find(d => d.value === formData.department)?.label || 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  id="create_user"
                  checked={formData.create_user}
                  onCheckedChange={(checked: boolean) => updateField('create_user', checked)}
                />
                <Label htmlFor="create_user" className="cursor-pointer">
                  Create user account (enables login)
                </Label>
              </div>
              
              {formData.create_user && (
                <p className="text-sm text-muted-foreground">
                  A temporary password will be generated and displayed after creation.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => isEdit ? navigate('/admin/employees') : handleBack()}
          disabled={currentStep === 1 && !isEdit}
        >
          {!isEdit && currentStep > 1 && <ChevronLeft className="w-4 h-4 mr-2" />}
          {isEdit ? 'Cancel' : 'Back'}
        </Button>
        
        {isEdit || currentStep === STEPS.length ? (
          <Button onClick={handleSubmit} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : (isEdit ? 'Update Employee' : 'Create Employee')}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
