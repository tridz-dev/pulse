import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface CalendarRun {
  name: string;
  template: string;
  template_title: string;
  employee: string;
  employee_name: string;
  period_date: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  progress: number;
}

export function AssignmentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [runs, setRuns] = useState<CalendarRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate date range for calendar
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const start = format(calendarStart, 'yyyy-MM-dd');
      const end = format(calendarEnd, 'yyyy-MM-dd');
      const response = await fetch(`/api/method/pulse.api.assignments.get_assignment_calendar?start_date=${start}&end_date=${end}`);
      const data = await response.json();
      if (data.message) {
        setRuns(data.message);
      }
    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get runs for a specific day
  const getRunsForDay = (date: Date): CalendarRun[] => {
    return runs.filter((run) => isSameDay(new Date(run.period_date), date));
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Done</Badge>;
      case 'In Progress':
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'Overdue':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Overdue</Badge>;
      default:
        return <Badge variant="secondary"><Circle className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  // Status color for dot
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-500';
      case 'In Progress': return 'bg-blue-500';
      case 'Overdue': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const today = new Date();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedDayRuns = selectedDate ? getRunsForDay(selectedDate) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span>Pending</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              const dayRuns = getRunsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[80px] p-2 rounded-lg border text-left transition-colors
                    ${isCurrentMonth ? 'bg-card' : 'bg-muted/50 text-muted-foreground'}
                    ${isToday ? 'ring-2 ring-primary' : ''}
                    ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}
                    hover:bg-accent
                  `}
                  title={`${format(day, 'EEEE, MMMM d')} - ${dayRuns.length} runs`}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayRuns.slice(0, 3).map((run, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full ${getStatusColor(run.status)}`}
                      />
                    ))}
                    {dayRuns.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayRuns.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDayRuns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No SOP runs scheduled for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayRuns.map((run) => (
                  <div 
                    key={run.name} 
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(run.status)}`} />
                      <div>
                        <div className="font-medium">{run.template_title}</div>
                        <div className="text-sm text-muted-foreground">
                          {run.employee_name} • {run.progress}% complete
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(run.status)}
                      <Button variant="ghost" size="sm">
                        <a href={`/pulse/tasks?id=${run.name}`}>View</a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
