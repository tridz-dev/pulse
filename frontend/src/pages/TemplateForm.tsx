import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getTemplateSchema,
  getTemplateDetail,
  createTemplate,
  updateTemplate,
  type TemplateSchema,
  type CreateTemplateInput,
} from '@/services/templateAdmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  FileText,
  Clock,
  ListChecks,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type ChecklistItemInput = {
  name?: string;
  description: string;
  sequence: number;
  weight: number;
  item_type: 'Checkbox' | 'Numeric' | 'Photo';
  instructions: string;
  item_key: string;
  outcome_mode: 'SimpleCompletion' | 'PassFail' | 'Numeric' | 'PhotoProof';
  proof_requirement: 'None' | 'Optional' | 'Required';
  proof_media_type: 'Image' | 'File' | 'Any';
  proof_capture_mode: 'Any' | 'CameraOnly';
  prerequisite_item_key: string;
  prerequisite_trigger: 'None' | 'AnyOutcome' | 'OutcomeFail' | 'OutcomePass';
};

const DAYS_OF_WEEK = [
  { value: '0', label: 'Mon' },
  { value: '1', label: 'Tue' },
  { value: '2', label: 'Wed' },
  { value: '3', label: 'Thu' },
  { value: '4', label: 'Fri' },
  { value: '5', label: 'Sat' },
  { value: '6', label: 'Sun' },
];

