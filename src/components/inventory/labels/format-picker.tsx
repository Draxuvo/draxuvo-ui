// src/components/inventory/labels/format-picker.tsx
// Selector del formato de etiqueta (spec 035): los comunes y, aparte, los propios de la empresa.
"use client";
import { useTranslations } from "next-intl";
import type { LabelFormat } from "@/types";

interface FormatPickerProps {
  formats: LabelFormat[];
  value: string | number;
  onChange: (format: LabelFormat) => void;
}

export function FormatPicker({ formats, value, onChange }: FormatPickerProps) {
  const t = useTranslations("inventory.labels");
  const common = formats.filter((format) => !format.custom);
  const own = formats.filter((format) => format.custom);
  return (
    <select
      aria-label={t("format")}
      value={String(value)}
      onChange={(event) => {
        const picked = formats.find((format) => String(format.id) === event.target.value);
        if (picked) onChange(picked);
      }}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <optgroup label={t("formatCommon")}>
        {common.map((format) => (
          <option key={format.id} value={String(format.id)}>
            {format.name}
          </option>
        ))}
      </optgroup>
      {own.length > 0 && (
        <optgroup label={t("formatOwn")}>
          {own.map((format) => (
            <option key={format.id} value={String(format.id)}>
              {format.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
