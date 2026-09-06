"use client";

import {
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  autoComplete?:
    | "current-password"
    | "new-password";
  placeholder?: string;
}

export function PasswordInput({
  value,
  onChange,
  autoComplete,
  placeholder,
}: PasswordInputProps) {
  const [show, setShow] =
    useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="input-base pr-11"
      />

      <button
        type="button"
        onClick={() =>
          setShow((prev) => !prev)
        }
        aria-label={
          show
            ? "Sakrij lozinku"
            : "Prikaži lozinku"
        }
        className="
          absolute
          right-1.5
          top-1/2
          flex
          h-8
          w-8
          -translate-y-1/2
          items-center
          justify-center
          rounded-lg
          text-text-secondary
          transition-colors
          hover:bg-surface-light
          hover:text-text
        "
      >
        {show ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}