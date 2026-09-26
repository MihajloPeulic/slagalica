import {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger";

type ButtonSize =
  | "sm"
  | "md"
  | "lg";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  const base = `
    cursor-pointer
    inline-flex
    items-center
    justify-center
    gap-2
    font-black
    transition duration-200 ease-out hover:-translate-y-0.5
    active:scale-[0.98]
    disabled:pointer-events-none
    disabled:opacity-50
  `;

  const variants = {
    primary: `
      bg-primary
      text-white
      hover:bg-primary-hover
    `,

    secondary: `
      border
      border-border
      bg-surface-light
      text-text
      hover:border-primary/30
      hover:bg-surface-light/80
    `,

    ghost: `
      bg-transparent
      text-text-secondary
      hover:bg-surface-light
      hover:text-text
    `,

    danger: `
      border
      border-red-player/20
      bg-red-player/10
      text-danger
      hover:bg-red-player/15
    `,
  };

  const sizes = {
    sm: `
      h-9
      rounded-lg
      px-3
      text-xs
    `,

    md: `
      h-11
      rounded-xl
      px-4
      text-sm
    `,

    lg: `
      h-14
      rounded-xl
      px-6
      text-base
    `,
  };

  return (
    <button
      className={`
        ${base}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
