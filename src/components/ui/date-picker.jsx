import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function DatePicker({ date, setDate, className }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white rounded-xl",
            !date && "text-white/60",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : <span>Selecione uma data</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-gray-800 text-white border-gray-700 rounded-xl">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
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
  );
}