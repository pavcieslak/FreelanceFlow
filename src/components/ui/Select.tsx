import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export default function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-muted">{label}</label>
      )}
      <select
        className={cn(
          "w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent transition-colors text-sm min-h-[44px] appearance-none cursor-pointer",
          error && "border-danger",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
