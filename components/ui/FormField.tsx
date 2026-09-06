import { ReactNode } from "react";

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-text-secondary">
        {label}
      </label>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs font-medium text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}