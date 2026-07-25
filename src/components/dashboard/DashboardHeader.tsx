import { useState } from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i);

const currencies = [
  { value: 'GBP', label: '£ GBP' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
];

export const DashboardHeader = () => {
  const { user } = useAuth();
  const { 
    selectedYear, setSelectedYear, setSelectedYearOnly,
    currency, setCurrency,
    reportingPeriodStart, setReportingPeriodStart,
    reportingPeriodEnd, setReportingPeriodEnd,
    setPeriodPattern,
  } = useDashboard();

  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  const [tempStart, setTempStart] = useState<Date>(reportingPeriodStart);
  const [tempEnd, setTempEnd] = useState<Date>(reportingPeriodEnd);

  const handleEditPeriod = () => {
    setTempStart(reportingPeriodStart);
    setTempEnd(reportingPeriodEnd);
    setIsEditingPeriod(true);
  };

  const deriveReportingYear = (start: Date, end: Date): number => {
    const monthsByYear: Record<number, number> = {};
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endMonth) {
      const y = cursor.getFullYear();
      monthsByYear[y] = (monthsByYear[y] || 0) + 1;
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return Number(Object.entries(monthsByYear).sort((a, b) => b[1] - a[1])[0][0]);
  };

  const handleSavePeriod = async () => {
    if (tempStart >= tempEnd) return;
    setReportingPeriodStart(tempStart);
    setReportingPeriodEnd(tempEnd);
    
    const newPattern = {
      startMonth: tempStart.getMonth() + 1,
      startDay: tempStart.getDate(),
      endMonth: tempEnd.getMonth() + 1,
      endDay: tempEnd.getDate(),
    };
    setPeriodPattern(newPattern);
    
    // Persist to database
    if (user) {
      await supabase
        .from('profiles')
        .update({
          period_start_month: newPattern.startMonth,
          period_start_day: newPattern.startDay,
          period_end_month: newPattern.endMonth,
          period_end_day: newPattern.endDay,
        } as any)
        .eq('user_id', user.id);
    }
    
    setSelectedYearOnly(deriveReportingYear(tempStart, tempEnd));
    setIsEditingPeriod(false);
  };

  const handleCancelPeriod = () => {
    setIsEditingPeriod(false);
  };

  const formatDate = (date: Date) => format(date, 'dd/MM/yy');

  return (
    <header className="bg-card border-b px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Reporting Period</span>
          </div>

          {!isEditingPeriod ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {formatDate(reportingPeriodStart)} to {formatDate(reportingPeriodEnd)}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditPeriod}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs", !tempStart && "text-muted-foreground")}>
                    {formatDate(tempStart)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempStart}
                    onSelect={(d) => d && setTempStart(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs", !tempEnd && "text-muted-foreground")}>
                    {formatDate(tempEnd)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempEnd}
                    onSelect={(d) => d && setTempEnd(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSavePeriod}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelPeriod}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
};
