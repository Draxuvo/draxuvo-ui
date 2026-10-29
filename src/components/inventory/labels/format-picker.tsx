// src/components/inventory/labels/format-picker.tsx
// Selector del formato de etiqueta (spec 035): los comunes y, aparte, los propios de la empresa.
"use client";
import { useTranslations } from "next-intl";
import type { LabelFormat } from "@/types";
import { Select } from "@/components/ui/select";

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
    <Select
      aria-label={t("format")}
      value={String(value)}
      onChange={(event) => {
        const picked = formats.find((format) => String(format.id) === event.target.value);
        if (picked) onChange(picked);
      }}
     
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
    </Select>
  );
}
