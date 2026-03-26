import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface ComplianceData {
  date: string;
  score: number;
  completed: number;
  total: number;
}

interface ComplianceHeatmapProps {
  data: ComplianceData[];
  compact?: boolean;
}

// Generate mock filters data
const mockEmployees = ['All Employees', 'John Smith', 'Sarah Johnson', 'Mike Chen', 'Emily Davis'];
const mockBranches = ['All Branches', 'HQ', 'North Branch', 'South Branch', 'East Branch'];
const mockTemplates = ['All Templates', 'Daily Opening', 'Safety Check', 'Inventory Audit', 'Closing Procedure'];

export function ComplianceHeatmap({ data, compact = false }: ComplianceHeatmapProps) {
  const [selectedEmployee, setSelectedEmployee] = useState('All Employees');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [selectedTemplate, setSelectedTemplate] = useState('All Templates');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Organize data by week for display
  const weeks = useMemo(() => {
    const weeksData: (ComplianceData | null)[][] = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of month
    const firstDay = new Date(year, month, 1);
    // Get last day of month (calculated but unused in current implementation)
    // const lastDay = new Date(year, month + 1, 0);
    
    // Start from the first Sunday before or on the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Generate 6 weeks (42 days) to cover the full month view
    for (let week = 0; week < 6; week++) {
      const weekData: (ComplianceData | null)[] = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + week * 7 + day);
        const dateStr = date.toISOString().slice(0, 10);
        const dayData = data.find(d => d.date === dateStr);
        weekData.push(dayData || null);
      }
      weeksData.push(weekData);
    }
    
    return weeksData;
  }, [data, currentMonth]);

  const getColorIntensity = (score: number | undefined) => {
    if (score === undefined) return 'bg-zinc-800/30';
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-emerald-500/70';
    if (score >= 70) return 'bg-amber-500';
    if (score >= 60) return 'bg-amber-500/70';
    if (score >= 50) return 'bg-rose-500/70';
    return 'bg-rose-500';
  };

  const getTooltipContent = (dayData: ComplianceData | null, date: Date) => {
    if (!dayData) {
      return (
        <div className="text-xs">
          <p className="font-medium text-zinc-300">
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-zinc-500 mt-1">No data</p>
        </div>
      );
    }
    
    return (
      <div className="text-xs space-y-1">
        <p className="font-medium text-zinc-300">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Score:</span>
          <span className={cn(
            'font-medium',
            dayData.score >= 80 ? 'text-emerald-400' : 
            dayData.score >= 60 ? 'text-amber-400' : 'text-rose-400'
          )}>
            {dayData.score}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Completed:</span>
          <span className="text-zinc-300">{dayData.completed}/{dayData.total}</span>
        </div>
      </div>
    );
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  if (compact) {
    // Show last 14 days in a simple grid
    const recentData = data.slice(-14);
    
    return (
      <Card className="bg-[#141415] border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-400" />
              <CardTitle className="text-sm text-zinc-200">Compliance Heatmap</CardTitle>
            </div>
            <span className="text-xs text-zinc-500">Last 14 days</span>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={100}>
            <div className="grid grid-cols-7 gap-1">
              {recentData.map((day) => {
                const date = new Date(day.date);
                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "aspect-square rounded-md cursor-pointer transition-all hover:scale-110",
                          getColorIntensity(day.score)
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-900 border-zinc-700">
                      {getTooltipContent(day, date)}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          
          {/* Legend */}
          <div className="flex items-center justify-between mt-4 text-[10px] text-zinc-500">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded bg-rose-500" />
              <div className="w-3 h-3 rounded bg-amber-500" />
              <div className="w-3 h-3 rounded bg-emerald-500/70" />
              <div className="w-3 h-3 rounded bg-emerald-500" />
            </div>
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#141415] border-zinc-800">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-400" />
              <CardTitle className="text-base text-zinc-200">Compliance Heatmap</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Daily compliance scores across the organization
            </CardDescription>
          </div>
          
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-zinc-300 min-w-[120px] text-center">
              {monthName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Filter className="h-4 w-4 text-zinc-500" />
          
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="h-8 px-2 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 focus:outline-none focus:border-zinc-700"
          >
            {mockEmployees.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-8 px-2 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 focus:outline-none focus:border-zinc-700"
          >
            {mockBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="h-8 px-2 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 focus:outline-none focus:border-zinc-700"
          >
            {mockTemplates.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="space-y-1">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-[10px] text-zinc-500 font-medium">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((dayData, dayIndex) => {
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                  date.setDate(date.getDate() + weekIndex * 7 + dayIndex - date.getDay());
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                  
                  return (
                    <Tooltip key={`${weekIndex}-${dayIndex}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "aspect-square rounded-md cursor-pointer transition-all hover:scale-105 hover:ring-2 hover:ring-indigo-500/50",
                            getColorIntensity(dayData?.score),
                            !isCurrentMonth && "opacity-30"
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-zinc-900 border-zinc-700">
                        {getTooltipContent(dayData, date)}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </TooltipProvider>
        
        {/* Legend and Stats */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Score:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-rose-500" />
              <span className="text-[10px] text-zinc-500">&lt;50%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-[10px] text-zinc-500">50-79%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-[10px] text-zinc-500">80%+</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>Hover for details</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
