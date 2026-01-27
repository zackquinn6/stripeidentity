import { useState } from 'react';
import { format, addDays, nextFriday, isFriday, startOfDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type RentalDuration = '1-weekend' | '2-weekend' | '30-day';

interface RentalDatePickerProps {
  startDate: Date | undefined;
  duration: RentalDuration;
  onStartDateChange: (date: Date | undefined) => void;
  onDurationChange: (duration: RentalDuration) => void;
}

const durationOptions: { value: RentalDuration; label: string; description: string; days: number }[] = [
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

const calculateEndDate = (startDate: Date, duration: RentalDuration): Date => {
  const option = durationOptions.find(o => o.value === duration);
  return addDays(startDate, option?.days || 3);
};

const RentalDatePicker = ({
  startDate,
  duration,
  onStartDateChange,
  onDurationChange,
}: RentalDatePickerProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const endDate = startDate ? calculateEndDate(startDate, duration) : undefined;
  const selectedOption = durationOptions.find(o => o.value === duration);

  // For weekend rentals, only allow Fridays
  const isWeekendRental = duration === '1-weekend' || duration === '2-weekend';
  
  const disabledDays = (date: Date) => {
    const today = startOfDay(new Date());
    // Disable past dates
    if (date < today) return true;
    // For weekend rentals, only allow Fridays
    if (isWeekendRental && !isFriday(date)) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Duration Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block">Rental Duration</label>
        <div className="grid gap-3 md:grid-cols-3">
          {durationOptions.map((option) => (
            <Card
              key={option.value}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                duration === option.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
              )}
              onClick={() => {
                onDurationChange(option.value);
                // Reset start date when switching duration type
                if ((option.value === '1-weekend' || option.value === '2-weekend') && startDate && !isFriday(startDate)) {
                  onStartDateChange(getNextAvailableFriday());
                }
              }}
            >
              <CardContent className="p-4 text-center">
                <h4 className="font-semibold text-lg">{option.label}</h4>
                <p className="text-sm text-muted-foreground">{option.description}</p>
                <Badge variant="secondary" className="mt-2">
                  {option.days} days
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Date Picker */}
      <div>
        <label className="text-sm font-medium mb-3 block">
          {isWeekendRental ? 'Select Start Friday' : 'Select Start Date'}
        </label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => {
                onStartDateChange(date);
                setCalendarOpen(false);
              }}
              disabled={disabledDays}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary */}
      {startDate && endDate && (
        <div className="p-4 bg-secondary/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rental Period</p>
              <p className="font-semibold">
                {format(startDate, 'EEE, MMM d')} → {format(endDate, 'EEE, MMM d, yyyy')}
              </p>
            </div>
            <Badge variant="outline" className="text-base px-3 py-1">
              {selectedOption?.days} days
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
};

export { calculateEndDate, durationOptions };
export default RentalDatePicker;