export function TemplateForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [schema, setSchema] = useState<TemplateSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'schedule' | 'items'>('basic');

  // Form state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [ownerRole, setOwnerRole] = useState('');
  const [frequencyType, setFrequencyType] = useState('Daily');
  const [scheduleKind, setScheduleKind] = useState('CalendarDay');
  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['0', '1', '2', '3', '4', '5', '6']);
  const [intervalMinutes, setIntervalMinutes] = useState<number | ''>('');
  const [graceMinutes, setGraceMinutes] = useState(30);
  const [openRunPolicy, setOpenRunPolicy] = useState('AllowMultiple');
  const [isActive, setIsActive] = useState(true);
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo] = useState('');

  const [checklistItems, setChecklistItems] = useState<ChecklistItemInput[]>([]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const schemaData = await getTemplateSchema();
        setSchema(schemaData);

        if (isEdit && id) {
          const template = await getTemplateDetail(id);
          setTitle(template.title || '');
          setDepartment(template.department || '');
          setOwnerRole(template.owner_role || '');
          setFrequencyType(template.frequency_type || 'Daily');
          setScheduleKind(template.schedule_kind || 'CalendarDay');
          setScheduleTime(template.schedule_time?.slice(0, 5) || '');
          setSelectedDays(template.schedule_days_of_week?.split(',') || ['0', '1', '2', '3', '4', '5', '6']);
          setIntervalMinutes(template.interval_minutes || '');
          setGraceMinutes(template.grace_minutes || 30);
          setOpenRunPolicy(template.open_run_policy || 'AllowMultiple');
          setIsActive(template.is_active !== false);
          setActiveFrom(template.active_from || '');
          setActiveTo(template.active_to || '');

          if (template.checklist_items) {
            setChecklistItems(
              template.checklist_items.map((item, idx) => ({
                name: item.name,
                description: item.description || '',
                sequence: item.sequence ?? idx,
                weight: item.weight ?? 1,
                item_type: (item.item_type as ChecklistItemInput['item_type']) || 'Checkbox',
                instructions: item.instructions || '',
                item_key: item.item_key || `item_${idx}`,
                outcome_mode: (item.outcome_mode as ChecklistItemInput['outcome_mode']) || 'SimpleCompletion',
                proof_requirement: (item.proof_requirement as ChecklistItemInput['proof_requirement']) || 'None',
                proof_media_type: (item.proof_media_type as ChecklistItemInput['proof_media_type']) || 'Image',
                proof_capture_mode: (item.proof_capture_mode as ChecklistItemInput['proof_capture_mode']) || 'Any',
                prerequisite_item_key: item.prerequisite_item_key || '',
                prerequisite_trigger: (item.prerequisite_trigger as ChecklistItemInput['prerequisite_trigger']) || 'None',
              }))
            );
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
      setIsLoading(false);
    }
    loadData();
  }, [id, isEdit]);

  const addChecklistItem = () => {
    const newItem: ChecklistItemInput = {
      description: '',
      sequence: checklistItems.length,
      weight: 1,
      item_type: 'Checkbox',
      instructions: '',
      item_key: `item_${checklistItems.length}`,
      outcome_mode: 'SimpleCompletion',
      proof_requirement: 'None',
      proof_media_type: 'Image',
      proof_capture_mode: 'Any',
      prerequisite_item_key: '',
      prerequisite_trigger: 'None',
    };
    setChecklistItems([...checklistItems, newItem]);
  };

  const updateChecklistItem = (index: number, updates: Partial<ChecklistItemInput>) => {
    const updated = checklistItems.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    setChecklistItems(updated);
  };

  const removeChecklistItem = (index: number) => {
    const updated = checklistItems.filter((_, i) => i !== index);
    // Re-sequence items
    setChecklistItems(updated.map((item, i) => ({ ...item, sequence: i })));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === checklistItems.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const items = [...checklistItems];
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    setChecklistItems(items.map((item, i) => ({ ...item, sequence: i })));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    if (checklistItems.length === 0) {
      alert('At least one checklist item is required');
      return;
    }
    if (checklistItems.some((item) => !item.description.trim())) {
      alert('All checklist items must have a description');
      return;
    }

    setIsSaving(true);
    try {
      const input: CreateTemplateInput = {
        title: title.trim(),
        department: department || undefined,
        frequency_type: frequencyType,
        owner_role: ownerRole || undefined,
        active_from: activeFrom || undefined,
        active_to: activeTo || undefined,
        is_active: isActive,
        schedule_kind: scheduleKind,
        schedule_time: scheduleTime || undefined,
        schedule_days_of_week: selectedDays.join(','),
        interval_minutes: intervalMinutes ? Number(intervalMinutes) : undefined,
        open_run_policy: openRunPolicy,
        grace_minutes: graceMinutes,
        checklist_items: checklistItems.map((item) => ({
          ...item,
          weight: Number(item.weight),
        })),
      };

      if (isEdit && id) {
        await updateTemplate(id, input);
        alert('Template updated successfully');
      } else {
        await createTemplate(input);
        alert('Template created successfully');
      }
      navigate('/templates');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(error instanceof Error ? error.message : 'Failed to save template');
    }
    setIsSaving(false);
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-32 bg-zinc-900 rounded-lg animate-pulse" />
        </div>
        <div className="h-96 bg-zinc-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/templates')}
            className="text-zinc-500 hover:text-white -ml-2"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {isEdit ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              {isEdit ? 'Update SOP template details and checklist items.' : 'Define a new standard operating procedure.'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 w-fit">
        {[
          { id: 'basic', label: 'Basic Info', icon: FileText },
          { id: 'schedule', label: 'Schedule', icon: Clock },
          { id: 'items', label: 'Checklist Items', icon: ListChecks },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all',
              activeTab === tab.id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-white">Basic Information</CardTitle>
            <CardDescription className="text-zinc-400">Define the core details of this SOP template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-zinc-300">Template Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Kitchen Opening Checklist"
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Department</label>
                <Select value={department} onValueChange={(v) => v && setDepartment(v)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="">None</SelectItem>
                    {schema?.departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Owner Role</label>
                <Select value={ownerRole} onValueChange={(v) => v && setOwnerRole(v)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="">None</SelectItem>
                    {schema?.owner_roles.map((role) => (
                      <SelectItem key={role.role_name} value={role.role_name}>
                        {role.alias || role.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Frequency Type</label>
                <Select value={frequencyType} onValueChange={(v) => v && setFrequencyType(v)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {schema?.frequency_types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Open Run Policy</label>
                <Select value={openRunPolicy} onValueChange={(v) => v && setOpenRunPolicy(v)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {schema?.open_run_policies.map((policy) => (
                      <SelectItem key={policy} value={policy}>
                        {policy === 'AllowMultiple' ? 'Allow Multiple' : 'Require Previous Closed'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Active From</label>
                <Input
                  type="date"
                  value={activeFrom}
                  onChange={(e) => setActiveFrom(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Active To (Optional)</label>
                <Input
                  type="date"
                  value={activeTo}
                  onChange={(e) => setActiveTo(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <div className="flex items-center gap-2 md:col-span-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked as boolean)}
                />
                <label htmlFor="isActive" className="text-sm text-zinc-300">
                  Template is active
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <Card className="bg-[#141415] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-white">Schedule Configuration</CardTitle>
            <CardDescription className="text-zinc-400">Define when and how often this SOP should be executed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Schedule Kind</label>
                <Select value={scheduleKind} onValueChange={(v) => v && setScheduleKind(v)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {schema?.schedule_kinds.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {kind === 'CalendarDay' ? 'Calendar Day' : kind === 'TimeOfDay' ? 'Time of Day' : 'Interval'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  {scheduleKind === 'CalendarDay' && 'Runs are created once per calendar day.'}
                  {scheduleKind === 'TimeOfDay' && 'Runs are created at a specific time each day.'}
                  {scheduleKind === 'Interval' && 'Runs are created at regular intervals throughout the day.'}
                </p>
              </div>

              {scheduleKind === 'TimeOfDay' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Schedule Time</label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-white w-40"
                  />
                </div>
              )}

              {scheduleKind === 'Interval' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Interval (minutes)</label>
                  <Input
                    type="number"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g., 120 for 2 hours"
                    className="bg-zinc-950 border-zinc-800 text-white w-40"
                    min={15}
                    step={15}
                  />
                </div>
              )}

              {(scheduleKind === 'TimeOfDay' || scheduleKind === 'Interval') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Days of Week</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                          selectedDays.includes(day.value)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Grace Period (minutes)</label>
                <Input
                  type="number"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(Number(e.target.value))}
                  className="bg-zinc-950 border-zinc-800 text-white w-32"
                  min={5}
                />
                <p className="text-xs text-zinc-500">
                  Time allowed after deadline before the run is automatically locked.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <Card className="bg-[#141415] border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Checklist Items</CardTitle>
                <CardDescription className="text-zinc-400">
                  Define the steps that must be completed for this SOP.
                </CardDescription>
              </div>
              <Button onClick={addChecklistItem} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Plus size={16} />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {checklistItems.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg">
                  <ListChecks className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">No checklist items yet.</p>
                  <Button onClick={addChecklistItem} variant="outline" className="mt-4 border-zinc-700">
                    Add your first item
                  </Button>
                </div>
              ) : (
                <Accordion className="space-y-2">
                  {checklistItems.map((item, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="border border-zinc-800 rounded-lg bg-zinc-950/50 px-4"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <GripVertical className="h-4 w-4 text-zinc-600" />
                          <span className="text-zinc-400 text-sm">#{index + 1}</span>
                          <span className="text-white font-medium truncate">
                            {item.description || 'Untitled Item'}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                              {item.outcome_mode === 'SimpleCompletion' ? 'Checkbox' : item.outcome_mode}
                            </Badge>
                            {item.proof_requirement !== 'None' && (
                              <Badge variant="outline" className="text-xs border-amber-700 text-amber-500">
                                Proof {item.proof_requirement === 'Required' ? 'Required' : 'Optional'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Description *</label>
                            <Input
                              value={item.description}
                              onChange={(e) =>
                                updateChecklistItem(index, { description: e.target.value })
                              }
                              placeholder="Describe what needs to be done..."
                              className="bg-zinc-900 border-zinc-800 text-white"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-300">Item Type</label>
                              <Select
                                value={item.item_type}
                                onValueChange={(v) => v && updateChecklistItem(index, { item_type: v as ChecklistItemInput['item_type'] })}
                              >
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  {schema?.item_types.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-300">Outcome Mode</label>
                              <Select
                                value={item.outcome_mode}
                                onValueChange={(v) => v && updateChecklistItem(index, { outcome_mode: v as ChecklistItemInput['outcome_mode'] })}
                              >
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  {schema?.outcome_modes.map((mode) => (
                                    <SelectItem key={mode} value={mode}>
                                      {mode === 'SimpleCompletion' ? 'Simple Completion' : mode === 'PassFail' ? 'Pass/Fail' : mode === 'PhotoProof' ? 'Photo Proof' : mode}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-300">Proof Requirement</label>
                              <Select
                                value={item.proof_requirement}
                                onValueChange={(v) => v && updateChecklistItem(index, { proof_requirement: v as ChecklistItemInput['proof_requirement'] })}
                              >
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  {schema?.proof_requirements.map((req) => (
                                    <SelectItem key={req} value={req}>
                                      {req}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-300">Weight</label>
                              <Input
                                type="number"
                                value={item.weight}
                                onChange={(e) =>
                                  updateChecklistItem(index, { weight: Number(e.target.value) })
                                }
                                className="bg-zinc-900 border-zinc-800 text-white"
                                min={0.1}
                                step={0.1}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Instructions (Optional)</label>
                            <textarea
                              value={item.instructions}
                              onChange={(e) =>
                                updateChecklistItem(index, { instructions: e.target.value })
                              }
                              placeholder="Detailed instructions for the operator..."
                              className="w-full rounded-md border border-zinc-800 bg-zinc-900 text-sm text-white p-3 min-h-[80px] resize-y"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Item Key</label>
                            <Input
                              value={item.item_key}
                              onChange={(e) =>
                                updateChecklistItem(index, { item_key: e.target.value })
                              }
                              placeholder="Unique identifier for this item"
                              className="bg-zinc-900 border-zinc-800 text-white"
                            />
                          </div>

                          {item.proof_requirement !== 'None' && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Proof Media Type</label>
                                <Select
                                  value={item.proof_media_type}
                                  onValueChange={(v) => v && updateChecklistItem(index, { proof_media_type: v as ChecklistItemInput['proof_media_type'] })}
                                >
                                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-zinc-800">
                                    {schema?.proof_media_types.map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Capture Mode</label>
                                <Select
                                  value={item.proof_capture_mode}
                                  onValueChange={(v) => v && updateChecklistItem(index, { proof_capture_mode: v as ChecklistItemInput['proof_capture_mode'] })}
                                >
                                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-zinc-800">
                                    {schema?.proof_capture_modes.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {m === 'CameraOnly' ? 'Camera Only' : 'Any'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => moveItem(index, 'up')}
                                disabled={index === 0}
                                className="border-zinc-700 text-zinc-400"
                              >
                                Move Up
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => moveItem(index, 'down')}
                                disabled={index === checklistItems.length - 1}
                                className="border-zinc-700 text-zinc-400"
                              >
                                Move Down
                              </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeChecklistItem(index)}
                              className="border-rose-800 text-rose-400 hover:bg-rose-950"
                            >
                              <Trash2 size={14} className="mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
