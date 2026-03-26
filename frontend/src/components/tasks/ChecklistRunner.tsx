import { useEffect, useState, useCallback } from 'react';
import { getRunDetails, updateRunItem, completeRun } from '@/services/tasks';
import type { SOPRunItem, SOPRun, SOPTemplate } from '@/types';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Camera, Upload } from 'lucide-react';

type ItemRow = SOPRunItem & {
  template_item?: { description: string; weight: number; item_type?: string; sequence?: number };
};

type Details = {
  run: SOPRun;
  template: SOPTemplate;
  items: ItemRow[];
};

function csrfHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const w = window as unknown as { csrf_token?: string };
  if (w.csrf_token && w.csrf_token !== '{{ csrf_token }}') {
    h['X-Frappe-CSRF-Token'] = w.csrf_token;
  }
  return h;
}

function prerequisiteLocked(item: ItemRow, items: ItemRow[]): boolean {
  const trig = item.prerequisite_trigger || 'None';
  if (!trig || trig === 'None') return false;
  const pk = (item.prerequisite_item_key || '').trim();
  if (!pk) return false;
  const pre = items.find((i) => (i.item_key || '').trim() === pk);
  if (!pre) return false;
  const st = pre.status || 'Pending';
  return st !== 'Completed' && st !== 'NotApplicable';
}

function prerequisiteStepLabel(item: ItemRow, items: ItemRow[]): string {
  const pk = (item.prerequisite_item_key || '').trim();
  if (!pk) return 'previous step';
  const pre = items.find((i) => (i.item_key || '').trim() === pk);
  return pre?.template_item?.description ?? pre?.checklist_item ?? pk;
}

function validateForSubmit(items: ItemRow[]): string | null {
  for (const i of items) {
    if (i.status === 'Pending') return 'Every checklist step must be completed before you submit.';
    if (i.status === 'NotApplicable') continue;
    if (i.status !== 'Completed') continue;
    const om = i.outcome_mode || 'SimpleCompletion';
    if (om === 'PassFail' && !(i.outcome || '').trim()) {
      return `Select Pass, Fail, or N/A for: ${i.checklist_item}`;
    }
    if (i.outcome === 'Fail' && !(i.failure_remark || '').trim()) {
      return `Add a failure remark for: ${i.checklist_item}`;
    }
    if (i.proof_requirement === 'Required' && !(i.evidence || '').trim()) {
      return `Upload proof for: ${i.checklist_item}`;
    }
  }
  return null;
}

