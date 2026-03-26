import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileScan,
  Upload,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DocumentScanner } from '@/ocr/DocumentScanner';
import { useOCR, type OCRTemplate, type ExtractedField } from '@/ocr/useOCR';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Template {
  name: string;
  title: string;
  description: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

const STEPS = [
  { id: 'capture', label: 'Capture' },
  { id: 'template', label: 'Template' },
  { id: 'process', label: 'Processing' },
  { id: 'review', label: 'Review' },
  { id: 'import', label: 'Import' },
];

export function DocumentImport() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'ocr', label: 'Text Recognition', status: 'pending' },
    { id: 'extract', label: 'Data Extraction', status: 'pending' },
    { id: 'validate', label: 'Validation', status: 'pending' },
  ]);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);

  const { extractFormData, isProcessing: isOCRProcessing } = useOCR();

  // Fetch templates on mount
  const fetchTemplates = useCallback(async () => {
    // In production, this would fetch from the API
    const mockTemplates: Template[] = [
      {
        name: 'daily_cleaning',
        title: 'Daily Cleaning Checklist',
        description: 'Standard daily cleaning verification form',
      },
      {
        name: 'opening_checklist',
        title: 'Opening Checklist',
        description: 'Pre-opening procedures and checks',
      },
      {
        name: 'closing_checklist',
        title: 'Closing Checklist',
        description: 'End-of-day closing procedures',
      },
      {
        name: 'equipment_inspection',
        title: 'Equipment Inspection',
        description: 'Equipment safety and functionality check',
      },
    ];
    setTemplates(mockTemplates);
  }, []);

  // Handle document capture
  const handleCapture = useCallback((imageData: string) => {
    setCapturedImage(imageData);
    setIsScanning(false);
    setCurrentStep(1);
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCapturedImage(result);
      setCurrentStep(1);
      fetchTemplates();
    };
    reader.readAsDataURL(file);
  }, [fetchTemplates]);

  // Start OCR processing
  const startProcessing = useCallback(async () => {
    if (!capturedImage) return;

    setCurrentStep(2);

    // Update processing steps
    setProcessingSteps((steps) =>
      steps.map((s) => (s.id === 'ocr' ? { ...s, status: 'processing' } : s))
    );

    // Get template configuration
    const templateConfig: OCRTemplate | undefined = selectedTemplate
      ? {
          name: selectedTemplate,
          fields: [
            { name: 'date', type: 'date', patterns: ['Date:', 'Date', 'Date:'] },
            { name: 'employee_name', type: 'text', patterns: ['Employee:', 'Name:', 'Staff:'] },
            { name: 'location', type: 'text', patterns: ['Location:', 'Branch:', 'Site:'] },
            { name: 'completed_items', type: 'array', patterns: ['[x]', '[✓]', '[✔]'] },
          ],
        }
      : undefined;

    try {
      const fields = await extractFormData(capturedImage, templateConfig);

      setProcessingSteps((steps) =>
        steps.map((s) =>
          s.id === 'ocr'
            ? { ...s, status: 'completed' }
            : s.id === 'extract'
            ? { ...s, status: 'processing' }
            : s
        )
      );

      // Simulate extraction delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      setExtractedFields(fields);
      setEditedFields(
        fields.reduce((acc, field) => ({ ...acc, [field.name]: field.value }), {})
      );

      setProcessingSteps((steps) =>
        steps.map((s) =>
          s.id === 'extract'
            ? { ...s, status: 'completed' }
            : s.id === 'validate'
            ? { ...s, status: 'processing' }
            : s
        )
      );

      // Simulate validation
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProcessingSteps((steps) =>
        steps.map((s) => (s.id === 'validate' ? { ...s, status: 'completed' } : s))
      );

      setCurrentStep(3);
    } catch (error) {
      toast.error('Processing failed. Please try again.');
      setProcessingSteps((steps) =>
        steps.map((s) => (s.status === 'processing' ? { ...s, status: 'error' } : s))
      );
    }
  }, [capturedImage, selectedTemplate, extractFormData]);

  // Handle field edit
  const handleFieldEdit = useCallback((fieldName: string, value: string) => {
    setEditedFields((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setCurrentStep(4);

    try {
      // In production, this would call the API to create the SOP run
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success('Document imported successfully!');
      navigate('/operations');
    } catch (error) {
      toast.error('Import failed. Please try again.');
      setIsImporting(false);
    }
  }, [editedFields, navigate]);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500/20 text-green-400';
    if (confidence >= 60) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Capture
        return (
          <div className="space-y-6">
            <Card className="bg-[#141415] border-zinc-800">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Camera option */}
                  <button
                    onClick={() => setIsScanning(true)}
                    className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center transition-all hover:border-indigo-500/50 hover:bg-zinc-900"
                  >
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20">
                      <FileScan className="h-8 w-8 text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Scan with Camera
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Use your device camera to scan the document
                    </p>
                  </button>

                  {/* Upload option */}
                  <label className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center transition-all hover:border-indigo-500/50 hover:bg-zinc-900 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
                      <Upload className="h-8 w-8 text-zinc-400 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Upload File
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Upload an image or PDF from your device
                    </p>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1: // Template
        return (
          <div className="space-y-6">
            {capturedImage && (
              <Card className="bg-[#141415] border-zinc-800">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <img
                      src={capturedImage}
                      alt="Captured document"
                      className="w-48 h-32 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-zinc-300 mb-2">
                        Captured Document
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsScanning(true)}
                        className="text-zinc-400"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Retake
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Select Template</CardTitle>
                <CardDescription className="text-zinc-400">
                  Choose a template that matches your document type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v || '')}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="">Auto-detect (no template)</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        <div className="flex flex-col items-start">
                          <span>{template.title}</span>
                          <span className="text-xs text-zinc-500">
                            {template.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={startProcessing}
                    disabled={isOCRProcessing}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isOCRProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Continue
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Processing
        return (
          <div className="space-y-6">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Processing Document</CardTitle>
                <CardDescription className="text-zinc-400">
                  Extracting and analyzing document content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {processingSteps.map((step, index) => (
                  <div key={step.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                            step.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : step.status === 'processing'
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : step.status === 'error'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-zinc-800 text-zinc-500'
                          )}
                        >
                          {step.status === 'completed' ? (
                            <Check className="h-4 w-4" />
                          ) : step.status === 'processing' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : step.status === 'error' ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span
                          className={cn(
                            'text-sm',
                            step.status === 'pending'
                              ? 'text-zinc-500'
                              : 'text-zinc-200'
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                      {step.status === 'completed' && (
                        <Badge
                          variant="outline"
                          className="text-xs border-green-500/30 text-green-400"
                        >
                          Done
                        </Badge>
                      )}
                    </div>
                    {step.status === 'processing' && (
                      <Progress value={45} className="h-1" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 3: // Review
        return (
          <div className="space-y-6">
            <Card className="bg-[#141415] border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Review Extracted Data</CardTitle>
                <CardDescription className="text-zinc-400">
                  Verify and edit the extracted information before importing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {extractedFields.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No fields were automatically extracted.</p>
                    <p className="text-sm">You can proceed to enter data manually.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {extractedFields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-zinc-300 capitalize">
                            {field.name.replace(/_/g, ' ')}
                          </label>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              getConfidenceColor(field.confidence)
                            )}
                          >
                            {field.confidence}% confidence
                          </Badge>
                        </div>
                        <Input
                          value={editedFields[field.name] || ''}
                          onChange={(e) =>
                            handleFieldEdit(field.name, e.target.value)
                          }
                          className={cn(
                            'bg-zinc-950 border-zinc-800 text-white',
                            field.confidence < 60 && 'border-yellow-500/50'
                          )}
                        />
                        {field.confidence < 60 && (
                          <p className="text-xs text-yellow-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Low confidence - please verify
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t border-zinc-800">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    className="border-zinc-700"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Start Over
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Import to SOP
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4: // Import
        return (
          <div className="space-y-6">
            <Card className="bg-[#141415] border-zinc-800">
              <CardContent className="pt-6 text-center py-12">
                {isImporting ? (
                  <>
                    <Loader2 className="h-16 w-16 text-indigo-400 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                      Importing Document...
                    </h3>
                    <p className="text-zinc-400">Creating SOP run from extracted data</p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                      <Check className="h-8 w-8 text-green-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Import Complete!
                    </h3>
                    <p className="text-zinc-400 mb-6">
                      Your document has been successfully imported as an SOP run
                    </p>
                    <Button
                      onClick={() => navigate('/operations')}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      View Operations
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Document Import
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Scan and import documents into SOP runs
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    index < currentStep
                      ? 'bg-indigo-600 text-white'
                      : index === currentStep
                      ? 'bg-indigo-600/20 text-indigo-400 border-2 border-indigo-600'
                      : 'bg-zinc-800 text-zinc-500'
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1 hidden sm:block',
                    index <= currentStep ? 'text-zinc-300' : 'text-zinc-600'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-full sm:w-16 h-0.5 mx-2',
                    index < currentStep ? 'bg-indigo-600' : 'bg-zinc-800'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {renderStepContent()}

      {/* Document Scanner Modal */}
      {isScanning && (
        <DocumentScanner
          onCapture={handleCapture}
          onCancel={() => setIsScanning(false)}
          autoCapture={true}
        />
      )}
    </div>
  );
}

export default DocumentImport;
