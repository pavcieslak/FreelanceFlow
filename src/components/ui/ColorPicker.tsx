import { PROJECT_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "w-7 h-7 rounded-full border-2 transition-all",
            value === color ? "border-white scale-110" : "border-transparent hover:scale-110"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
