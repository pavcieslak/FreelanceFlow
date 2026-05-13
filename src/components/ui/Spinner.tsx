import { cn } from "@/lib/utils";

export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin",
        className
      )}
    />
  );
}
