import { useState } from 'react';
import { 
  Download, FileSpreadsheet, FileText, FileCode, Calendar, 
  Filter, X, ChevronDown, Building2, Users, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type ExportFormat = 'excel' | 'csv' | 'pdf';
type EntityType = 'employees' | 'templates' | 'branches' | 'runs' | 'scores';

interface FilterOption {
  id: string;
  label: string;
  value: string;
  options?: { value: string; label: string }[];
}

interface ExportConfig {
  entity: EntityType;
  format: ExportFormat;
  filters: Record<string, string>;
  dateRange: { from: string; to: string };
  includeHeaders: boolean;
}

const ENTITY_OPTIONS: { value: EntityType; label: string; icon: typeof Building2; description: string }[] = [
  { value: 'employees', label: 'Employees', icon: Users, description: 'Export employee data and assignments' },
  { value: 'templates', label: 'SOP Templates', icon: FileCheck, description: 'Export template definitions' },
  { value: 'branches', label: 'Branches', icon: Building2, description: 'Export branch locations and settings' },
  { value: 'runs', label: 'SOP Runs', icon: FileText, description: 'Export checklist run history' },
  { value: 'scores', label: 'Performance Scores', icon: FileSpreadsheet, description: 'Export score snapshots and metrics' },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileSpreadsheet; color: string }[] = [
  { value: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-green-600' },
  { value: 'csv', label: 'CSV (.csv)', icon: FileCode, color: 'text-blue-600' },
  { value: 'pdf', label: 'PDF (.pdf)', icon: FileText, color: 'text-red-600' },
];

const FILTER_OPTIONS: Record<EntityType, FilterOption[]> = {
  employees: [
    { id: 'branch', label: 'Branch', value: '', options: [] },
    { id: 'department', label: 'Department', value: '', options: [] },
    { id: 'designation', label: 'Designation', value: '', options: [] },
    { id: 'status', label: 'Status', value: '', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  ],
  templates: [
    { id: 'department', label: 'Department', value: '', options: [] },
    { id: 'frequency', label: 'Frequency', value: '', options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }] },
  ],
  branches: [
    { id: 'city', label: 'City', value: '', options: [] },
    { id: 'state', label: 'State', value: '', options: [] },
    { id: 'status', label: 'Status', value: '', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  ],
  runs: [
    { id: 'branch', label: 'Branch', value: '', options: [] },
    { id: 'template', label: 'Template', value: '', options: [] },
    { id: 'status', label: 'Status', value: '', options: [{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'overdue', label: 'Overdue' }] },
  ],
  scores: [
    { id: 'branch', label: 'Branch', value: '', options: [] },
    { id: 'employee', label: 'Employee', value: '', options: [] },
    { id: 'period', label: 'Period', value: '', options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }] },
  ],
};

export function ExportDialog() {
  const [config, setConfig] = useState<ExportConfig>({
    entity: 'employees',
    format: 'excel',
    filters: {},
    dateRange: { from: '', to: '' },
    includeHeaders: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate dummy file
    const entityLabel = ENTITY_OPTIONS.find(e => e.value === config.entity)?.label || 'data';
    const formatExt = config.format === 'excel' ? 'xlsx' : config.format;
    const filename = `${entityLabel.toLowerCase().replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}.${formatExt}`;
    
    // Create and download dummy content
    let content = '';
    
    switch (config.format) {
      case 'csv':
        content = 'data:text/csv;charset=utf-8,Name,Email,Department\nJohn Doe,john@example.com,Sales';
        break;
      case 'pdf':
        content = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooRXhwb3J0ZWQgRGF0YSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago=';
        break;
      default:
        content = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';
    }
    
    const link = document.createElement('a');
    link.href = content;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsExporting(false);
    toast.success(`Exported ${entityLabel} to ${config.format.toUpperCase()}`);
  };

  const updateFilter = (filterId: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, [filterId]: value }
    }));
  };

  const clearFilters = () => {
    setConfig(prev => ({ ...prev, filters: {} }));
  };

  const activeFiltersCount = Object.values(config.filters).filter(Boolean).length;
  const currentFilterOptions = FILTER_OPTIONS[config.entity] || [];
  const selectedEntity = ENTITY_OPTIONS.find(e => e.value === config.entity);
  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === config.format);

  return (
    <div className="space-y-6">
      {/* Entity Selection */}
      <div className="space-y-3">
        <Label>Select Data to Export</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ENTITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.value}
                className={`cursor-pointer transition-all ${
                  config.entity === option.value 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => {
                  setConfig(prev => ({ ...prev, entity: option.value, filters: {} }));
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      config.entity === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm truncate">{option.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{option.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Format Selection */}
      <div className="space-y-3">
        <Label>Export Format</Label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.value}
                variant={config.format === option.value ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setConfig(prev => ({ ...prev, format: option.value }))}
              >
                <Icon className={`w-4 h-4 ${option.color}`} />
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-3">
        <Label>Date Range (Optional)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={config.dateRange.from}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  dateRange: { ...prev.dateRange, from: e.target.value }
                }))}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={config.dateRange.to}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  dateRange: { ...prev.dateRange, to: e.target.value }
                }))}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Filters</Label>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />
                Clear ({activeFiltersCount})
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-3 h-3 mr-1" />
              {showFilters ? 'Hide' : 'Show'} Filters
              <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>

        {showFilters && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentFilterOptions.map((filter) => (
                  <div key={filter.id} className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">{filter.label}</span>
                    {filter.options ? (
                      <select
                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                        value={config.filters[filter.id] || ''}
                        onChange={(e) => updateFilter(filter.id, e.target.value)}
                      >
                        <option value="">All {filter.label}s</option>
                        {filter.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        placeholder={`Filter by ${filter.label.toLowerCase()}`}
                        value={config.filters[filter.id] || ''}
                        onChange={(e) => updateFilter(filter.id, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Filter Badges */}
        {activeFiltersCount > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(config.filters)
              .filter(([, value]) => value)
              .map(([key, value]) => {
                const filterLabel = currentFilterOptions.find(f => f.id === key)?.label || key;
                return (
                  <Badge key={key} variant="secondary" className="gap-1">
                    {filterLabel}: {value}
                    <button 
                      onClick={() => updateFilter(key, '')}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
          </div>
        )}
      </div>

      {/* Export Preview */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Export Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Data:</span>
            <span className="font-medium">{selectedEntity?.label}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Format:</span>
            <span className="font-medium">{selectedFormat?.label}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date Range:</span>
            <span className="font-medium">
              {config.dateRange.from || config.dateRange.to 
                ? `${config.dateRange.from || '...'} to ${config.dateRange.to || '...'}`
                : 'All time'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Active Filters:</span>
            <span className="font-medium">{activeFiltersCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button 
          size="lg" 
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export {selectedEntity?.label}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
