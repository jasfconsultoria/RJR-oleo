import React from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIMask } from 'react-imask';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function DateInput({ date, setDate, className, inputClassName, ...props }) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const { ref, value, setValue } = useIMask({
    mask: Date,
    pattern: 'd/`m/`Y',
    blocks: {
      d: { mask: '00', from: 1, to: 31 },
      m: { mask: '00', from: 1, to: 12 },
      Y: { mask: '0000', from: 1900, to: 9999 },
    },
    format: (date) => {
      if (!date || !isValid(date)) return '';
      return format(date, 'dd/MM/yyyy');
    },
    parse: (str) => {
      const parsed = parse(str, 'dd/MM/yyyy', new Date());
      return isValid(parsed) ? parsed : null;
    },
  });

  React.useEffect(() => {
    if (date && isValid(date)) {
      setValue(format(date, 'dd/MM/yyyy'));
    } else {
      setValue('');
    }
  }, [date, setValue]);

  const handleInputChange = (e) => {
    const str = e.target.value;
    setValue(str);
    const parsedDate = parse(str, 'dd/MM/yyyy', new Date());
    if (isValid(parsedDate) && str.length === 10) {
      setDate(parsedDate);
    } else if (!str) {
      setDate(null);
    }
  };

  const handleCalendarSelect = (selectedDate) => {
    if (selectedDate && isValid(selectedDate)) {
      setDate(selectedDate);
    }
    setPopoverOpen(false);
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        ref={ref}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder="DD/MM/AAAA"
        className={cn(
          "pr-10 rounded-xl bg-white/5 border-white/20 text-white placeholder:text-white/60 focus:ring-emerald-400 h-9 text-xs",
          inputClassName
        )}
        {...props}
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"ghost"}
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-gray-800 text-white border-gray-700 rounded-xl">
          <Calendar
            mode="single"
            selected={date && isValid(date) ? date : undefined}
            onSelect={handleCalendarSelect}
            initialFocus
            locale={ptBR}
            classNames={{
              day_selected: "bg-emerald-500 text-white hover:bg-emerald-600 focus:bg-emerald-600",
              day_today: "bg-emerald-800/50 text-white",
              head_cell: "text-emerald-300",
              nav_button: "text-emerald-300 hover:text-emerald-200",
              caption_label: "text-emerald-200",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}