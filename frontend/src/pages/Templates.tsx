import { useEffect, useState } from 'react';
import {
  getAllTemplates,
  getTemplateItems,
  getTemplateDetails,
  createTemplate,
  updateTemplate,
} from '@/services/templates';
import type { FullSOPTemplate } from '@/services/templates';
import type { SOPChecklistItem } from '@/types';
import {
  listAssignments,
  listEligibleEmployees,
  createAssignment,
  deactivateAssignment,
} from '@/services/assignments';
import type { SOPAssignment, PulseEmployee } from '@/services/assignments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';
import { Input } from '@/components/ui/input';
import { PageShell, PageHeader } from '@/components/shared/page-shell';
import { ConsequenceRail } from '@/components/shared/consequence-rail';
import { Skeleton } from '@/components/shared/skeleton';
import { TableEmptyState } from '@/components/ui/table-states';
import {
  FileText,
  Printer,
  ChevronRight,
  LayoutList,
  Clock,
  Activity,
  ClipboardCheck,
  Pencil,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export function Templates() {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<Partial<FullSOPTemplate>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<FullSOPTemplate> | null>(null);
  const [templateItems, setTemplateItems] = useState<SOPChecklistItem[]>([]);
  const [isSheetLoading, setIsSheetLoading] = useState(false);

  // Assignment states
  const [assignments, setAssignments] = useState<SOPAssignment[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<PulseEmployee[]>([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [assignTimezoneOverride, setAssignTimezoneOverride] = useState('');
  const [assignStartTimeOverride, setAssignStartTimeOverride] = useState('');
  const [assignWindowOverride, setAssignWindowOverride] = useState<string>('');
  const [showAdvancedAssign, setShowAdvancedAssign] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FullSOPTemplate | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formFrequencyType, setFormFrequencyType] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Custom'>('Daily');
  const [formOwnerRole, setFormOwnerRole] = useState('');
  const [formActiveFrom, setFormActiveFrom] = useState('');
  const [formActiveTo, setFormActiveTo] = useState('');
  const [formLocalStartTime, setFormLocalStartTime] = useState('08:00');
  const [formCompletionWindow, setFormCompletionWindow] = useState<number>(60);
  const [formScheduleTimezone, setFormScheduleTimezone] = useState('UTC');
  const [formChecklist, setFormChecklist] = useState<SOPChecklistItem[]>([]);
  const [originalChecklist, setOriginalChecklist] = useState<SOPChecklistItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = currentUser && (
    currentUser.systemRole === 'Pulse Admin' ||
    currentUser.systemRole === 'Pulse Leader' ||
    currentUser.id === 'Administrator'
  );

  async function loadTemplates() {
    setIsLoading(true);
    const data = await getAllTemplates();
    setTemplates(data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleViewTemplate = async (template: Partial<FullSOPTemplate>) => {
    setSelectedTemplate(template);
    if (!template.name) return;
    setIsSheetLoading(true);
    setIsAssignmentsLoading(true);

    setSelectedEmployeeName('');
    setAssignTimezoneOverride('');
    setAssignStartTimeOverride('');
    setAssignWindowOverride('');
    setShowAdvancedAssign(false);

    try {
      const [items, allAssignments, employees] = await Promise.all([
        getTemplateItems(template.name),
        listAssignments(),
        canEdit ? listEligibleEmployees() : Promise.resolve([]),
      ]);
      setTemplateItems(items);
      setAssignments(allAssignments.filter((a) => a.template === template.name));
      setEligibleEmployees(employees);
    } catch (err: any) {
      console.error('Failed to load template data', err);
    } finally {
      setIsSheetLoading(false);
      setIsAssignmentsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplate || !selectedTemplate.name || !selectedEmployeeName) return;
    setIsAssigning(true);
    try {
      const windowVal = assignWindowOverride.trim() ? Number(assignWindowOverride) : undefined;
      await createAssignment({
        template: selectedTemplate.name,
        employee: selectedEmployeeName,
        schedule_timezone_override: assignTimezoneOverride.trim() || undefined,
        local_start_time_override: assignStartTimeOverride.trim() || undefined,
        completion_window_minutes_override: windowVal,
      });

      const allAssignments = await listAssignments();
      setAssignments(allAssignments.filter((a) => a.template === selectedTemplate.name));

      setSelectedEmployeeName('');
      setAssignTimezoneOverride('');
      setAssignStartTimeOverride('');
      setAssignWindowOverride('');
      setShowAdvancedAssign(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeactivate = async (assignmentName: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to deactivate this assignment? This will only stop future runs from being generated. Already-generated historical runs will remain untouched.'
    );
    if (!confirmed) return;

    try {
      await deactivateAssignment(assignmentName);
      const allAssignments = await listAssignments();
      setAssignments(allAssignments.filter((a) => a.template === selectedTemplate?.name));
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate assignment');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Lightweight, honest diff between the checklist as loaded and the checklist
  // as currently drafted — used only for the edit-flow consequence disclosure.
  // Compares by position, not by stable item identity, so it is an
  // approximation (a reorder can read as "edited"), not a byte-exact diff.
  const checklistDiff = (() => {
    const before = originalChecklist;
    const after = formChecklist;
    const overlap = Math.min(before.length, after.length);
    let edited = 0;
    for (let i = 0; i < overlap; i++) {
      if (
        before[i].description !== after[i].description ||
        before[i].weight !== after[i].weight ||
        before[i].evidence_required !== after[i].evidence_required ||
        before[i].item_type !== after[i].item_type
      ) {
        edited += 1;
      }
    }
    return {
      added: Math.max(0, after.length - before.length),
      removed: Math.max(0, before.length - after.length),
      edited,
      totalBefore: before.length,
      totalAfter: after.length,
    };
  })();

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormDepartment('');
    setFormFrequencyType('Daily');
    setFormOwnerRole('');
    setFormActiveFrom(new Date().toISOString().slice(0, 10));
    setFormActiveTo('');
    setFormLocalStartTime('08:00');
    setFormCompletionWindow(60);
    setFormScheduleTimezone('UTC');
    setFormChecklist([
      { description: '', sequence: 1, weight: 1, item_type: 'Checkbox', evidence_required: 'None' }
    ]);
    setOriginalChecklist([]);
    setFormError(null);
    setFormFieldErrors({});
    setIsEditorOpen(true);
  };

  const handleOpenEdit = async (template: Partial<FullSOPTemplate>) => {
    if (!template.name) return;
    try {
      setIsSheetLoading(true);
      const fullDoc = await getTemplateDetails(template.name);
      
      setEditingTemplate(fullDoc);
      setFormTitle(fullDoc.title || '');
      setFormDepartment(fullDoc.department || '');
      setFormFrequencyType(fullDoc.frequency_type || 'Daily');
      setFormOwnerRole(fullDoc.owner_role || '');
      setFormActiveFrom(fullDoc.active_from || '');
      setFormActiveTo(fullDoc.active_to || '');
      setFormLocalStartTime(fullDoc.local_start_time || '08:00');
      setFormCompletionWindow(fullDoc.completion_window_minutes || 60);
      setFormScheduleTimezone(fullDoc.schedule_timezone || 'UTC');
      
      const items = await getTemplateItems(template.name);
      const initialItems: SOPChecklistItem[] = items.length > 0 ? items : [
        { description: '', sequence: 1, weight: 1, item_type: 'Checkbox', evidence_required: 'None' }
      ];
      setFormChecklist(initialItems);
      setOriginalChecklist(initialItems);

      setFormError(null);
      setFormFieldErrors({});
      setIsEditorOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load template details');
    } finally {
      setIsSheetLoading(false);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formChecklist.length - 1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...formChecklist];
    const temp = newItems[index];
    newItems[index] = newItems[nextIndex];
    newItems[nextIndex] = temp;
    newItems.forEach((item, idx) => {
      item.sequence = idx + 1;
    });
    setFormChecklist(newItems);
  };

  const removeChecklistItem = (index: number) => {
    const newItems = formChecklist.filter((_, idx) => idx !== index);
    newItems.forEach((item, idx) => {
      item.sequence = idx + 1;
    });
    setFormChecklist(newItems);
  };

  const addChecklistItem = () => {
    const newItem: SOPChecklistItem = {
      description: '',
      sequence: formChecklist.length + 1,
      weight: 1,
      item_type: 'Checkbox',
      evidence_required: 'None',
    };
    setFormChecklist([...formChecklist, newItem]);
  };

  const updateChecklistItem = (index: number, field: keyof SOPChecklistItem, value: any) => {
    const newItems = [...formChecklist];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormChecklist(newItems);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormFieldErrors({});

    if (!formTitle.trim()) {
      setFormFieldErrors(prev => ({ ...prev, title: 'Title is required' }));
      setIsSubmitting(false);
      return;
    }
    if (!formActiveFrom) {
      setFormFieldErrors(prev => ({ ...prev, active_from: 'Active from date is required' }));
      setIsSubmitting(false);
      return;
    }
    if (!formScheduleTimezone.trim()) {
      setFormFieldErrors(prev => ({ ...prev, schedule_timezone: 'Schedule Timezone is required' }));
      setIsSubmitting(false);
      return;
    }
    if (formCompletionWindow <= 0) {
      setFormFieldErrors(prev => ({ ...prev, completion_window: 'Completion window must be a positive integer' }));
      setIsSubmitting(false);
      return;
    }
    if (formChecklist.length === 0 || formChecklist.some(item => !item.description.trim())) {
      setFormError('At least one checklist item is required and all items must have descriptions.');
      setIsSubmitting(false);
      return;
    }

    try {
      const input = {
        title: formTitle,
        frequency_type: formFrequencyType,
        active_from: formActiveFrom,
        local_start_time: formLocalStartTime,
        completion_window_minutes: Number(formCompletionWindow),
        schedule_timezone: formScheduleTimezone,
        department: formDepartment || undefined,
        owner_role: formOwnerRole || undefined,
        active_to: formActiveTo || undefined,
        checklist_items: formChecklist,
      };

      if (editingTemplate && editingTemplate.name) {
        await updateTemplate(editingTemplate.name, input);
      } else {
        await createTemplate(input);
      }

      setIsEditorOpen(false);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (error: any) {
      const errMsg = error.message || error.exc || 'An error occurred';
      const fieldErrors: Record<string, string> = {};
      if (errMsg.includes("Completion window")) {
        fieldErrors.completion_window = errMsg;
      } else if (errMsg.includes("timezone")) {
        fieldErrors.schedule_timezone = errMsg;
      } else if (errMsg.includes("frequency")) {
        fieldErrors.frequency_type = errMsg;
      } else if (errMsg.includes("checklist")) {
        fieldErrors.checklist = errMsg;
      } else {
        setFormError(errMsg);
      }
      setFormFieldErrors(fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell className="pb-10">
      <PageHeader
        title="SOP Templates"
        subtitle="Master definitions of all operational checklists."
        action={
          canEdit ? (
            <Button
              onClick={handleOpenCreate}
              variant="outline"
              className="bg-slab border-rule text-text gap-2 hover:bg-slab-2"
            >
              <LayoutList size={16} />
              <span>Create Template</span>
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slab rounded-[var(--radius)] animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <TableEmptyState
          icon={<FileText size={16} />}
          title="No templates yet"
          description="Create your first SOP template to define operational checklists."
          action={
            canEdit && (
              <Button
                onClick={handleOpenCreate}
                variant="outline"
                size="sm"
                className="bg-slab border-rule text-text gap-2 hover:bg-slab-2 mt-2"
              >
                <LayoutList size={14} />
                <span>Create Template</span>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.name}
              className="bg-slab border-rule hover:border-rule-2 transition-colors cursor-pointer group"
              onClick={() => handleViewTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2 text-faint">
                  <FileText size={20} className="group-hover:text-text transition-colors" />
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase border-rule text-faint"
                  >
                    {template.frequency_type ?? '—'}
                  </Badge>
                </div>
                <CardTitle className="text-lg text-text transition-colors">
                  {template.title}
                </CardTitle>
                <CardDescription className="text-xs text-faint font-mono">
                  ID: {template.name} • Dept: {template.department ?? 'General'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-faint">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="opacity-60" />
                    <span>Active</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity size={14} className="opacity-60" />
                    <span>{template.owner_role ?? '—'}s</span>
                  </div>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={16} className="text-mute" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={selectedTemplate !== null} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <SheetContent className="bg-ink border-rule w-[500px] sm:w-[640px] p-0 flex flex-col print:w-full print:h-full print:p-0 print:border-none">
          {selectedTemplate && (
            <>
              <SheetHeader className="p-8 border-b border-rule bg-slab/30 shrink-0 print:bg-white print:border-black">
                <div className="flex justify-between items-start print:hidden">
                  <div className="flex items-center gap-3 text-faint mb-4 bg-transparent px-3 py-1.5 rounded-[var(--radius)] border-rule w-fit">
                    <ClipboardCheck size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Master Protocol</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button
                        onClick={() => handleOpenEdit(selectedTemplate)}
                        variant="outline"
                        size="sm"
                        className="bg-slab border-rule text-mute gap-2 hover:text-text"
                      >
                        <Pencil size={14} />
                        <span>Edit</span>
                      </Button>
                    )}
                    <Button
                      onClick={handlePrint}
                      variant="outline"
                      size="sm"
                      className="bg-slab border-rule text-mute gap-2 hover:text-text"
                    >
                      <Printer size={14} />
                      <span>Print Task Sheet</span>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <SheetTitle className="text-2xl text-text print:text-black print:text-3xl">
                    {selectedTemplate.title}
                  </SheetTitle>
                  <SheetDescription className="text-mute print:text-zinc-500 flex items-center gap-3">
                    <span>Frequency: {selectedTemplate.frequency_type ?? '—'}</span>
                    <span>•</span>
                    <span>Target: {selectedTemplate.owner_role ?? '—'}</span>
                  </SheetDescription>
                </div>
                <div className="hidden print:block mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-500 uppercase tracking-[0.2em]">
                  Official Operational Standard • Department: {selectedTemplate.department ?? 'General'}
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-8 print:p-0">
                {isSheetLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} height="lg" width="100%" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 print:gap-0">
                    <div className="print:hidden">
                      <h4 className="text-xs font-semibold text-faint uppercase tracking-widest mb-4">
                        Inspection Checklist
                      </h4>
                    </div>
                    <div className="space-y-0.5 print:space-y-0">
                      {templateItems.map((item, index) => (
                        <div
                          key={item.name ?? index}
                          className="flex items-start gap-4 p-4 rounded-[var(--radius)] hover:bg-slab/50 transition-colors border border-transparent hover:border-rule/50 group print:border-zinc-200 print:rounded-none print:hover:bg-transparent print:p-6"
                        >
                          <div className="w-6 h-6 rounded-[var(--radius)] border-2 border-rule mt-0.5 flex items-center justify-center shrink-0 group-hover:border-rule-2 print:border-zinc-300">
                            <span className="text-[10px] text-mute font-mono print:hidden">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium text-text print:text-black print:text-lg italic">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1 border-rule text-mute uppercase"
                              >
                                {item.item_type}
                              </Badge>
                              <span className="text-[10px] text-faint font-mono italic">
                                Weight: {item.weight}
                              </span>
                            </div>
                          </div>
                          <div className="hidden print:block ml-auto w-32 border-b border-zinc-300 h-6"></div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-8 border-t border-rule/50 print:mt-12 print:border-black/10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-mute uppercase tracking-widest">
                            Authorized By
                          </span>
                          <div className="h-10 border-b border-rule/80 print:border-black/20"></div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-mute uppercase tracking-widest">
                            Inspection Date
                          </span>
                          <div className="h-10 border-b border-rule/80 print:border-black/20"></div>
                        </div>
                      </div>
                    </div>

                    {/* Assignments Section */}
                    <div className="mt-8 pt-8 border-t border-rule/50 print:hidden space-y-6">
                      <div>
                        <h4 className="text-xs font-semibold text-mute uppercase tracking-widest">
                          Active Assignments
                        </h4>
                        <p className="text-mute text-xs mt-1">
                          Employees currently assigned to run this checklist.
                        </p>
                      </div>

                      {/* Assignment list */}
                      <div className="space-y-2">
                        {isAssignmentsLoading ? (
                          <Skeleton height="lg" width="100%" />
                        ) : assignments.length === 0 ? (
                          <div className="p-4 bg-slab-2/20 border border-rule/50 rounded-[var(--radius)] text-center text-mute text-xs">
                            No active assignments for this template.
                          </div>
                        ) : (
                          assignments.map((assignment) => (
                            <div
                              key={assignment.name}
                              className="flex items-center justify-between p-3 bg-slab-2/40 border border-rule/60 rounded-[var(--radius)] gap-4 text-xs"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="font-medium text-text truncate">
                                  {assignment.employee}
                                </span>
                                {(assignment.schedule_timezone_override ||
                                  assignment.local_start_time_override ||
                                  (assignment.completion_window_minutes_override !== undefined &&
                                    assignment.completion_window_minutes_override > 0)) && (
                                  <div className="flex flex-wrap gap-x-2 text-[10px] text-mute">
                                    {assignment.schedule_timezone_override && (
                                      <span>TZ: {assignment.schedule_timezone_override}</span>
                                    )}
                                    {assignment.local_start_time_override && (
                                      <span>Start: {assignment.local_start_time_override}</span>
                                    )}
                                    {assignment.completion_window_minutes_override !== undefined &&
                                      assignment.completion_window_minutes_override > 0 && (
                                        <span>Window: {assignment.completion_window_minutes_override}m</span>
                                      )}
                                  </div>
                                )}
                              </div>
                              {canEdit && assignment.is_active === 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeactivate(assignment.name)}
                                  className="text-fail hover:bg-fail-bg px-2.5 py-1 h-auto rounded-[var(--radius)] text-xs"
                                >
                                  Deactivate
                                </Button>
                              )}
                              {assignment.is_active !== 1 && (
                                <Badge variant="outline" className="border-rule text-mute text-[10px]">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Assign form */}
                      {canEdit && (
                        <div className="p-4 bg-slab/20 border border-rule/80 rounded-[var(--radius)] space-y-4">
                          <h5 className="text-xs font-semibold text-mute">
                            Assign to Employee
                          </h5>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-mute">
                                Select Employee
                              </label>
                              <select
                                value={selectedEmployeeName}
                                onChange={(e) => setSelectedEmployeeName(e.target.value)}
                                className="w-full h-9 bg-slab border border-rule rounded-[var(--radius)] text-xs text-text px-2 outline-none focus:border-rule-2"
                              >
                                <option value="">-- Choose Employee --</option>
                                {eligibleEmployees
                                  .filter((emp) => {
                                    // Only block employees who already have an active
                                    // assignment to this template with the SAME effective
                                    // overrides as the ones currently being entered.
                                    // Distinct overrides (e.g. a different schedule) are a
                                    // legitimate, separate assignment and must stay selectable.
                                    const tz = assignTimezoneOverride.trim() || null;
                                    const start = assignStartTimeOverride.trim() || null;
                                    const windowVal = assignWindowOverride.trim()
                                      ? Number(assignWindowOverride)
                                      : null;

                                    return !assignments.some((asgn) => {
                                      if (asgn.employee !== emp.name || asgn.is_active !== 1) {
                                        return false;
                                      }
                                      const asgnTz = asgn.schedule_timezone_override || null;
                                      const asgnStart = asgn.local_start_time_override || null;
                                      const asgnWindow =
                                        asgn.completion_window_minutes_override || null;
                                      return (
                                        asgnTz === tz &&
                                        asgnStart === start &&
                                        asgnWindow === windowVal
                                      );
                                    });
                                  })
                                  .map((emp) => (
                                    <option key={emp.name} value={emp.name}>
                                      {emp.employee_name} ({emp.name})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Advanced Collapse section */}
                            <div>
                              <button
                                type="button"
                                onClick={() => setShowAdvancedAssign(!showAdvancedAssign)}
                                className="text-[10px] text-sel hover:text-sel font-medium flex items-center gap-1 focus:outline-none"
                              >
                                {showAdvancedAssign ? 'Hide advanced overrides' : 'Show advanced overrides'}
                              </button>

                              {showAdvancedAssign && (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slab-2/40 border border-rule/50 rounded-[var(--radius)] animate-in fade-in duration-200">
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-mute">
                                      Timezone Override
                                    </label>
                                    <Input
                                      value={assignTimezoneOverride}
                                      onChange={(e) => setAssignTimezoneOverride(e.target.value)}
                                      className="h-8 bg-slab border-rule text-text text-xs placeholder:text-faint"
                                      placeholder="e.g. Asia/Kolkata"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-mute">
                                      Start Time Override
                                    </label>
                                    <Input
                                      type="time"
                                      value={assignStartTimeOverride}
                                      onChange={(e) => setAssignStartTimeOverride(e.target.value)}
                                      className="h-8 bg-slab border-rule text-text text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-mute">
                                      Window (mins)
                                    </label>
                                    <Input
                                      type="number"
                                      value={assignWindowOverride}
                                      onChange={(e) => setAssignWindowOverride(e.target.value)}
                                      className="h-8 bg-slab border-rule text-text text-xs"
                                      placeholder="e.g. 60"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              onClick={handleAssign}
                              disabled={isAssigning || !selectedEmployeeName}
                              className="w-full bg-slab-2 border border-rule-2 hover:bg-slab text-text font-medium text-xs py-1.5 h-auto rounded-[var(--radius)]"
                            >
                              {isAssigning ? 'Assigning...' : 'Assign'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Form Sheet */}
      <Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SheetContent
          className={`bg-ink border-rule w-[500px] sm:w-[640px] ${editingTemplate ? 'lg:w-[900px]' : ''} p-0 flex flex-col max-h-screen`}
        >
          <SheetHeader className="p-6 border-b border-rule/80 bg-slab/30 shrink-0">
            <SheetTitle className="text-xl text-text">
              {editingTemplate ? 'Edit SOP Template' : 'Create SOP Template'}
            </SheetTitle>
            <SheetDescription className="text-mute text-xs">
              Define the template details, schedule configuration, and checklist items.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 flex overflow-hidden min-h-0">
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
            {formError && (
              <div className="p-3 bg-fail-bg border border-fail-bd rounded-[var(--radius)] text-fail text-xs">
                {formError}
              </div>
            )}

            {/* General Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-mute uppercase tracking-wider">General Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Title <span className="text-fail">*</span></label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="bg-slab border-rule text-text placeholder:text-faint"
                    placeholder="e.g. Daily Facility Inspection"
                  />
                  {formFieldErrors.title && <p className="text-fail text-[11px]">{formFieldErrors.title}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Department</label>
                  <Input
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="bg-slab border-rule text-text placeholder:text-faint"
                    placeholder="e.g. Operations"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Frequency Type <span className="text-fail">*</span></label>
                  <select
                    value={formFrequencyType}
                    onChange={(e) => setFormFrequencyType(e.target.value as any)}
                    className="w-full h-8 bg-slab border border-rule rounded-[var(--radius)] text-sm text-text px-2 outline-none focus:border-rule-2"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Custom">Custom</option>
                  </select>
                  {formFieldErrors.frequency_type && <p className="text-fail text-[11px]">{formFieldErrors.frequency_type}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Owner Role</label>
                  <Input
                    value={formOwnerRole}
                    onChange={(e) => setFormOwnerRole(e.target.value)}
                    className="bg-slab border-rule text-text placeholder:text-faint"
                    placeholder="e.g. Operator"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Active From <span className="text-fail">*</span></label>
                  <Input
                    type="date"
                    value={formActiveFrom}
                    onChange={(e) => setFormActiveFrom(e.target.value)}
                    className="bg-slab border-rule text-text"
                  />
                  {formFieldErrors.active_from && <p className="text-fail text-[11px]">{formFieldErrors.active_from}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Active To</label>
                  <Input
                    type="date"
                    value={formActiveTo}
                    onChange={(e) => setFormActiveTo(e.target.value)}
                    className="bg-slab border-rule text-text"
                  />
                </div>
              </div>
            </div>

            {/* Schedule Info */}
            <div className="space-y-4 pt-4 border-t border-rule/80">
              <h3 className="text-xs font-semibold text-mute uppercase tracking-wider">Schedule Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Start Time <span className="text-fail">*</span></label>
                  <Input
                    type="time"
                    value={formLocalStartTime}
                    onChange={(e) => setFormLocalStartTime(e.target.value)}
                    className="bg-slab border-rule text-text"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Window (mins) <span className="text-fail">*</span></label>
                  <Input
                    type="number"
                    value={formCompletionWindow}
                    onChange={(e) => setFormCompletionWindow(Number(e.target.value))}
                    className="bg-slab border-rule text-text"
                  />
                  {formFieldErrors.completion_window && <p className="text-fail text-[11px]">{formFieldErrors.completion_window}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-mute">Timezone <span className="text-fail">*</span></label>
                  <Input
                    value={formScheduleTimezone}
                    onChange={(e) => setFormScheduleTimezone(e.target.value)}
                    className="bg-slab border-rule text-text placeholder:text-faint"
                    placeholder="e.g. UTC, Asia/Kolkata"
                  />
                  {formFieldErrors.schedule_timezone && <p className="text-fail text-[11px]">{formFieldErrors.schedule_timezone}</p>}
                </div>
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-4 pt-4 border-t border-rule/80">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-mute uppercase tracking-wider">Checklist Items</h3>
                <Button
                  type="button"
                  onClick={addChecklistItem}
                  variant="outline"
                  size="sm"
                  className="bg-slab border-rule text-text gap-1 hover:bg-slab-2"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </Button>
              </div>
              {formFieldErrors.checklist && (
                <p className="text-fail text-[11px]">{formFieldErrors.checklist}</p>
              )}

              <div className="space-y-4">
                {formChecklist.map((item, index) => (
                  <div key={index} className="p-4 bg-slab-2/40 border border-rule/60 rounded-[var(--radius)] space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs font-mono text-mute">#{index + 1}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-mute hover:text-text disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveItem(index, 'up')}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-mute hover:text-text disabled:opacity-30"
                          disabled={index === formChecklist.length - 1}
                          onClick={() => moveItem(index, 'down')}
                        >
                          <ArrowDown size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-fail hover:bg-fail-bg disabled:opacity-30"
                          disabled={formChecklist.length <= 1}
                          onClick={() => removeChecklistItem(index)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-mute">Description <span className="text-fail">*</span></label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateChecklistItem(index, 'description', e.target.value)}
                        placeholder="e.g. Verify battery backup power is on"
                        className="bg-slab border-rule text-text text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-mute">Type</label>
                        <select
                          value={item.item_type}
                          onChange={(e) => updateChecklistItem(index, 'item_type', e.target.value)}
                          className="w-full h-8 bg-slab border border-rule rounded-[var(--radius)] text-xs text-text px-1 outline-none focus:border-rule-2"
                        >
                          <option value="Checkbox">Checkbox</option>
                          <option value="Numeric">Numeric</option>
                          <option value="Photo">Photo</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-mute">Weight</label>
                        <Input
                          type="number"
                          value={item.weight}
                          onChange={(e) => updateChecklistItem(index, 'weight', Number(e.target.value))}
                          className="bg-slab border-rule text-text text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-mute">Evidence</label>
                        <select
                          value={item.evidence_required || 'None'}
                          onChange={(e) => updateChecklistItem(index, 'evidence_required', e.target.value)}
                          className="w-full h-8 bg-slab border border-rule rounded-[var(--radius)] text-xs text-text px-1 outline-none focus:border-rule-2"
                        >
                          <option value="None">None</option>
                          <option value="Photo">Photo</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>

          {editingTemplate && (
            <ConsequenceRail
              className="hidden lg:flex shrink-0"
              cards={[
                {
                  key: 'changes',
                  title: 'What changed',
                  children: (
                    <div className="flex flex-col gap-1 text-xs text-mute">
                      {checklistDiff.added === 0 && checklistDiff.removed === 0 && checklistDiff.edited === 0 ? (
                        <span>No checklist changes yet.</span>
                      ) : (
                        <>
                          {checklistDiff.added > 0 && <span>{checklistDiff.added} item(s) added</span>}
                          {checklistDiff.removed > 0 && <span>{checklistDiff.removed} item(s) removed</span>}
                          {checklistDiff.edited > 0 && <span>{checklistDiff.edited} item(s) edited</span>}
                        </>
                      )}
                      <span className="text-faint mt-1">
                        {checklistDiff.totalBefore} → {checklistDiff.totalAfter} total items
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'effect',
                  title: 'Likely effect',
                  children: (
                    <p className="text-xs text-mute">
                      Runs already in progress keep the checklist they started with. New runs generated
                      after you save will use this updated structure.
                    </p>
                  ),
                },
                {
                  key: 'scope',
                  title: 'Applies to',
                  children: (
                    <div className="flex flex-col gap-1 text-xs text-mute">
                      <span>Department: {formDepartment || 'General'}</span>
                      <span>Owner role: {formOwnerRole || '—'}</span>
                    </div>
                  ),
                },
              ]}
              footerText="Saving publishes this as the active version. Nothing is scheduled until you save."
              footerActions={[
                <Button
                  key="save"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="bg-slab-2 border border-rule-2 hover:bg-slab text-text font-medium text-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </Button>,
                <Button
                  key="cancel"
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditorOpen(false)}
                  className="text-mute hover:text-text"
                >
                  Cancel
                </Button>,
              ]}
            />
          )}
          </div>

          <div
            className={`border-t border-rule p-4 bg-slab/50 flex justify-end gap-2 shrink-0 ${
              editingTemplate ? 'lg:hidden' : ''
            }`}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditorOpen(false)}
              className="text-mute hover:text-text"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-slab-2 border border-rule-2 hover:bg-slab text-text font-medium text-sm px-4 py-2 rounded-[var(--radius)]"
            >
              {isSubmitting ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                @media print {
                    body * { visibility: hidden; }
                    [role="dialog"], [role="dialog"] * { visibility: visible; }
                    [role="dialog"] {
                        position: absolute; left: 0; top: 0;
                        width: 100% !important; height: 100% !important;
                        background: white !important; color: black !important;
                    }
                }
            `,
        }}
      />
    </PageShell>
  );
}

