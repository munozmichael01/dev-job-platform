"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchableSelectProps {
  options: (string | number)[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  loading?: boolean
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron opciones",
  searchPlaceholder = "Buscar...",
  className,
  loading = false
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Filtrar opciones basado en la búsqueda
  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    return options.filter(option =>
      String(option).toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  // Obtener label para mostrar
  const selectedLabel = React.useMemo(() => {
    if (value === "all") return placeholder
    return options.find(option => String(option) === value) || placeholder
  }, [value, options, placeholder])

  // Truncar texto largo para el display
  const truncateText = (text: string | number, maxLength: number = 25) => {
    const textStr = String(text)
    if (textStr.length <= maxLength) return textStr
    return textStr.substring(0, maxLength) + "..."
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left", className)}
          disabled={loading}
          title={selectedLabel !== placeholder ? selectedLabel : undefined}
        >
          <span className="block truncate">
            {truncateText(selectedLabel)}
          </span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            <CommandItem
              value="all"
              onSelect={() => {
                onValueChange("all")
                setOpen(false)
                setSearchValue("")
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === "all" ? "opacity-100" : "opacity-0"
                )}
              />
              {placeholder}
            </CommandItem>
            {filteredOptions.map((option) => (
              <CommandItem
                key={String(option)}
                value={String(option)}
                onSelect={() => {
                  onValueChange(String(option))
                  setOpen(false)
                  setSearchValue("")
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === String(option) ? "opacity-100" : "opacity-0"
                  )}
                />
                {String(option)}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}