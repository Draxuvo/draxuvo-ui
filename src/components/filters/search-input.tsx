// src/components/filters/search-input.tsx
// Búsqueda de las listas (FR-032): borrador local que escribe en la URL con 400 ms de espera y
// se resincroniza cuando la URL cambia desde fuera (por ejemplo "Limpiar filtros").
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 400;

interface SearchInputProps {
  /** Valor aplicado (el de la URL). */
  value: string;
  /** Se llama con el texto tras la espera; la página lo escribe en la URL. */
  onSearch: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onSearch, placeholder, className }: SearchInputProps) {
  const tc = useTranslations("common");
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    if (draft.trim() !== value) setDraft(value);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleChange(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), DEBOUNCE_MS);
  }

  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={tc("search")}
        placeholder={placeholder}
        className="pl-9"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