export function ChecklistRunner({
  runId,
  open,
  onOpenChange,
  variant = 'sheet',
}: {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: 'sheet' | 'fullscreen';
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (open && runId) {
      getRunDetails(runId).then(setDetails).catch(() => setDetails(null));
    }
  }, [open, runId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setItems = (fn: (prev: ItemRow[]) => ItemRow[]) => {
    setDetails((prev) => (prev ? { ...prev, items: fn(prev.items) } : prev));
  };

  const applyItem = async (itemId: string, patch: Partial<ItemRow> & { status?: string }) => {
    setBusy(true);
    setError(null);
    try {
      await updateRunItem(itemId, patch.status ?? 'Pending', {
        notes: patch.notes,
        numeric_value: patch.numeric_value,
        outcome: patch.outcome,
        failure_remark: patch.failure_remark,
        file_url: patch.evidence,
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
    setBusy(false);
  };

  const toggleItem = async (item: ItemRow) => {
    if (!details) return;
    if (details.run.status !== 'Open') return;
    if (item.status === 'NotApplicable') return;
    if (prerequisiteLocked(item, details.items)) {
      setError(`Complete "${prerequisiteStepLabel(item, details.items)}" first.`);
      return;
    }
    const next = item.status === 'Completed' ? 'Pending' : 'Completed';
    if (next === 'Completed') {
      const om = item.outcome_mode || 'SimpleCompletion';
      if (om === 'PassFail' && !(item.outcome || '').trim()) {
        setError('Choose Pass, Fail, or N/A before completing this item.');
        return;
      }
      if (item.outcome === 'Fail' && !(item.failure_remark || '').trim()) {
        setError('Add a failure remark before completing.');
        return;
      }
      if (item.proof_requirement === 'Required' && !(item.evidence || '').trim()) {
        setError('Upload proof before completing this item.');
        return;
      }
    }
    await applyItem(item.name, {
      status: next,
      outcome: next === 'Pending' ? '' : item.outcome,
      failure_remark: next === 'Pending' ? '' : item.failure_remark,
    });
  };

  const onUpload = async (item: ItemRow, fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f || details?.run.status !== 'Open') return;
    if (!details) return;
    if (prerequisiteLocked(item, details.items)) {
      setError(`Complete "${prerequisiteStepLabel(item, details.items)}" before adding proof.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = import.meta.env.VITE_FRAPPE_URL || '';
      const fd = new FormData();
      fd.append('file', f);
      fd.append('run_item_name', item.name);
      const res = await fetch(`${url}/api/method/pulse.api.tasks.upload_run_item_evidence`, {
        method: 'POST',
        headers: csrfHeaders(),
        body: fd,
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.exc || json.message || 'Upload failed');
      }
      const fileUrl = json.message?.file_url;
      if (fileUrl) {
        await updateRunItem(item.name, item.status, { file_url: fileUrl });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
    setBusy(false);
  };

  const completeRunHandler = async () => {
    if (!details) return;
    const msg = validateForSubmit(details.items);
    if (msg) {
      setError(msg);
      return;
    }
    setBusy(true);
    try {
      await completeRun(details.run.name ?? runId);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close run');
    }
    setBusy(false);
  };

  if (!details) return null;

  const isReadOnly = details.run?.status !== 'Open';
  const template = details.template ?? {};
  const run = details.run ?? {};
  const runProgress = Math.round(Number(run.progress ?? 0));
  const runScore = Math.round(Number(run.score ?? 0));

  const inner = (
    <>
      <div className={`p-6 border-b border-zinc-800 ${variant === 'fullscreen' ? 'pt-safe' : ''}`}>
        <div className="text-left">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-zinc-400 border-zinc-700">
              {template.department ?? '—'}
            </Badge>
            {isReadOnly && (
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
                <Lock size={12} className="mr-1" /> Read Only
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mt-2">{template.title ?? 'Checklist'}</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {run.period_date ? new Date(String(run.period_date)).toLocaleDateString() : '—'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-indigo-300 border-indigo-500/30">
              Progress {runProgress}%
            </Badge>
            <Badge variant="outline" className="text-emerald-300 border-emerald-500/30">
              Score {runScore}%
            </Badge>
          </div>
        </div>
        {error && <p className="text-rose-400 text-xs mt-3">{error}</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="space-y-4">
          {details.items.map((item) => {
            const desc = item.template_item?.description ?? item.checklist_item;
            const om = item.outcome_mode || 'SimpleCompletion';
            const itemSkipped = item.status === 'NotApplicable';
            const preLocked = prerequisiteLocked(item, details.items);
            const capture =
              item.proof_capture_mode === 'CameraOnly'
                ? ({ capture: 'environment' as const, accept: 'image/*' })
                : ({ accept: item.proof_media_type === 'Image' ? 'image/*' : undefined });
            return (
              <div
                key={item.name}
                className={`p-4 rounded-lg border ${
                  item.status === 'Completed'
                    ? 'bg-indigo-500/5 border-indigo-500/20'
                    : itemSkipped
                      ? 'bg-zinc-900/30 border-zinc-800 opacity-70'
                      : 'bg-zinc-900/50 border-zinc-800'
                } space-y-3 ${isReadOnly ? 'opacity-80' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={item.name}
                    checked={item.status === 'Completed'}
                    disabled={isReadOnly || busy || itemSkipped || preLocked}
                    onCheckedChange={() => toggleItem(item)}
                    className="mt-1 border-zinc-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={item.name}
                      className={`text-sm font-medium leading-snug cursor-pointer ${itemSkipped ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}
                    >
                      {desc}
                    </label>
                    {itemSkipped ? (
                      <Badge variant="outline" className="mt-2 text-[10px] border-zinc-600 text-zinc-500">
                        Skipped
                      </Badge>
                    ) : null}
                    {preLocked && !itemSkipped ? (
                      <p className="text-[11px] text-amber-400/90 mt-2 flex items-center gap-1">
                        <Lock size={12} className="shrink-0" />
                        Waiting for: {prerequisiteStepLabel(item, details.items)}
                      </p>
                    ) : null}
                    {item.instructions ? (
                      <details className="mt-2 text-xs text-zinc-500">
                        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">Instructions</summary>
                        <p className="mt-1 text-zinc-500 whitespace-pre-wrap">{item.instructions}</p>
                      </details>
                    ) : null}
                    {(item.template_item?.weight ?? item.weight) > 1 && (
                      <span className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 inline-block mt-1">
                        Weight: {item.template_item?.weight ?? item.weight}
                      </span>
                    )}
                  </div>
                </div>

                {!itemSkipped && om === 'PassFail' && (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {(['Pass', 'Fail', 'NotApplicable'] as const).map((o) => (
                      <Button
                        key={o}
                        type="button"
                        size="sm"
                        variant={item.outcome === o ? 'default' : 'outline'}
                        disabled={isReadOnly || busy || preLocked}
                        className={item.outcome === o ? 'bg-indigo-600' : 'border-zinc-700 text-zinc-300'}
                        onClick={async () => {
                          setError(null);
                          const nextOutcome = o === 'NotApplicable' ? 'NotApplicable' : o;
                          const nextRemark = o === 'Fail' ? item.failure_remark : '';
                          setItems((rows) =>
                            rows.map((r) => (r.name === item.name ? { ...r, outcome: nextOutcome, failure_remark: nextRemark } : r)),
                          );
                          await updateRunItem(item.name, item.status, {
                            outcome: nextOutcome,
                            failure_remark: o === 'Fail' ? item.failure_remark : '',
                          });
                          await reload();
                        }}
                      >
                        {o === 'NotApplicable' ? 'N/A' : o}
                      </Button>
                    ))}
                  </div>
                )}

                {!itemSkipped && item.outcome === 'Fail' && (
                  <div className="pl-9">
                    <label className="text-[11px] text-zinc-500 block mb-1">Failure remark *</label>
                    <textarea
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 text-sm text-zinc-200 p-2 min-h-[64px]"
                      disabled={isReadOnly || busy || preLocked}
                      value={item.failure_remark ?? ''}
                      onChange={(e) =>
                        setItems((rows) => rows.map((r) => (r.name === item.name ? { ...r, failure_remark: e.target.value } : r)))
                      }
                      onBlur={async () => {
                        if (item.outcome === 'Fail') {
                          await updateRunItem(item.name, item.status, { failure_remark: item.failure_remark });
                          await reload();
                        }
                      }}
                    />
                  </div>
                )}

                {!itemSkipped && om === 'Numeric' && (
                  <div className="pl-9 flex items-center gap-2">
                    <label className="text-xs text-zinc-500">Value</label>
                    <input
                      type="number"
                      className="w-28 rounded-md border border-zinc-800 bg-zinc-950 text-sm text-zinc-200 px-2 py-1"
                      disabled={isReadOnly || busy || preLocked}
                      value={item.numeric_value ?? ''}
                      onChange={(e) =>
                        setItems((rows) =>
                          rows.map((r) =>
                            r.name === item.name ? { ...r, numeric_value: parseFloat(e.target.value) || undefined } : r,
                          ),
                        )
                      }
                      onBlur={async () => {
                        await updateRunItem(item.name, item.status, { numeric_value: item.numeric_value });
                        await reload();
                      }}
                    />
                  </div>
                )}

                {!itemSkipped && item.proof_requirement && item.proof_requirement !== 'None' && (
                  <div className="pl-9 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs text-zinc-400">
                        {item.proof_requirement === 'Required' ? (
                          <span className="text-rose-400">*</span>
                        ) : null}{' '}
                        Proof {item.proof_requirement === 'Optional' ? '(optional)' : ''}
                      </label>
                      {item.evidence ? (
                        <a href={item.evidence} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 underline">
                          View file
                        </a>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer rounded-lg border border-zinc-800 px-3 py-2 hover:bg-zinc-800/50">
                        {item.proof_capture_mode === 'CameraOnly' ? <Camera size={16} /> : <Upload size={16} />}
                        <span>{item.proof_capture_mode === 'CameraOnly' ? 'Take photo' : 'Upload'}</span>
                        <input
                          type="file"
                          className="hidden"
                          disabled={isReadOnly || busy || preLocked}
                          {...capture}
                          onChange={(e) => onUpload(item, e.target.files)}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {!itemSkipped && om === 'PhotoProof' && (!item.proof_requirement || item.proof_requirement === 'None') && (
                  <div className="pl-9">
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer rounded-lg border border-zinc-800 px-3 py-2">
                      <Camera size={16} />
                      Add photo
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        disabled={isReadOnly || busy || preLocked}
                        onChange={(e) => onUpload(item, e.target.files)}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!isReadOnly && (
        <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 sticky bottom-0 space-y-2">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={busy}
            onClick={completeRunHandler}
          >
            Submit & Close Checklist
          </Button>
        </div>
      )}
    </>
  );

  if (variant === 'fullscreen') {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#18181b] text-zinc-100">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <Button variant="ghost" size="sm" className="text-zinc-400" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <span className="text-sm font-medium truncate px-2">{template.title}</span>
          <span className="w-12" />
        </header>
        <div className="flex-1 flex flex-col min-h-0">{inner}</div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#18181b] border-zinc-800 sm:max-w-md w-full p-0 flex flex-col h-full text-zinc-100">
        {inner}
      </SheetContent>
    </Sheet>
  );
}
