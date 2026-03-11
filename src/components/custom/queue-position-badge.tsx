interface QueuePositionBadgeProps {
  position: number;
}

export function QueuePositionBadge({ position }: QueuePositionBadgeProps) {
  return (
    <span className="text-xs font-medium text-muted-foreground tabular-nums">
      #{position} in queue
    </span>
  );
}
