import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-accent hover:bg-accent-hover text-slate-950 shadow-sm",
    secondary: "bg-surface-elevated hover:bg-border text-text-primary border border-border",
    danger: "bg-danger/10 hover:bg-danger/20 text-danger border border-danger/40",
    ghost: "hover:bg-surface-elevated text-text-muted hover:text-text-primary",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
}
