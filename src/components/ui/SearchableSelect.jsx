import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Selecione...", 
  disabled = false, 
  labelText,
  inputClassName = "",
  contentClassName = ""
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedOption = options.find((option) => option.value === value);
  
  // Se o valor existe mas não está nas opções, criar uma opção temporária para exibir
  const displayValue = selectedOption 
    ? selectedOption.label 
    : (value ? value : placeholder);

  return (
    <div className="space-y-2">
      {labelText && <label className="block text-white mb-1 text-sm">{labelText}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-white hover:bg-white/20",
              inputClassName || "bg-white/10 border-white/30 h-10"
            )}
            disabled={disabled}
          >
            {displayValue}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn(
          "w-[--radix-popover-trigger-width] p-0 bg-gray-800 text-white border-gray-700",
          contentClassName
        )}>
          <Command>
            <CommandInput placeholder="Buscar..." value={searchTerm} onValueChange={setSearchTerm} />
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={(currentValue) => {
                    const selected = options.find(o => o.label.toLowerCase() === currentValue.toLowerCase());
                    onChange(selected ? selected.value : null);
                    setOpen(false);
                    setSearchTerm('');
                  }}
                  className="hover:bg-emerald-700"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}