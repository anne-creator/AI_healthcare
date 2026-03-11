interface DataSourceTagProps {
  source: string;
}

export function DataSourceTag({ source }: DataSourceTagProps) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
      {source}
    </code>
  );
}
