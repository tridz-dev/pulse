import { useEffect, useState } from 'react';
import { getAllTemplates, getTemplateItems } from '@/services/templates';
import type { SOPTemplate, SOPChecklistItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Printer,
  ChevronRight,
  LayoutList,
  Clock,
  Activity,
  ClipboardCheck,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export function Templates() {
  const [templates, setTemplates] = useState<Partial<SOPTemplate>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<SOPTemplate> | null>(null);
  const [templateItems, setTemplateItems] = useState<SOPChecklistItem[]>([]);
  const [isSheetLoading, setIsSheetLoading] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      const data = await getAllTemplates();
      setTemplates(data);
      setIsLoading(false);
    }
    loadTemplates();
  }, []);

  const handleViewTemplate = async (template: Partial<SOPTemplate>) => {
    setSelectedTemplate(template);
    if (!template.name) return;
    setIsSheetLoading(true);
    const items = await getTemplateItems(template.name);
    setTemplateItems(items);
    setIsSheetLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-in fade-in duration-500 flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">SOP Templates</h1>
          <p className="text-zinc-400 text-sm mt-1">Master definitions of all operational checklists.</p>
        </div>
        <Button
          variant="outline"
          className="bg-zinc-900 border-zinc-800 text-zinc-300 gap-2 hover:bg-zinc-800"
        >
          <LayoutList size={16} />
          <span>Create Template</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.name}
              className="bg-[#141415] border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group"
              onClick={() => handleViewTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2 text-zinc-500">
                  <FileText size={20} className="group-hover:text-indigo-400 transition-colors" />
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase border-zinc-800 text-zinc-500"
                  >
                    {template.frequency_type ?? '—'}
                  </Badge>
                </div>
                <CardTitle className="text-lg text-zinc-200 group-hover:text-white transition-colors">
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
                    <span>Active</span>
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

      <Sheet open={selectedTemplate !== null} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <SheetContent className="bg-[#09090b] border-zinc-800 w-full sm:w-[640px] p-0 flex flex-col print:w-full print:h-full print:p-0 print:border-none">
          {selectedTemplate && (
            <>
              <SheetHeader className="p-4 sm:p-8 border-b border-zinc-800/80 bg-zinc-900/30 shrink-0 print:bg-white print:border-black">
                <div className="flex justify-between items-start print:hidden">
                  <div className="flex items-center gap-3 text-indigo-400 mb-4 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 w-fit">
                    <ClipboardCheck size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Master Protocol</span>
                  </div>
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
                <div className="flex flex-col gap-1">
                  <SheetTitle className="text-2xl text-white print:text-black print:text-3xl">
                    {selectedTemplate.title}
                  </SheetTitle>
                  <SheetDescription className="text-zinc-400 print:text-zinc-500 flex items-center gap-3">
                    <span>Frequency: {selectedTemplate.frequency_type ?? '—'}</span>
                    <span>•</span>
                    <span>Target: {selectedTemplate.owner_role ?? '—'}</span>
                  </SheetDescription>
                </div>
                <div className="hidden print:block mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-500 uppercase tracking-[0.2em]">
                  Official Operational Standard • Department: {selectedTemplate.department ?? 'General'}
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0">
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
                        Inspection Checklist
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
                          <div className="flex flex-col gap-1">
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
                              <span className="text-[10px] text-zinc-700 font-mono italic">
                                Weight: {item.weight}
                              </span>
                            </div>
                          </div>
                          <div className="hidden print:block ml-auto w-32 border-b border-zinc-300 h-6"></div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-8 border-t border-zinc-800/50 print:mt-12 print:border-black/10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
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
