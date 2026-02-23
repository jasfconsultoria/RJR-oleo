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
import { Loader2 } from 'lucide-react';

export function UserSearchableSelect({ labelText = "Usuário", value, onChange, users = [], loading = false, inputClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const options = [
    { value: 'all', label: `Todos os ${labelText}s` },
    ...users.map(u => ({ value: u.id, label: u.full_name || u.email }))
  ];

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="space-y-2">
      <label className="block text-white mb-1 text-sm">{labelText}</label>
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
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</span>
            ) : (
              selectedOption ? selectedOption.label : `Selecione ${labelText.toLowerCase()}...`
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-gray-800 text-white border-gray-700">
          <Command>
            <CommandInput placeholder="Buscar usuário..." value={searchTerm} onValueChange={setSearchTerm} />
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
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