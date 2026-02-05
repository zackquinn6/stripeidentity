import { useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyRentalPeriod } from '@/lib/booqable/client';

const Test = () => {
  // Set default dates: Feb 15-25, 2026 (start of day)
  const defaultStartDate = startOfDay(new Date(2026, 1, 15)); // Month is 0-indexed, so 1 = February
  const defaultEndDate = startOfDay(new Date(2026, 1, 25));

  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleAddToCart = () => {
    if (!startDate || !endDate) {
      setStatus('Please select both start and end dates');
      return;
    }

    // Format dates in ISO format with timezone
    const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

    try {
      const result = applyRentalPeriod(startsAt, stopsAt);
      setStatus(`Rental period applied via: ${result.appliedVia.join(', ')}`);
      console.log('[Test] Applied rental period:', { startsAt, stopsAt, appliedVia: result.appliedVia });
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('[Test] Error applying rental period:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Cart Debug Test Page</h1>
          <p className="text-muted-foreground">Test rental period integration with Booqable cart</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-3 block">Start Date</label>
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
                    setStartDate(date ? startOfDay(date) : undefined);
                    setStartCalendarOpen(false);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">End Date</label>
            <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-12',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date ? startOfDay(date) : undefined);
                    setEndCalendarOpen(false);
                  }}
                  disabled={(date) => startDate ? date <= startDate : false}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {startDate && endDate && (
          <div className="p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Rental Period</p>
            <p className="font-semibold">
              {format(startDate, 'EEE, MMM d, yyyy')} → {format(endDate, 'EEE, MMM d, yyyy')}
            </p>
          </div>
        )}

        <Button
          onClick={handleAddToCart}
          className="w-full"
          size="lg"
          disabled={!startDate || !endDate}
        >
          Add to cart
        </Button>

        {status && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Status:</p>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Test;

