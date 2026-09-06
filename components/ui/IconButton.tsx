import {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type IconButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    label: string;
  };

export function IconButton({
  children,
  label,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`cursor-pointer icon-button ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}