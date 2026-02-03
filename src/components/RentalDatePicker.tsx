import { useState } from 'react';
import { format, addDays, nextFriday, isFriday, startOfDay } from 'date-fns';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type RentalDuration = 'daily' | '1-weekend' | '2-weekend' | '30-day';

const getRushDays = () => {
  const today = startOfDay(new Date());
  return {
    from: addDays(today, 1),
    to: addDays(today, 2)
  };
};

interface RentalDatePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  duration: RentalDuration;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onDurationChange: (duration: RentalDuration) => void;
}

const durationOptions: { value: RentalDuration; label: string; description: string; days: number | null }[] = [
  { value: 'daily', label: 'Daily', description: 'Select your own dates', days: null },
  { value: '1-weekend', label: '1 Weekend', description: 'Fri AM – Mon AM', days: 3 },
  { value: '2-weekend', label: '2 Weekends', description: 'Fri AM – Mon AM (next week)', days: 10 },
  { value: '30-day', label: '30 Days', description: 'Full month rental', days: 30 },
];

const getNextAvailableFriday = (from: Date = new Date()) => {
  const today = startOfDay(from);
  if (isFriday(today)) {
    return today;
  }
  return nextFriday(today);
};

const calculateEndDate = (startDate: Date, duration: RentalDuration, customEndDate?: Date): Date => {
  if (duration === 'daily' && customEndDate) {
    return customEndDate;
  }
  const option = durationOptions.find(o => o.value === duration);
  return addDays(startDate, option?.days || 3);
};

const RentalDatePicker = ({
  startDate,
  endDate: customEndDate,
  duration,
  onStartDateChange,
  onEndDateChange,
  onDurationChange,
}: RentalDatePickerProps) => {
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
  
  const calculatedEndDate = startDate ? calculateEndDate(startDate, duration, customEndDate) : undefined;
  const selectedOption = durationOptions.find(o => o.value === duration);
  const rentalDays = duration === 'daily' && startDate && customEndDate 
    ? Math.ceil((customEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : selectedOption?.days || 0;

  // For weekend rentals, only allow Fridays
  const isWeekendRental = duration === '1-weekend' || duration === '2-weekend';
  const isDailyRental = duration === 'daily';
  
  const rushDays = getRushDays();
  
  const isRushDay = (date: Date) => {
    const dateStart = startOfDay(date);
    return dateStart >= rushDays.from && dateStart <= rushDays.to;
  };

  const disabledStartDays = (date: Date) => {
    const today = startOfDay(new Date());
    // Disable today (same-day) and past dates
    if (date <= today) return true;
    if (isWeekendRental && !isFriday(date)) return true;
    return false;
  };

  const disabledEndDays = (date: Date) => {
    const today = startOfDay(new Date());
    if (date < today) return true;
    if (startDate && date <= startDate) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Duration Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block">Rental Duration</label>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {durationOptions.map((option) => (
            <Card
              key={option.value}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                duration === option.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
              )}
              onClick={() => {
                onDurationChange(option.value);
                if ((option.value === '1-weekend' || option.value === '2-weekend') && startDate && !isFriday(startDate)) {
                  onStartDateChange(getNextAvailableFriday());
                }
                if (option.value !== 'daily') {
                  onEndDateChange(undefined);
                }
              }}
            >
              <CardContent className="p-3 text-center">
                <h4 className="font-semibold">{option.label}</h4>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                {option.days && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {option.days} days
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Date Pickers */}
      <div className={cn("grid gap-4", isDailyRental ? "md:grid-cols-2" : "")}>
        <div>
          <label className="text-sm font-medium mb-3 block">
            {isWeekendRental ? 'Select Start Friday' : 'Start Date'}
          </label>
          <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal h-12',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  onStartDateChange(date);
                  setStartCalendarOpen(false);
                }}
                disabled={disabledStartDays}
                modifiers={{
                  rush: (date) => isRushDay(date) && !disabledStartDays(date)
                }}
                modifiersClassNames={{
                  rush: 'bg-destructive/20 text-destructive font-semibold hover:bg-destructive/30'
                }}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        {isDailyRental && (
          <div>
            <label className="text-sm font-medium mb-3 block">End Date</label>
            <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-12',
                    !customEndDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEndDate ? format(customEndDate, 'PPP') : <span>Pick end date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={customEndDate}
                  onSelect={(date) => {
                    onEndDateChange(date);
                    setEndCalendarOpen(false);
                  }}
                  disabled={disabledEndDays}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Summary */}
      {startDate && calculatedEndDate && rentalDays > 0 && (
        <div className="p-4 bg-secondary/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rental Period</p>
              <p className="font-semibold">
                {format(startDate, 'EEE, MMM d')} → {format(calculatedEndDate, 'EEE, MMM d, yyyy')}
              </p>
            </div>
            <Badge variant="outline" className="text-base px-3 py-1">
              {rentalDays} days
            </Badge>
          </div>
          {startDate && isRushDay(startDate) && (
            <div className="mt-3 p-2 bg-destructive/10 rounded border border-destructive/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive font-medium">Rush order - $50 processing fee applies</span>
            </div>
          )}
        </div>
      )}

      {/* Rush Order Footnote */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30 mt-0.5 flex-shrink-0" />
        <p>
          <span className="font-medium">Rush Order Processing:</span> Orders within 48 hours require a $50 rush fee.
        </p>
      </div>
    </div>
  );
};

export { calculateEndDate, durationOptions };
export default RentalDatePicker;
