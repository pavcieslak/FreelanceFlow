import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-muted">{label}</label>
      )}
      <input
        className={cn(
          "w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm min-h-[44px]",
          error && "border-danger focus:border-danger",
          className
        )}
        {...props}
      />
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
