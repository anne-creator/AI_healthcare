import { Zap } from "lucide-react";

interface ContradictionCountProps {
  count: number;
}

export function ContradictionCount({ count }: ContradictionCountProps) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-severity-high">
      <Zap className="h-3 w-3" aria-hidden="true" />
      {count} contradiction{count !== 1 ? "s" : ""} found
    </span>
  );
}
