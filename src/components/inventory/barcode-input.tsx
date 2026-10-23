// src/components/inventory/barcode-input.tsx
// Códigos de barras de un producto (spec 034): chips que se agregan con Enter o coma (la pistola USB termina con
// Enter) y se quitan con su X. Se guardan como texto exacto, sin tocar ceros iniciales.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface BarcodeInputProps {
  value: string[];
  onChange: (codes: string[]) => void;
  id?: string;
  disabled?: boolean;
}

export function BarcodeInput({ value, onChange, id = "barcodes", disabled }: BarcodeInputProps) {
  const t = useTranslations("inventory.barcodes");
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const codes = raw
      .split(/[;,\n]/)
      .map((code) => code.trim())
      .filter(Boolean);
    if (!codes.length) return;
    onChange([...value, ...codes.filter((code, index) => !value.includes(code) && codes.indexOf(code) === index)]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("label")}>
          {value.map((code) => (
            <li key={code} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">
              {code}
              <button
                type="button"
                disabled={disabled}
                aria-label={t("remove", { code })}
                onClick={() => onChange(value.filter((item) => item !== code))}
                className="foco-etiqueta rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        placeholder={t("placeholder")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
      />
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
