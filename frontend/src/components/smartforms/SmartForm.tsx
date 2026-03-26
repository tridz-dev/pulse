import { useState, useCallback } from 'react';
import { FileScan, Sparkles, Wand2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AutoFillSuggestions, type FieldSuggestion } from './AutoFillSuggestions';
import { DocumentScanner } from '@/ocr/DocumentScanner';
import { useOCR, type OCRTemplate } from '@/ocr/useOCR';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface SmartFormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'checkbox';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  validation?: {
    pattern?: RegExp;
    min?: number;
    max?: number;
    message?: string;
  };
  aiHints?: string[];
}

interface SmartFormProps {
  fields: SmartFormField[];
  values: Record<string, string | number | boolean>;
  onChange: (fieldId: string, value: string | number | boolean) => void;
  onSubmit: (values: Record<string, string | number | boolean>) => void;
  title?: string;
  description?: string;
  ocrTemplate?: OCRTemplate;
  enableAI?: boolean;
  enableOCR?: boolean;
  className?: string;
}

export function SmartForm({
  fields,
  values,
  onChange,
  onSubmit,
  title,
  description,
  ocrTemplate,
  enableAI = true,
  enableOCR = true,
  className,
}: SmartFormProps) {
  const [suggestions, setSuggestions] = useState<FieldSuggestion[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { extractFormData, isProcessing: isOCRProcessing } = useOCR();

  // AI prediction for fields based on context
  const predictFieldValue = useCallback(
    async (field: SmartFormField, context: Record<string, unknown>): Promise<FieldSuggestion | null> => {
      // Simulate AI prediction - in production, this would call the backend
      await new Promise((resolve) => setTimeout(resolve, 300));

      const predictions: Record<string, string> = {
        department: context.department as string || 'Operations',
        location: context.branch as string || 'Main Branch',
        date: new Date().toISOString().split('T')[0],
        status: 'active',
      };

      if (predictions[field.id]) {
        return {
          fieldId: field.id,
          fieldName: field.label,
          suggestedValue: predictions[field.id],
          confidence: 75,
          source: 'ai',
          reason: 'Based on historical patterns and current context',
        };
      }

      return null;
    },
    []
  );

  // Generate AI suggestions for all fields
  const generateAISuggestions = useCallback(async () => {
    if (!enableAI) return;

    setIsPredicting(true);
    const newSuggestions: FieldSuggestion[] = [];

    const context = {
      ...values,
      timestamp: new Date().toISOString(),
      userRole: 'operator', // Would come from auth context
    };

    for (const field of fields) {
      // Skip fields that already have values
      if (values[field.id]) continue;

      const prediction = await predictFieldValue(field, context);
      if (prediction) {
        newSuggestions.push(prediction);
      }
    }

    setSuggestions((prev) => {
      const existingIds = new Set(prev.map((s) => s.fieldId));
      const filtered = newSuggestions.filter((s) => !existingIds.has(s.fieldId));
      return [...prev, ...filtered];
    });

    setIsPredicting(false);

    if (newSuggestions.length > 0) {
      toast.success(`Generated ${newSuggestions.length} AI suggestions`);
    } else {
      toast.info('No AI suggestions available for current fields');
    }
  }, [enableAI, fields, values, predictFieldValue]);

  // Handle document scan
  const handleDocumentCapture = useCallback(
    async (imageData: string) => {
      setIsScanning(false);

      const extractedFields = await extractFormData(imageData, ocrTemplate);

      if (extractedFields.length === 0) {
        toast.warning('No data could be extracted from the document');
        return;
      }

      // Convert extracted fields to suggestions
      const ocrSuggestions: FieldSuggestion[] = extractedFields
        .map((field) => {
          const formField = fields.find(
            (f) =>
              f.id.toLowerCase() === field.name.toLowerCase() ||
              f.label.toLowerCase().includes(field.name.toLowerCase())
          );

          if (!formField) return null;

          return {
            fieldId: formField.id,
            fieldName: formField.label,
            suggestedValue: field.value,
            confidence: field.confidence,
            source: 'ocr' as const,
            reason: `Extracted from scanned document`,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      setSuggestions((prev) => {
        const existingIds = new Set(prev.map((s) => s.fieldId));
        const filtered = ocrSuggestions.filter((s) => !existingIds.has(s.fieldId));
        return [...prev, ...filtered];
      });

      toast.success(`Extracted ${ocrSuggestions.length} fields from document`);
    },
    [extractFormData, ocrTemplate, fields]
  );

  // Apply a suggestion
  const applySuggestion = useCallback(
    (fieldId: string, value: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      let parsedValue: string | number | boolean = value;
      if (field.type === 'number') {
        parsedValue = parseFloat(value) || 0;
      } else if (field.type === 'checkbox') {
        parsedValue = value === 'true' || value === 'yes';
      }

      onChange(fieldId, parsedValue);
      setSuggestions((prev) => prev.filter((s) => s.fieldId !== fieldId));
      toast.success(`${field.label} filled`);
    },
    [fields, onChange]
  );

  // Apply all suggestions
  const applyAllSuggestions = useCallback(() => {
    suggestions.forEach((suggestion) => {
      applySuggestion(suggestion.fieldId, suggestion.suggestedValue);
    });
  }, [suggestions, applySuggestion]);

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((fieldId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.fieldId !== fieldId));
  }, []);

  // Dismiss all suggestions
  const dismissAllSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  // Validate field
  const validateField = useCallback(
    (field: SmartFormField, value: string | number | boolean): string | null => {
      if (field.required && !value) {
        return `${field.label} is required`;
      }

      if (field.validation?.pattern && typeof value === 'string') {
        if (!field.validation.pattern.test(value)) {
          return field.validation.message || `Invalid ${field.label}`;
        }
      }

      if (field.type === 'number' && typeof value === 'number') {
        if (field.validation?.min !== undefined && value < field.validation.min) {
          return `${field.label} must be at least ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          return `${field.label} must be at most ${field.validation.max}`;
        }
      }

      return null;
    },
    []
  );

  // Handle field change with validation
  const handleFieldChange = useCallback(
    (field: SmartFormField, value: string | number | boolean | null) => {
      const safeValue = value ?? '';
      onChange(field.id, safeValue);

      if (touched[field.id]) {
        const error = validateField(field, safeValue);
        setErrors((prev) => ({ ...prev, [field.id]: error || '' }));
      }
    },
    [onChange, touched, validateField]
  );

  // Handle field blur
  const handleFieldBlur = useCallback(
    (field: SmartFormField) => {
      setTouched((prev) => ({ ...prev, [field.id]: true }));
      const error = validateField(field, values[field.id]);
      setErrors((prev) => ({ ...prev, [field.id]: error || '' }));
    },
    [validateField, values]
  );

  // Context-aware dropdown suggestions
  const getContextualOptions = useCallback(
    (field: SmartFormField): Array<{ value: string; label: string }> => {
      // Add AI-suggested options based on context
      const baseOptions = field.options || [];

      // In a real implementation, these would come from AI analysis
      const contextualOptions: Array<{ value: string; label: string }> = [];

      if (field.id === 'department' && values.location) {
        // Suggest departments based on location
        contextualOptions.push(
          { value: 'operations', label: 'Operations (Suggested)' },
          { value: 'kitchen', label: 'Kitchen (Popular)' }
        );
      }

      return [...contextualOptions, ...baseOptions];
    },
    [values]
  );

  // Render field based on type
  const renderField = (field: SmartFormField) => {
    const value = values[field.id];
    const error = errors[field.id];
    const isTouched = touched[field.id];
    const hasSuggestion = suggestions.some((s) => s.fieldId === field.id);

    const baseInputClass = cn(
      'bg-zinc-950 border-zinc-800 text-white transition-all',
      isTouched && error && 'border-red-500 focus:border-red-500',
      hasSuggestion && !value && 'border-indigo-500/50'
    );

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            onBlur={() => handleFieldBlur(field)}
            placeholder={field.placeholder}
            className={cn(
              baseInputClass,
              'w-full min-h-[100px] rounded-md border p-3 text-sm resize-y'
            )}
          />
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => handleFieldChange(field, v)}
          >
            <SelectTrigger className={baseInputClass}>
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {getContextualOptions(field).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field, e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-zinc-400">{field.placeholder}</span>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={(value as number) || ''}
            onChange={(e) => handleFieldChange(field, parseFloat(e.target.value) || 0)}
            onBlur={() => handleFieldBlur(field)}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            className={baseInputClass}
          />
        );

      default:
        return (
          <Input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            onBlur={() => handleFieldBlur(field)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <>
      <Card className={cn('bg-[#141415] border-zinc-800', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle className="text-lg text-white">{title}</CardTitle>}
              {description && (
                <p className="text-sm text-zinc-400 mt-1">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {enableOCR && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsScanning(true)}
                  disabled={isOCRProcessing}
                  className="border-zinc-700"
                >
                  <FileScan className="h-4 w-4 mr-2" />
                  Fill from Document
                </Button>
              )}
              {enableAI && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateAISuggestions}
                  disabled={isPredicting}
                  className="border-indigo-500/30 text-indigo-400"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {isPredicting ? 'Thinking...' : 'AI Fill'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Suggestions panel */}
          <AutoFillSuggestions
            suggestions={suggestions}
            onApply={applySuggestion}
            onApplyAll={applyAllSuggestions}
            onDismiss={dismissSuggestion}
            onDismissAll={dismissAllSuggestions}
          />

          {/* Form fields */}
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className={cn(
                  'space-y-2',
                  field.type === 'textarea' && 'md:col-span-2'
                )}
              >
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-zinc-300">
                    {field.label}
                    {field.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </Label>
                  {suggestions.find((s) => s.fieldId === field.id) && (
                    <Badge
                      variant="outline"
                      className="text-xs border-indigo-500/30 text-indigo-400 cursor-pointer"
                      onClick={() => {
                        const s = suggestions.find((s) => s.fieldId === field.id);
                        if (s) applySuggestion(field.id, s.suggestedValue);
                      }}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Suggested
                    </Badge>
                  )}
                </div>
                {renderField(field)}
                {touched[field.id] && errors[field.id] && (
                  <div className="flex items-center gap-1 text-red-400 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {errors[field.id]}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit button */}
          <div className="flex justify-end pt-4 border-t border-zinc-800">
            <Button
              onClick={() => onSubmit(values)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Submit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document Scanner Modal */}
      {isScanning && (
        <DocumentScanner
          onCapture={handleDocumentCapture}
          onCancel={() => setIsScanning(false)}
        />
      )}
    </>
  );
}

export default SmartForm;
