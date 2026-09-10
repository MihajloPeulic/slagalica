"use client";

import {
  Eye,
  EyeOff,
} from "lucide-react";

import {
  useState,
  type InputHTMLAttributes,
} from "react";

interface PasswordInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type"
  > {
  wrapperClassName?: string;
}

export function PasswordInput({
  className = "",
  wrapperClassName = "",
  disabled,
  ...props
}: PasswordInputProps) {
  const [show, setShow] =
    useState(false);

  return (
    <div
      className={`relative ${wrapperClassName}`}
    >
      <input
        {...props}
        type={
          show
            ? "text"
            : "password"
        }
        disabled={disabled}
        className={`input-base pr-11 ${className}`}
      />

      <button
        type="button"
        disabled={disabled}
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
          disabled:cursor-not-allowed
          disabled:opacity-50
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
