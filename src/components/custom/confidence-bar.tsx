import { Progress } from "@/components/ui/progress";

interface ConfidenceBarProps {
  value: number;
}

export function ConfidenceBar({ value }: ConfidenceBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={value} className="h-2 w-20" />
      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}
