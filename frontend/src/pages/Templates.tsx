import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { getAllTemplatesWithInactive, deleteTemplate, duplicateTemplate } from '@/services/templateAdmin';
import { getAllTemplates, getTemplateItems } from '@/services/templates';
import type { SOPTemplate, SOPChecklistItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Printer,
  ChevronRight,
  Clock,
  Activity,
  ClipboardCheck,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function Templates() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<Partial<SOPTemplate & { is_active?: boolean }>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<SOPTemplate> | null>(null);
  const [templateItems, setTemplateItems] = useState<SOPChecklistItem[]>([]);
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Partial<SOPTemplate> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user can manage templates
  const canManageTemplates = currentUser?.systemRole && 
    ['Pulse Admin', 'Pulse Executive', 'Pulse Leader', 'Pulse Manager'].includes(currentUser.systemRole);

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      try {
        if (showInactive && canManageTemplates) {
          const data = await getAllTemplatesWithInactive();
          setTemplates(data);
        } else {
          const data = await getAllTemplates();
          setTemplates(data);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
      setIsLoading(false);
    }
    loadTemplates();
  }, [showInactive, canManageTemplates]);

  const handleViewTemplate = async (template: Partial<SOPTemplate>) => {
    setSelectedTemplate(template);
    if (!template.name) return;
    setIsSheetLoading(true);
    try {
      const items = await getTemplateItems(template.name);
      setTemplateItems(items);
    } catch (error) {
      console.error('Failed to load template items:', error);
    }
    setIsSheetLoading(false);
  };

  const handleEditTemplate = (templateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/templates/${templateName}/edit`);
  };

  const handleDuplicateTemplate = async (template: Partial<SOPTemplate>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!template.name) return;
    try {
      const result = await duplicateTemplate(template.name, `${template.title} (Copy)`);
      if (result.success) {
        // Reload templates
        const data = showInactive ? await getAllTemplatesWithInactive() : await getAllTemplates();
        setTemplates(data);
        alert('Template duplicated successfully');
      }
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      alert('Failed to duplicate template');
    }
  };

  const handleDeleteClick = (template: Partial<SOPTemplate>, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete?.name) return;
    setIsDeleting(true);
    try {
      const result = await deleteTemplate(templateToDelete.name);
      if (result.success) {
        // Reload templates
        const data = showInactive ? await getAllTemplatesWithInactive() : await getAllTemplates();
        setTemplates(data);
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
    setIsDeleting(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredTemplates = templates.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(query) ||
      t.department?.toLowerCase().includes(query) ||
      t.owner_role?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">SOP Templates</h1>
          <p className="text-zinc-400 text-sm mt-1">Master definitions of all operational checklists.</p>
        </div>
        {canManageTemplates && (
          <Button
            onClick={() => navigate('/templates/new')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <Plus size={16} />
            <span>Create Template</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-white"
          />
        </div>
        {canManageTemplates && (
          <Button
            variant="outline"
            onClick={() => setShowInactive(!showInactive)}
            className={showInactive ? 'bg-zinc-800 border-zinc-700' : 'border-zinc-800 text-zinc-400'}
          >
            {showInactive ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showInactive ? 'Showing All' : 'Show Inactive'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
          <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">
            {searchQuery ? 'No templates match your search' : 'No templates found'}
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : canManageTemplates 
                ? 'Create your first SOP template to get started'
                : 'Contact your administrator to create templates'}
          </p>
          {canManageTemplates && !searchQuery && (
            <Button
              onClick={() => navigate('/templates/new')}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <Plus size={16} />
              Create Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card
              key={template.name}
              className={cn(
                "bg-[#141415] border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group",
                !template.is_active && "opacity-60"
              )}
              onClick={() => handleViewTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2 text-zinc-500">
                  <FileText size={20} className="group-hover:text-indigo-400 transition-colors" />
                  <div className="flex items-center gap-2">
                    {!template.is_active && (
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                        Inactive
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase border-zinc-800 text-zinc-500"
                    >
                      {template.frequency_type ?? '—'}
                    </Badge>
                    {canManageTemplates && (
                      <DropdownMenu>
                        <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500 hover:text-white">
                            <MoreVertical size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                          <DropdownMenuItem 
                            onClick={(e) => handleEditTemplate(template.name!, e)}
                            className="text-zinc-300 focus:bg-zinc-800 focus:text-white"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => handleDuplicateTemplate(template, e)}
                            className="text-zinc-300 focus:bg-zinc-800 focus:text-white"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => handleDeleteClick(template, e)}
                            className="text-rose-400 focus:bg-rose-950 focus:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {template.is_active ? 'Deactivate' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg text-zinc-200 group-hover:text-white transition-colors line-clamp-2">
                  {template.title}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 font-mono">
                  ID: {template.name} • Dept: {template.department ?? 'General'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="opacity-60" />
                    <span>{template.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity size={14} className="opacity-60" />
                    <span>{template.owner_role ?? '—'}s</span>
                  </div>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={16} className="text-zinc-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Detail Sheet */}
      <Sheet open={selectedTemplate !== null} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <SheetContent className="bg-[#09090b] border-zinc-800 w-[500px] sm:w-[640px] p-0 flex flex-col print:w-full print:h-full print:p-0 print:border-none">
          {selectedTemplate && (
            <>
              <SheetHeader className="p-8 border-b border-zinc-800/80 bg-zinc-900/30 shrink-0 print:bg-white print:border-black">
                <div className="flex justify-between items-start print:hidden">
                  <div className="flex items-center gap-3 text-indigo-400 mb-4 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 w-fit">
                    <ClipboardCheck size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Master Protocol</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageTemplates && (
                      <Button
                        onClick={() => navigate(`/templates/${selectedTemplate.name}/edit`)}
                        variant="outline"
                        size="sm"
                        className="bg-zinc-900 border-zinc-800 text-zinc-400 gap-2 hover:text-white"
                      >
                        <Edit size={14} />
                        <span>Edit</span>
                      </Button>
                    )}
                    <Button
                      onClick={handlePrint}
                      variant="outline"
                      size="sm"
                      className="bg-zinc-900 border-zinc-800 text-zinc-400 gap-2 hover:text-white"
                    >
                      <Printer size={14} />
                      <span>Print Task Sheet</span>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <SheetTitle className="text-2xl text-white print:text-black print:text-3xl">
                    {selectedTemplate.title}
                  </SheetTitle>
                  <SheetDescription className="text-zinc-400 print:text-zinc-500 flex items-center gap-3 flex-wrap">
                    <span>Frequency: {selectedTemplate.frequency_type ?? '—'}</span>
                    <span>•</span>
                    <span>Target: {selectedTemplate.owner_role ?? '—'}</span>
                    {selectedTemplate.department && (
                      <>
                        <span>•</span>
                        <span>Dept: {selectedTemplate.department}</span>
                      </>
                    )}
                  </SheetDescription>
                </div>
                <div className="hidden print:block mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-500 uppercase tracking-[0.2em]">
                  Official Operational Standard • Department: {selectedTemplate.department ?? 'General'}
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-8 print:p-0">
                {isSheetLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-12 bg-zinc-900 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 print:gap-0">
                    <div className="print:hidden">
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
                        Inspection Checklist ({templateItems.length} items)
                      </h4>
                    </div>
                    <div className="space-y-0.5 print:space-y-0">
                      {templateItems.map((item, index) => (
                        <div
                          key={item.name ?? index}
                          className="flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800/50 group print:border-zinc-200 print:rounded-none print:hover:bg-transparent print:p-6"
                        >
                          <div className="w-6 h-6 rounded-md border-2 border-zinc-800 mt-0.5 flex items-center justify-center shrink-0 group-hover:border-zinc-700 print:border-zinc-300">
                            <span className="text-[10px] text-zinc-600 font-mono print:hidden">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <p className="text-sm font-medium text-zinc-200 print:text-black print:text-lg italic">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1 border-zinc-800 text-zinc-600 uppercase"
                              >
                                {item.item_type}
                              </Badge>
                              {item.outcome_mode && item.outcome_mode !== 'SimpleCompletion' && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 border-zinc-800 text-zinc-600 uppercase"
                                >
                                  {item.outcome_mode}
                                </Badge>
                              )}
                              {item.proof_requirement && item.proof_requirement !== 'None' && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 border-amber-800 text-amber-600 uppercase"
                                >
                                  {item.proof_requirement}
                                </Badge>
                              )}
                              <span className="text-[10px] text-zinc-700 font-mono italic">
                                Weight: {item.weight}
                              </span>
                            </div>
                            {item.instructions && (
                              <p className="text-xs text-zinc-500 mt-1 print:hidden">
                                {item.instructions}
                              </p>
                            )}
                          </div>
                          <div className="hidden print:block ml-auto w-32 border-b border-zinc-300 h-6"></div>
                        </div>
                      ))}
                    </div>
                    {templateItems.length === 0 && (
                      <div className="text-center py-8 text-zinc-500 print:hidden">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No checklist items defined for this template.</p>
                      </div>
                    )}
                    <div className="mt-8 pt-8 border-t border-zinc-800/50 print:mt-12 print:border-black/10">
                      <div className="grid grid-cols-2 gap-8">
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                            Authorized By
                          </span>
                          <div className="h-10 border-b border-zinc-800/80 print:border-black/20"></div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                            Inspection Date
                          </span>
                          <div className="h-10 border-b border-zinc-800/80 print:border-black/20"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-400" />
              {templateToDelete?.is_active ? 'Deactivate Template' : 'Delete Template'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to {templateToDelete?.is_active ? 'deactivate' : 'delete'} the template &quot;
              <span className="text-white font-medium">{templateToDelete?.title}</span>&quot;?
              {templateToDelete?.is_active && (
                <span className="block mt-2">
                  This template will no longer be available for new assignments. Existing runs will not be affected.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {templateToDelete?.is_active ? 'Deactivate' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

// Utility for class merging
function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}
