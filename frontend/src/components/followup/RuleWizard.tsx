import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
    ChevronRight, 
    ChevronLeft, 
    Check, 
    FileText, 
    Zap, 
    Settings, 
    ArrowRight,
    Target,
    User,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Template {
    name: string;
    title: string;
    department: string;
    item_count: number;
}

interface TriggerOption {
    value: string;
    label: string;
    description: string;
}

interface ActionOption {
    value: string;
    label: string;
    description: string;
}

interface AssigneeOption {
    value: string;
    label: string;
    description: string;
}

interface ChecklistItem {
    key: string;
    description: string;
    type: string;
    is_required: number;
}

interface RuleWizardProps {
    rule?: {
        name: string;
        source_template: string;
        source_template_title?: string;
        trigger_on: string;
        source_item_key: string;
        action: string;
        target_template: string;
        target_template_title?: string;
        target_assignee: string;
        is_active: number;
    } | null;
    onSuccess: () => void;
    onCancel: () => void;
}

interface WizardState {
    source_template: string;
    trigger_on: string;
    source_item_key: string;
    action: string;
    target_template: string;
    target_assignee: string;
    is_active: boolean;
}

const steps = [
    { id: 1, title: 'Source Template', icon: FileText },
    { id: 2, title: 'Trigger', icon: Zap },
    { id: 3, title: 'Conditions', icon: Settings },
    { id: 4, title: 'Action', icon: Target },
    { id: 5, title: 'Review', icon: Check },
];

