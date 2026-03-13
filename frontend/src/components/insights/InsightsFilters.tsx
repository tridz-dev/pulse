import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X } from 'lucide-react';
import { getInsightDepartments, getInsightBranches } from '@/services/insights';
import type { InsightFilters } from '@/services/insights';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

/** Fixed range used by seed/demo data (see pulse seed data.py). */
export const DEMO_DATE_START = '2026-02-10';
export const DEMO_DATE_END = '2026-03-12';

export type DateRangePreset = '7d' | '30d' | '90d' | 'month' | 'demo';

export interface DateRangeValue {
  start: string;
  end: string;
  preset?: DateRangePreset;
}

export function rangeFromPreset(preset: DateRangePreset): DateRangeValue {
  const end = new Date();
  const start = new Date();
  if (preset === 'demo') {
    return { start: DEMO_DATE_START, end: DEMO_DATE_END, preset: 'demo' };
  }
  if (preset === '7d') start.setDate(start.getDate() - 7);
  else if (preset === '30d') start.setDate(start.getDate() - 30);
  else if (preset === '90d') start.setDate(start.getDate() - 90);
  else {
    start.setDate(1);
    start.setMonth(end.getMonth());
    start.setFullYear(end.getFullYear());
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    preset,
  };
}

export interface InsightsFiltersProps {
  filters: InsightFilters;
  dateRange: DateRangeValue;
  onFiltersChange: (f: InsightFilters) => void;
  onDateRangeChange: (d: DateRangeValue) => void;
}

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'month', label: 'This month' },
  { id: 'demo', label: 'Demo data' },
];

export function InsightsFiltersBar({
  filters,
  dateRange,
  onFiltersChange,
  onDateRangeChange,
}: InsightsFiltersProps) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const selectedDepts = Array.isArray(filters.department) ? filters.department : filters.department ? [filters.department] : [];
  const selectedBranches = Array.isArray(filters.branch) ? filters.branch : filters.branch ? [filters.branch] : [];

  useEffect(() => {
    getInsightDepartments().then(setDepartments);
    getInsightBranches().then(setBranches);
  }, []);

  const toggleDepartment = (name: string) => {
    const next = selectedDepts.includes(name) ? selectedDepts.filter((d) => d !== name) : [...selectedDepts, name];
    onFiltersChange({ ...filters, department: next.length ? next : undefined });
  };

  const toggleBranch = (name: string) => {
    const next = selectedBranches.includes(name) ? selectedBranches.filter((b) => b !== name) : [...selectedBranches, name];
    onFiltersChange({ ...filters, branch: next.length ? next : undefined });
  };

  const clearAll = () => {
    onFiltersChange({});
    onDateRangeChange(rangeFromPreset('90d'));
  };

  const hasActiveFilters = selectedDepts.length > 0 || selectedBranches.length > 0 || filters.employee;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range presets */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
        {PRESETS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onDateRangeChange(rangeFromPreset(id))}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              dateRange.preset === id
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Department multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center h-8 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 gap-1"
        >
          Department {selectedDepts.length > 0 ? `(${selectedDepts.length})` : ''}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          <DropdownMenuLabel>Filter by department</DropdownMenuLabel>
          {departments.map((d) => (
            <DropdownMenuCheckboxItem
              key={d}
              checked={selectedDepts.includes(d)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggleDepartment(d)}
            >
              {d}
            </DropdownMenuCheckboxItem>
          ))}
          {departments.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-zinc-500">No departments</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Branch multi-select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center h-8 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 gap-1"
        >
          Branch {selectedBranches.length > 0 ? `(${selectedBranches.length})` : ''}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          <DropdownMenuLabel>Filter by branch</DropdownMenuLabel>
          {branches.map((b) => (
            <DropdownMenuCheckboxItem
              key={b}
              checked={selectedBranches.includes(b)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggleBranch(b)}
            >
              {b}
            </DropdownMenuCheckboxItem>
          ))}
          {branches.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-zinc-500">No branches</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 gap-1 text-zinc-400 hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
