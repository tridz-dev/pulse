import { useState, useEffect } from 'react';
import { Users, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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

interface BulkAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkAssignmentDialog({ open, onOpenChange, onSuccess }: BulkAssignmentDialogProps) {
  const [step, setStep] = useState<'select' | 'review' | 'result'>('select');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (open) {
      fetchOptions();
    }
  }, [open]);

  const fetchOptions = async () => {
    setOptionsLoading(true);
    try {
      const response = await fetch('/api/method/pulse.api.assignments.get_assignment_options');
      const data = await response.json();
      if (data.message) {
        setTemplates(data.message.templates || []);
        setEmployees(data.message.employees || []);
      }
    } catch (error) {
      toast.error('Failed to load options');
    } finally {
      setOptionsLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.name === selectedTemplate);
  
  // Filter employees by role if template has requirement
  const eligibleEmployees = selectedTemplateData?.owner_role
    ? employees.filter(e => e.pulse_role === selectedTemplateData.owner_role)
    : employees;

  const groupedEmployees = eligibleEmployees.reduce((acc, emp) => {
    const key = emp.branch || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  const handleCreateBulk = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/method/pulse.api.assignments.create_bulk_assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate,
          employees: selectedEmployees,
          is_active: isActive
        })
      });
      
      const data = await response.json();
      if (data.message) {
        setResult(data.message);
        setStep('result');
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to create assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAllInBranch = (branch: string, select: boolean) => {
    const branchEmployees = groupedEmployees[branch].map(e => e.name);
    if (select) {
      setSelectedEmployees(prev => [...new Set([...prev, ...branchEmployees])]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => !branchEmployees.includes(id)));
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedTemplate('');
    setSelectedEmployees([]);
    setIsActive(true);
    setResult(null);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk SOP Assignment
          </DialogTitle>
          <DialogDescription>
            Assign an SOP template to multiple employees at once
          </DialogDescription>
        </DialogHeader>

        {optionsLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            {step === 'select' && (
              <div className="space-y-6 py-4 flex-1 overflow-hidden flex flex-col">
                {/* Template Selection */}
                <div className="space-y-2">
                  <Label>SOP Template *</Label>
                  <Select value={selectedTemplate || undefined} onValueChange={(v) => setSelectedTemplate(v || '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.name} value={template.name}>
                          {template.title} • {template.frequency_type}
                          {template.owner_role && ` • ${template.owner_role} only`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateData && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{selectedTemplateData.department}</Badge>
                      <Badge variant="outline">{selectedTemplateData.frequency_type}</Badge>
                      {selectedTemplateData.owner_role && (
                        <Badge>Required: {selectedTemplateData.owner_role}</Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Employee Selection */}
                {selectedTemplate && (
                  <>
                    <div className="border-t pt-4" />
                    <div className="space-y-2 flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <Label>Select Employees ({selectedEmployees.length} selected)</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="is_active"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                          />
                          <Label htmlFor="is_active" className="text-sm">Active</Label>
                        </div>
                      </div>
                      
                      <div className="h-[300px] border rounded-md p-4 overflow-y-auto">
                        {Object.entries(groupedEmployees).map(([branch, branchEmployees]) => (
                          <div key={branch} className="mb-4">
                            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-2">
                              <Checkbox
                                checked={branchEmployees.every(e => selectedEmployees.includes(e.name))}
                                onCheckedChange={(checked) => handleSelectAllInBranch(branch, checked as boolean)}
                              />
                              <span className="font-semibold text-sm">{branch}</span>
                              <Badge variant="secondary" className="text-xs">{branchEmployees.length}</Badge>
                            </div>
                            <div className="pl-6 space-y-2">
                              {branchEmployees.map(employee => (
                                <div key={employee.name} className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedEmployees.includes(employee.name)}
                                    onCheckedChange={() => handleEmployeeToggle(employee.name)}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{employee.employee_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {employee.pulse_role} • {employee.department || 'No dept'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedTemplate && selectedEmployees.length === 0 && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <span className="text-sm text-yellow-800">
                      Please select at least one employee to assign this SOP
                    </span>
                  </div>
                )}
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-4 py-4">
                <h3 className="font-medium">Review Assignment</h3>
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="font-medium">{selectedTemplateData?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employees:</span>
                    <span className="font-medium">{selectedEmployees.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">{isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will create {selectedEmployees.length} new assignment{selectedEmployees.length !== 1 ? 's' : ''}.
                  Existing assignments will be skipped.
                </p>
              </div>
            )}

            {step === 'result' && result && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  {result.created_count > 0 ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    {result.created_count > 0 
                      ? `Created ${result.created_count} assignment${result.created_count !== 1 ? 's' : ''}` 
                      : 'No assignments created'}
                  </span>
                </div>
                
                {result.failed_count > 0 && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        {result.failed_count} employee{result.failed_count !== 1 ? 's' : ''} could not be assigned:
                        <ul className="mt-2 list-disc list-inside">
                          {result.failed.slice(0, 5).map((f: any, i: number) => (
                            <li key={i}>
                              {employees.find(e => e.name === f.employee)?.employee_name || f.employee}: {f.reason}
                            </li>
                          ))}
                          {result.failed.length > 5 && (
                            <li>...and {result.failed.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={() => setStep('review')}
                disabled={!selectedTemplate || selectedEmployees.length === 0}
              >
                Review
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button 
                onClick={handleCreateBulk}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Assignments
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
