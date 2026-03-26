import { useState, useCallback } from 'react';
import { 
  Upload, FileSpreadsheet, FileText, CheckCircle, AlertCircle, 
  ChevronRight, ChevronLeft, Download, RefreshCw, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress, ProgressValue, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { toast } from 'sonner';

type ImportStep = 1 | 2 | 3 | 4;
type DocType = 'employees' | 'templates' | 'branches' | '';
type ImportStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface ColumnMapping {
  fileColumn: string;
  fieldName: string;
  required: boolean;
}

interface PreviewRow {
  [key: string]: string | number | null;
}

const DOCTYPE_OPTIONS = [
  { value: 'employees', label: 'Employees', description: 'Import employee data with assignments' },
  { value: 'templates', label: 'SOP Templates', description: 'Import SOP templates and checklists' },
  { value: 'branches', label: 'Branches', description: 'Import branch locations and settings' },
];

const FIELD_MAPPINGS: Record<string, ColumnMapping[]> = {
  employees: [
    { fileColumn: '', fieldName: 'employee_name', required: true },
    { fileColumn: '', fieldName: 'email', required: true },
    { fileColumn: '', fieldName: 'phone', required: false },
    { fileColumn: '', fieldName: 'designation', required: false },
    { fileColumn: '', fieldName: 'department', required: false },
    { fileColumn: '', fieldName: 'branch', required: false },
  ],
  templates: [
    { fileColumn: '', fieldName: 'template_name', required: true },
    { fileColumn: '', fieldName: 'description', required: false },
    { fileColumn: '', fieldName: 'department', required: false },
    { fileColumn: '', fieldName: 'frequency', required: true },
    { fileColumn: '', fieldName: 'checklist_items', required: false },
  ],
  branches: [
    { fileColumn: '', fieldName: 'branch_name', required: true },
    { fileColumn: '', fieldName: 'branch_code', required: true },
    { fileColumn: '', fieldName: 'city', required: false },
    { fileColumn: '', fieldName: 'state', required: false },
    { fileColumn: '', fieldName: 'manager_email', required: false },
  ],
};

const SAMPLE_PREVIEW: PreviewRow[] = [
  { employee_name: 'John Doe', email: 'john@example.com', phone: '+1234567890', designation: 'Manager', department: 'Sales', branch: 'HQ' },
  { employee_name: 'Jane Smith', email: 'jane@example.com', phone: '+0987654321', designation: 'Staff', department: 'Ops', branch: 'Branch A' },
];

export function ImportWizard() {
  const [currentStep, setCurrentStep] = useState<ImportStep>(1);
  const [selectedDocType, setSelectedDocType] = useState<DocType>('');
  const [file, setFile] = useState<File | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      // Simulate parsing and generate preview
      setColumnMappings(FIELD_MAPPINGS[selectedDocType] || []);
      setPreviewData(SAMPLE_PREVIEW);
      toast.success('File uploaded successfully');
    } else {
      toast.error('Please upload a CSV or Excel file');
    }
  }, [selectedDocType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setColumnMappings(FIELD_MAPPINGS[selectedDocType] || []);
      setPreviewData(SAMPLE_PREVIEW);
      toast.success('File uploaded successfully');
    }
  };

  const handleDownloadTemplate = () => {
    if (!selectedDocType) return;
    const headers = FIELD_MAPPINGS[selectedDocType]?.map(f => f.fieldName).join(',') || '';
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedDocType}_import_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Template downloaded');
  };

  const handleMappingChange = (index: number, fileColumn: string | null) => {
    const newMappings = [...columnMappings];
    newMappings[index] = { ...newMappings[index], fileColumn: fileColumn || '' };
    setColumnMappings(newMappings);
  };

  const handleImport = async () => {
    setImportStatus('processing');
    setProgress(0);

    // Simulate import progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setImportStatus('completed');
          setImportResult({ success: 45, failed: 2, errors: ['Row 12: Invalid email format', 'Row 28: Duplicate entry'] });
          toast.success('Import completed successfully');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!selectedDocType;
      case 2: return !!file;
      case 3: return columnMappings.every(m => !m.required || m.fileColumn);
      case 4: return importStatus === 'completed';
      default: return false;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the type of data you want to import:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DOCTYPE_OPTIONS.map((option) => (
          <Card
            key={option.value}
            className={`cursor-pointer transition-all ${
              selectedDocType === option.value 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedDocType(option.value as DocType)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedDocType === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {option.value === 'employees' && <FileText className="w-5 h-5" />}
                  {option.value === 'templates' && <FileSpreadsheet className="w-5 h-5" />}
                  {option.value === 'branches' && <MapPin className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-medium">{option.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload your CSV or Excel file, or download a template to get started:
        </p>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </Button>
      </div>
      
      <div
        onDrop={handleFileDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          file ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
        }`}
      >
        {file ? (
          <div className="space-y-2">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-primary" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
              Remove file
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">Drag and drop your file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
              Select File
            </Button>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">Supported formats:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• CSV files (.csv)</li>
          <li>• Excel files (.xlsx, .xls)</li>
          <li>• Maximum file size: 10MB</li>
        </ul>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Map columns from your file to the corresponding fields:
      </p>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field Name</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>File Column</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columnMappings.map((mapping, index) => (
              <TableRow key={mapping.fieldName}>
                <TableCell className="font-medium">
                  {mapping.fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </TableCell>
                <TableCell>
                  {mapping.required ? (
                    <span className="text-destructive text-xs font-medium">Required</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Optional</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping.fileColumn || 'unmapped'}
                    onValueChange={(value) => handleMappingChange(index, value === 'unmapped' ? '' : value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">-- Not mapped --</SelectItem>
                      <SelectItem value="col_a">Column A</SelectItem>
                      <SelectItem value="col_b">Column B</SelectItem>
                      <SelectItem value="col_c">Column C</SelectItem>
                      <SelectItem value="col_d">Column D</SelectItem>
                      <SelectItem value="col_e">Column E</SelectItem>
                      <SelectItem value="col_f">Column F</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Data Preview (first 2 rows):</h4>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {Object.keys(previewData[0] || {}).map((key) => (
                  <TableHead key={key}>{key}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((row, idx) => (
                <TableRow key={idx}>
                  {Object.values(row).map((value, vIdx) => (
                    <TableCell key={vIdx}>{value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      {importStatus === 'idle' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium">Ready to Import</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Review your settings and click Import to begin
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-left max-w-md mx-auto">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <span className="text-muted-foreground">Document Type:</span>
              <span className="font-medium">
                {DOCTYPE_OPTIONS.find(o => o.value === selectedDocType)?.label}
              </span>
              <span className="text-muted-foreground">File:</span>
              <span className="font-medium">{file?.name}</span>
              <span className="text-muted-foreground">Records:</span>
              <span className="font-medium">47 rows</span>
            </div>
          </div>
          <Button onClick={handleImport} size="lg">
            <Upload className="w-4 h-4 mr-2" />
            Start Import
          </Button>
        </div>
      )}

      {(importStatus === 'processing' || importStatus === 'uploading') && (
        <div className="space-y-4 text-center">
          <RefreshCw className="w-12 h-12 mx-auto animate-spin text-primary" />
          <div>
            <h3 className="text-lg font-medium">Importing Data...</h3>
            <p className="text-sm text-muted-foreground">Please do not close this window</p>
          </div>
          <div className="max-w-md mx-auto">
            <Progress value={progress}>
              <ProgressValue />
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>
          </div>
        </div>
      )}

      {importStatus === 'completed' && importResult && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium mt-4">Import Complete!</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.success}</p>
                <p className="text-sm text-green-700">Successfully imported</p>
              </CardContent>
            </Card>
            <Card className={importResult.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-muted'}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-bold ${importResult.failed > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {importResult.failed}
                </p>
                <p className={`text-sm ${importResult.failed > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                  Failed
                </p>
              </CardContent>
            </Card>
          </div>

          {importResult.errors.length > 0 && (
            <div className="max-w-md mx-auto">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Errors ({importResult.errors.length})
              </h4>
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1">
                {importResult.errors.map((error, idx) => (
                  <p key={idx} className="text-sm text-destructive">{error}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => {
              setCurrentStep(1);
              setSelectedDocType('');
              setFile(null);
              setImportStatus('idle');
              setImportResult(null);
            }}>
              Import Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Import Wizard</CardTitle>
        <CardDescription>Import data into Pulse in 4 simple steps</CardDescription>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mt-6">
          {[1, 2, 3, 4].map((step, idx) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep >= step 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
              </div>
              <div className="hidden sm:block ml-2 text-sm">
                {step === 1 && 'Select Type'}
                {step === 2 && 'Upload File'}
                {step === 3 && 'Map Columns'}
                {step === 4 && 'Execute'}
              </div>
              {idx < 3 && (
                <div className={`w-12 sm:w-16 h-0.5 mx-2 sm:mx-4 transition-colors ${
                  currentStep > step ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Navigation */}
        {importStatus !== 'processing' && importStatus !== 'completed' && (
          <div className="flex justify-between mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1) as ImportStep)}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={() => setCurrentStep(prev => Math.min(4, prev + 1) as ImportStep)}
              disabled={!canProceed()}
            >
              {currentStep === 4 ? 'Finish' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