export function RuleWizard({ rule, onSuccess, onCancel }: RuleWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [state, setState] = useState<WizardState>({
        source_template: '',
        trigger_on: 'ItemOutcomeFail',
        source_item_key: '',
        action: 'CreateRun',
        target_template: '',
        target_assignee: 'SameEmployee',
        is_active: true,
    });

    // Initialize with rule data if editing
    useEffect(() => {
        if (rule) {
            setState({
                source_template: rule.source_template,
                trigger_on: rule.trigger_on,
                source_item_key: rule.source_item_key,
                action: rule.action,
                target_template: rule.target_template,
                target_assignee: rule.target_assignee,
                is_active: rule.is_active === 1,
            });
        }
    }, [rule]);

    // Fetch templates
    const { data: templates = [] } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const response = await fetch('/api/method/pulse.api.templates.get_templates?include_items=false');
            const data = await response.json();
            return data.message || [];
        }
    });

    // Fetch trigger options
    const { data: triggerOptions = [] } = useQuery({
        queryKey: ['trigger-options'],
        queryFn: async () => {
            const response = await fetch('/api/method/pulse.api.follow_up_rules.get_trigger_options');
            const data = await response.json();
            return data.message || [];
        }
    });

    // Fetch action options
    const { data: actionOptions = [] } = useQuery({
        queryKey: ['action-options'],
        queryFn: async () => {
            const response = await fetch('/api/method/pulse.api.follow_up_rules.get_action_options');
            const data = await response.json();
            return data.message || [];
        }
    });

    // Fetch assignee options
    const { data: assigneeOptions = [] } = useQuery({
        queryKey: ['assignee-options'],
        queryFn: async () => {
            const response = await fetch('/api/method/pulse.api.follow_up_rules.get_assignee_options');
            const data = await response.json();
            return data.message || [];
        }
    });

    // Fetch checklist items for selected source template
    const { data: checklistItems = [] } = useQuery({
        queryKey: ['template-items', state.source_template],
        queryFn: async () => {
            if (!state.source_template) return [];
            const response = await fetch('/api/method/pulse.api.follow_up_rules.get_template_checklist_items?template_name=' + state.source_template);
            const data = await response.json();
            return data.message || [];
        },
        enabled: !!state.source_template && currentStep >= 3
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const values = {
                source_template: state.source_template,
                trigger_on: state.trigger_on,
                source_item_key: state.source_item_key,
                action: state.action,
                target_template: state.target_template,
                target_assignee: state.target_assignee,
                is_active: state.is_active ? 1 : 0,
            };

            if (rule) {
                const response = await fetch('/api/method/pulse.api.follow_up_rules.update_rule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rule_name: rule.name, values })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to update rule');
                return data.message;
            } else {
                const response = await fetch('/api/method/pulse.api.follow_up_rules.create_rule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to create rule');
                return data.message;
            }
        },
        onSuccess: () => {
            toast.success(rule ? 'Follow-up rule updated successfully' : 'Follow-up rule created successfully');
            onSuccess();
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return !!state.source_template;
            case 2:
                return !!state.trigger_on;
            case 3:
                return state.trigger_on !== 'ItemOutcomeFail' || !!state.source_item_key;
            case 4:
                return !!state.target_template && !!state.action;
            default:
                return true;
        }
    };

    const handleNext = () => {
        if (currentStep < 5) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSave = () => {
        saveMutation.mutate();
    };

    const selectedSourceTemplate = templates.find((t: Template) => t.name === state.source_template);
    const selectedTargetTemplate = templates.find((t: Template) => t.name === state.target_template);
    const selectedTrigger = triggerOptions.find((t: TriggerOption) => t.value === state.trigger_on);
    const selectedAction = actionOptions.find((a: ActionOption) => a.value === state.action);
    const selectedAssignee = assigneeOptions.find((a: AssigneeOption) => a.value === state.target_assignee);

    return (
        <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const isActive = step.id === currentStep;
                    const isCompleted = step.id < currentStep;
                    
                    return (
                        <div key={step.id} className="flex items-center">
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                                isActive && "bg-indigo-500/20 text-indigo-400",
                                isCompleted && "text-emerald-400",
                                !isActive && !isCompleted && "text-zinc-500"
                            )}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                    isActive && "bg-indigo-500 text-white",
                                    isCompleted && "bg-emerald-500 text-white",
                                    !isActive && !isCompleted && "bg-zinc-800 text-zinc-500"
                                )}>
                                    {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                                </div>
                                {!isActive && !isCompleted ? null : (
                                    <span className="hidden sm:block text-sm font-medium">{step.title}</span>
                                )}
                            </div>
                            {index < steps.length - 1 && (
                                <ChevronRight className="w-4 h-4 text-zinc-600 mx-1" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="min-h-[300px]">
                {/* Step 1: Source Template */}
                {currentStep === 1 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-100">Select Source Template</h3>
                        <p className="text-sm text-zinc-400">
                            Choose the SOP template that will trigger this rule when completed
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
                            {templates.map((template: Template) => (
                                <Card
                                    key={template.name}
                                    className={cn(
                                        "cursor-pointer transition-all hover:border-indigo-500/50",
                                        state.source_template === template.name 
                                            ? "border-indigo-500 bg-indigo-500/10" 
                                            : "border-zinc-800 bg-zinc-900"
                                    )}
                                    onClick={() => setState({ ...state, source_template: template.name })}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-medium text-zinc-100">{template.title}</h4>
                                                <p className="text-sm text-zinc-500 mt-1">{template.department}</p>
                                                <Badge variant="secondary" className="mt-2 bg-zinc-800 text-zinc-400">
                                                    {template.item_count} items
                                                </Badge>
                                            </div>
                                            {state.source_template === template.name && (
                                                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Trigger */}
                {currentStep === 2 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-100">Select Trigger Condition</h3>
                        <p className="text-sm text-zinc-400">
                            When should this rule be activated?
                        </p>
                        
                        <div className="space-y-3">
                            {triggerOptions.map((option: TriggerOption) => (
                                <Card
                                    key={option.value}
                                    className={cn(
                                        "cursor-pointer transition-all hover:border-indigo-500/50",
                                        state.trigger_on === option.value 
                                            ? "border-indigo-500 bg-indigo-500/10" 
                                            : "border-zinc-800 bg-zinc-900"
                                    )}
                                    onClick={() => setState({ ...state, trigger_on: option.value })}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                                state.trigger_on === option.value 
                                                    ? "bg-indigo-500/20" 
                                                    : "bg-zinc-800"
                                            )}>
                                                <Zap className={cn(
                                                    "w-5 h-5",
                                                    state.trigger_on === option.value 
                                                        ? "text-indigo-400" 
                                                        : "text-zinc-500"
                                                )} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium text-zinc-100">{option.label}</h4>
                                                <p className="text-sm text-zinc-500">{option.description}</p>
                                            </div>
                                            {state.trigger_on === option.value && (
                                                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Conditions */}
                {currentStep === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-100">Set Conditions</h3>
                        <p className="text-sm text-zinc-400">
                            Configure specific conditions for the trigger
                        </p>
                        
                        {state.trigger_on === 'ItemOutcomeFail' && (
                            <div className="space-y-3">
                                <Label className="text-zinc-300">Select Checklist Item</Label>
                                <p className="text-sm text-zinc-500">
                                    Which item should trigger this rule when it fails?
                                </p>
                                
                                {checklistItems.length === 0 ? (
                                    <div className="p-4 bg-zinc-800/50 rounded-lg text-zinc-500 text-center">
                                        No checklist items available for this template
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {checklistItems.map((item: ChecklistItem) => (
                                            <Card
                                                key={item.key}
                                                className={cn(
                                                    "cursor-pointer transition-all hover:border-indigo-500/50",
                                                    state.source_item_key === item.key 
                                                        ? "border-indigo-500 bg-indigo-500/10" 
                                                        : "border-zinc-800 bg-zinc-900"
                                                )}
                                                onClick={() => setState({ ...state, source_item_key: item.key })}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="font-mono text-xs text-zinc-500">{item.key}</div>
                                                        <div className="flex-1 text-sm text-zinc-300">{item.description}</div>
                                                        {item.is_required && (
                                                            <Badge className="bg-amber-500/20 text-amber-400">Required</Badge>
                                                        )}
                                                        {state.source_item_key === item.key && (
                                                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                                <Check className="w-3 h-3 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {state.trigger_on === 'ScoreBelow' && (
                            <div className="space-y-3">
                                <Label className="text-zinc-300">Score Threshold</Label>
                                <p className="text-sm text-zinc-500">
                                    Rule will trigger when the overall score falls below this percentage
                                </p>
                                <div className="flex items-center gap-4">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="e.g., 70"
                                        className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-[150px]"
                                    />
                                    <span className="text-zinc-400">%</span>
                                </div>
                            </div>
                        )}
                        
                        {state.trigger_on === 'AnyOutcomeFail' && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Condition Set</span>
                                </div>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Rule will trigger when any checklist item fails in the source SOP
                                </p>
                            </div>
                        )}
                        
                        {state.trigger_on === 'CompletionOverdue' && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Condition Set</span>
                                </div>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Rule will trigger when the SOP completion is overdue
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Action */}
                {currentStep === 4 && (
                    <div className="space-y-6">
                        {/* Action Type */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-zinc-100">Select Action</h3>
                            <p className="text-sm text-zinc-400">
                                What should happen when the trigger condition is met?
                            </p>
                            
                            <div className="space-y-3">
                                {actionOptions.map((option: ActionOption) => (
                                    <Card
                                        key={option.value}
                                        className={cn(
                                            "cursor-pointer transition-all hover:border-indigo-500/50",
                                            state.action === option.value 
                                                ? "border-indigo-500 bg-indigo-500/10" 
                                                : "border-zinc-800 bg-zinc-900"
                                        )}
                                        onClick={() => setState({ ...state, action: option.value })}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                                    state.action === option.value 
                                                        ? "bg-indigo-500/20" 
                                                        : "bg-zinc-800"
                                                )}>
                                                    <Target className={cn(
                                                        "w-5 h-5",
                                                        state.action === option.value 
                                                            ? "text-indigo-400" 
                                                            : "text-zinc-500"
                                                    )} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-zinc-100">{option.label}</h4>
                                                    <p className="text-sm text-zinc-500">{option.description}</p>
                                                </div>
                                                {state.action === option.value && (
                                                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* Target Template */}
                        {state.action === 'CreateRun' && (
                            <div className="space-y-3">
                                <Label className="text-zinc-300">Target Template</Label>
                                <p className="text-sm text-zinc-500">
                                    Which SOP template should be used for the follow-up run?
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto p-1">
                                    {templates.map((template: Template) => (
                                        <Card
                                            key={template.name}
                                            className={cn(
                                                "cursor-pointer transition-all hover:border-indigo-500/50",
                                                state.target_template === template.name 
                                                    ? "border-indigo-500 bg-indigo-500/10" 
                                                    : "border-zinc-800 bg-zinc-900"
                                            )}
                                            onClick={() => setState({ ...state, target_template: template.name })}
                                        >
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-medium text-zinc-100 text-sm">{template.title}</h4>
                                                        <p className="text-xs text-zinc-500">{template.department}</p>
                                                    </div>
                                                    {state.target_template === template.name && (
                                                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Target Assignee */}
                        <div className="space-y-3">
                            <Label className="text-zinc-300">Assign To</Label>
                            <p className="text-sm text-zinc-500">
                                Who should be assigned to the follow-up action?
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {assigneeOptions.map((option: AssigneeOption) => (
                                    <Card
                                        key={option.value}
                                        className={cn(
                                            "cursor-pointer transition-all hover:border-indigo-500/50",
                                            state.target_assignee === option.value 
                                                ? "border-indigo-500 bg-indigo-500/10" 
                                                : "border-zinc-800 bg-zinc-900"
                                        )}
                                        onClick={() => setState({ ...state, target_assignee: option.value })}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                                    state.target_assignee === option.value 
                                                        ? "bg-indigo-500/20" 
                                                        : "bg-zinc-800"
                                                )}>
                                                    <User className={cn(
                                                        "w-5 h-5",
                                                        state.target_assignee === option.value 
                                                            ? "text-indigo-400" 
                                                            : "text-zinc-500"
                                                    )} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-zinc-100 text-sm">{option.label}</h4>
                                                    <p className="text-xs text-zinc-500">{option.description}</p>
                                                </div>
                                                {state.target_assignee === option.value && (
                                                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-100">Review & Save</h3>
                        <p className="text-sm text-zinc-400">
                            Review your rule configuration before saving
                        </p>
                        
                        <div className="space-y-4 bg-zinc-800/50 rounded-lg p-4">
                            <div className="flex items-center gap-3 pb-4 border-b border-zinc-700">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase">Source Template</p>
                                    <p className="text-zinc-100 font-medium">{selectedSourceTemplate?.title || state.source_template}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-center">
                                <ArrowRight className="w-5 h-5 text-zinc-500" />
                            </div>
                            
                            <div className="flex items-center gap-3 pb-4 border-b border-zinc-700">
                                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase">Trigger</p>
                                    <p className="text-zinc-100 font-medium">{selectedTrigger?.label || state.trigger_on}</p>
                                    {state.source_item_key && (
                                        <p className="text-xs text-zinc-400">Item: {state.source_item_key}</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-center">
                                <ArrowRight className="w-5 h-5 text-zinc-500" />
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <Target className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase">Action</p>
                                    <p className="text-zinc-100 font-medium">{selectedAction?.label || state.action}</p>
                                    {state.target_template && (
                                        <p className="text-xs text-zinc-400">
                                            Target: {selectedTargetTemplate?.title || state.target_template}
                                        </p>
                                    )}
                                    <p className="text-xs text-zinc-400">
                                        Assignee: {selectedAssignee?.label || state.target_assignee}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-lg">
                            <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                state.is_active ? "bg-emerald-500/20" : "bg-zinc-700"
                            )}>
                                {state.is_active ? (
                                    <Check className="w-5 h-5 text-emerald-400" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-zinc-500" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-zinc-100 font-medium">
                                    {state.is_active ? 'Rule will be active' : 'Rule will be inactive'}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {state.is_active 
                                        ? 'This rule will execute when conditions are met' 
                                        : 'This rule will not execute until enabled'}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setState({ ...state, is_active: !state.is_active })}
                                className={cn(
                                    "border-zinc-700",
                                    state.is_active 
                                        ? "text-emerald-400 hover:text-emerald-300" 
                                        : "text-zinc-400 hover:text-zinc-300"
                                )}
                            >
                                {state.is_active ? 'Active' : 'Inactive'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t border-zinc-800">
                <Button
                    variant="outline"
                    onClick={currentStep === 1 ? onCancel : handleBack}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                    {currentStep === 1 ? 'Cancel' : (
                        <>
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Back
                        </>
                    )}
                </Button>
                
                {currentStep < 5 ? (
                    <Button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                {rule ? 'Update Rule' : 'Create Rule'}
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
