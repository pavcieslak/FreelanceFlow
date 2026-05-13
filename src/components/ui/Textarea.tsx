import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-muted">{label}</label>
      )}
      <textarea
        className={cn(
          "w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none",
          error && "border-danger",
          className
        )}
        rows={3}
        {...props}
      />
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
