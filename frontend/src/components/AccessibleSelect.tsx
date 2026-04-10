// components/AccessibleSelect.tsx
import React from 'react';

type Props = {
  id: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
};

export default function AccessibleSelect({ id, label, ariaLabel, value, onChange, children }: Props) {
  return (
    <div>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <select id={id} aria-label={label ? undefined : ariaLabel} value={value} onChange={onChange}>
        {children}
      </select>
    </div>
  );
}
