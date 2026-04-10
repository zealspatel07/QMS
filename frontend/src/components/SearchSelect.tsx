// src/components/SearchSelect.tsx

import { Combobox } from "@headlessui/react";
import { useState } from "react";

type Option = {
  id: number | string;
  label: string;
  meta?: string;
};

interface Props {
  value: Option | null;
  options: Option[];
  placeholder?: string;
  onChange: (opt: Option | null) => void;
  onAddNew?: (query: string) => void;
}

export default function SearchSelect({
  value,
  options,
  placeholder,
  onChange,
  onAddNew,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered =
    query === ""
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase())
        );

  return (
    <Combobox value={value} onChange={onChange}>
      <div className="relative">
        <Combobox.Input
          className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-rose-200"
          placeholder={placeholder}
          displayValue={(opt: Option) => opt?.label ?? ""}
          onChange={(e) => setQuery(e.target.value)}
        />

        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg border">
          {filtered.map((opt) => (
            <Combobox.Option
              key={opt.id}
              value={opt}
              className={({ active }) =>
                `px-3 py-2 cursor-pointer ${
                  active ? "bg-rose-50" : ""
                }`
              }
            >
              <div className="font-medium">{opt.label}</div>
              {opt.meta && (
                <div className="text-xs text-gray-500">{opt.meta}</div>
              )}
            </Combobox.Option>
          ))}

          {filtered.length === 0 && onAddNew && (
            <div
              className="px-3 py-2 cursor-pointer text-rose-600 hover:bg-rose-50"
              onClick={() => onAddNew(query)}
            >
              + Add “{query}”
            </div>
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}
